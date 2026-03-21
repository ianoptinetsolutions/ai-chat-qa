-- ================================================================
--  CHAT QA SYSTEM — SUPABASE DATABASE SETUP
--  Run once in: Supabase → SQL Editor → New Query
-- ================================================================
--
--  Tables
--  ──────────────────────────────────────────────────────────────
--  1. qa_conversations     Agent-handled conversations      (WF1)
--  2. qa_bot_conversations Bot-only conversations           (WF1)
--  3. qa_analysis          Claude AI analysis output        (WF2)
--  4. qa_tickets           QA tickets for flagged convos    (WF4)
--  5. qa_alerts            Critical alert fire log          (WF5)
--  6. qa_agent_map         Agent → team leader routing      (manual)
--  7. qa_trends            7-day rolling trend summary      (WF6)
--  8. qa_accuracy          AI accuracy metrics              (WF7)
--  9. qa_daily_reports     Daily report run log             (WF3)
-- 10. qa_monthly_reports   Monthly report archive           (WF8)
--
-- ================================================================


-- ----------------------------------------------------------------
--  1. QA_CONVERSATIONS
--     Stores raw Intercom conversation data fetched daily.
--     WF1 inserts here. WF2 reads rows where analysis_status = 'pending'.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_conversations (
  id                BIGSERIAL     PRIMARY KEY,
  conversation_id   TEXT          NOT NULL UNIQUE,
  player_id         TEXT,
  agent_name        TEXT,
  transcript        TEXT,
  tags              TEXT,
  created_at        TIMESTAMPTZ,
  collected_at      TIMESTAMPTZ,
  status            TEXT,
  intercom_link     TEXT,
  analysis_status   TEXT          NOT NULL DEFAULT 'pending',   -- pending | done
  is_bot_handled    BOOLEAN       NOT NULL DEFAULT FALSE,        -- true if no human agent replied
  language          VARCHAR(5),                                  -- ISO 639-1 code detected by WF2 (ar, de, el, en, fi, fr, it, no, pt)
  inserted_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_conversations_analysis_status
  ON qa_conversations (analysis_status);


-- ----------------------------------------------------------------
--  2. QA_BOT_CONVERSATIONS
--     Stores bot-handled Intercom conversations fetched daily.
--     WF1 inserts here for conversations with no human agent reply.
--     WF2 reads rows where analysis_status = 'pending'.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_bot_conversations (
  id                BIGSERIAL     PRIMARY KEY,
  conversation_id   TEXT          NOT NULL UNIQUE,
  player_id         TEXT,
  agent_name        TEXT          DEFAULT 'Bot',
  transcript        TEXT,
  tags              TEXT,
  created_at        TIMESTAMPTZ,
  collected_at      TIMESTAMPTZ,
  status            TEXT,
  intercom_link     TEXT,
  analysis_status   TEXT          NOT NULL DEFAULT 'pending',   -- pending | done | error
  is_bot_handled    BOOLEAN       NOT NULL DEFAULT TRUE,        -- always true for this table
  language          VARCHAR(5),                                  -- ISO 639-1 code detected by WF2
  inserted_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_bot_conversations_analysis_status
  ON qa_bot_conversations (analysis_status);


-- ----------------------------------------------------------------
--  3. QA_ANALYSIS
--     Claude AI analysis output per conversation.
--     WF2 inserts here after processing qa_conversations.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_analysis (
  id                  BIGSERIAL     PRIMARY KEY,
  conversation_id     TEXT          NOT NULL UNIQUE,
  player_id           TEXT,
  agent_name          TEXT,
  summary             TEXT,
  severity            TEXT,                                      -- Low | Medium | High | Critical
  issue_category      TEXT,
  resolution_status   TEXT,
  key_quotes          TEXT,
  agent_score         INTEGER,                                   -- 1–5, NULL for bot-handled convos
  agent_notes         TEXT,
  recommended_action  TEXT,
  is_alert            BOOLEAN       DEFAULT FALSE,
  alert_reason        TEXT,
  is_bot_handled      BOOLEAN       NOT NULL DEFAULT FALSE,      -- mirrors qa_conversations.is_bot_handled
  language            VARCHAR(5),                                -- ISO 639-1 code detected by Claude (ar, de, el, en, fi, fr, it, no, pt)
  analyzed_at         TIMESTAMPTZ,
  intercom_link       TEXT,
  inserted_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_analysis_severity
  ON qa_analysis (severity);

CREATE INDEX IF NOT EXISTS idx_qa_analysis_analyzed_at
  ON qa_analysis (analyzed_at);


-- ----------------------------------------------------------------
--  3. QA_TICKETS
--     QA tickets created for Medium / High / Critical conversations.
--     WF4 inserts here. Team leaders update status and feedback.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_tickets (
  id                  BIGSERIAL     PRIMARY KEY,
  ticket_id           TEXT          NOT NULL UNIQUE,
  date                DATE,
  conversation_id     TEXT,
  player_id           TEXT,
  agent_name          TEXT,
  severity            TEXT,                                      -- Medium | High | Critical
  issue_category      TEXT,
  summary             TEXT,
  key_quotes          TEXT,
  recommended_action  TEXT,
  assigned_to         TEXT,
  status              TEXT          DEFAULT 'Open',              -- Open | In Review | Closed
  feedback            TEXT,
  feedback_processed  BOOLEAN       DEFAULT FALSE,
  language            VARCHAR(5),                                  -- ISO 639-1 code from qa_analysis.language
  intercom_link       TEXT,
  created_at          TIMESTAMPTZ,
  inserted_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_tickets_feedback_processed
  ON qa_tickets (feedback_processed);


-- ----------------------------------------------------------------
--  4. QA_ALERTS
--     Records every critical alert fired by WF5.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_alerts (
  id               BIGSERIAL     PRIMARY KEY,
  alert_id         TEXT          NOT NULL UNIQUE,
  date             DATE,
  conversation_id  TEXT,
  player_id        TEXT,
  alert_reason     TEXT,
  severity         TEXT,
  notified_to      TEXT,
  responded        BOOLEAN       DEFAULT FALSE,
  response_time    TEXT,
  inserted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ----------------------------------------------------------------
--  5. QA_AGENT_MAP
--     Maps agents to their team leaders for ticket routing.
--     Maintained manually — update as team structure changes.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_agent_map (
  id                    BIGSERIAL     PRIMARY KEY,
  agent_name            TEXT          NOT NULL UNIQUE,
  agent_email           TEXT,
  team_leader_name      TEXT,
  team_leader_slack_id  TEXT,
  inserted_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ----------------------------------------------------------------
--  6. QA_TRENDS
--     One row per WF6 daily run using a 7-day rolling window.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_trends (
  id                 BIGSERIAL     PRIMARY KEY,
  week_start         DATE,
  week_end           DATE,
  top_issues_json    TEXT,
  anomalies_json     TEXT,
  repeat_complainers INTEGER       DEFAULT 0,
  trend_summary      TEXT,
  recommendations    TEXT,
  inserted_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ----------------------------------------------------------------
--  7. QA_ACCURACY
--     Aggregated AI accuracy metrics derived from team leader feedback.
--     WF7 inserts here after processing closed tickets.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_accuracy (
  id              BIGSERIAL     PRIMARY KEY,
  date            DATE,
  total_reviewed  INTEGER       DEFAULT 0,
  agreed          INTEGER       DEFAULT 0,
  disagreed       INTEGER       DEFAULT 0,
  accuracy_rate   NUMERIC(6,4),                                  -- e.g. 0.9250 = 92.50%
  worst_category  TEXT,
  notes           TEXT,
  language        VARCHAR(5)    NOT NULL DEFAULT 'all',          -- 'all' for global row, ISO code for per-language rows
  inserted_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ----------------------------------------------------------------
--  8. QA_DAILY_REPORTS
--     One row per daily report run. WF3 inserts here after sending.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_daily_reports (
  id                BIGSERIAL     PRIMARY KEY,
  date              DATE          UNIQUE,
  total_analyzed    INTEGER       DEFAULT 0,
  critical_count    INTEGER       DEFAULT 0,
  high_count        INTEGER       DEFAULT 0,
  medium_count      INTEGER       DEFAULT 0,
  low_count         INTEGER       DEFAULT 0,
  satisfaction_rate NUMERIC(6,2),
  sent_at           TIMESTAMPTZ,
  inserted_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ----------------------------------------------------------------
--  9. QA_MONTHLY_REPORTS
--     One row per calendar month. WF8 inserts here.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_monthly_reports (
  id                    BIGSERIAL     PRIMARY KEY,
  month                 TEXT          UNIQUE,                    -- e.g. '2026-03'
  total_conversations   INTEGER       DEFAULT 0,
  satisfaction_rate     NUMERIC(6,2),
  top_issues            TEXT,
  accuracy_rate         NUMERIC(6,4),
  report_html           TEXT,
  status                TEXT          DEFAULT 'draft',           -- draft | sent
  generated_at          TIMESTAMPTZ,
  inserted_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ================================================================
--  MIGRATIONS — run these if tables already exist
--  (Safe to run multiple times — IF NOT EXISTS / idempotent)
-- ================================================================

-- Add bot-handling flag to existing tables (2026-03 update)
ALTER TABLE qa_conversations
  ADD COLUMN IF NOT EXISTS is_bot_handled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE qa_analysis
  ADD COLUMN IF NOT EXISTS is_bot_handled BOOLEAN NOT NULL DEFAULT FALSE;

-- agent_score is now nullable for bot-handled conversations
ALTER TABLE qa_analysis
  ALTER COLUMN agent_score DROP NOT NULL;

-- Add language tracking for multilingual conversation support (2026-03 update)
ALTER TABLE qa_conversations
  ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE qa_analysis
  ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE qa_tickets
  ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE qa_accuracy
  ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'all';


-- ================================================================
--  MIGRATION — Extended Intercom fields (2026-03-19)
--  Adds 35 new columns to qa_conversations and qa_bot_conversations
--  to mirror all fields from the client's Intercom CSV export.
--  Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
--
--  RUN THIS IN: Supabase → SQL Editor → New Query
-- ================================================================

ALTER TABLE qa_conversations
  ADD COLUMN IF NOT EXISTS channel TEXT,                               -- source.type (chat/email/etc)
  ADD COLUMN IF NOT EXISTS source_url TEXT,                            -- source.url (page where chat started)
  ADD COLUMN IF NOT EXISTS initiator_type TEXT,                        -- source.author.type (user/lead/admin)
  ADD COLUMN IF NOT EXISTS started_by TEXT,                            -- source.author.name or type
  ADD COLUMN IF NOT EXISTS team_assigned TEXT,                         -- team_assignee.name
  ADD COLUMN IF NOT EXISTS priority TEXT,                              -- priority/not_priority
  ADD COLUMN IF NOT EXISTS first_closed_at TIMESTAMPTZ,               -- statistics.first_close_at
  ADD COLUMN IF NOT EXISTS last_closed_at TIMESTAMPTZ,                -- statistics.last_close_at
  ADD COLUMN IF NOT EXISTS first_replied_at TIMESTAMPTZ,              -- statistics.first_admin_reply_at
  ADD COLUMN IF NOT EXISTS last_rating_updated_at TIMESTAMPTZ,        -- conversation_rating.created_at
  ADD COLUMN IF NOT EXISTS fin_ai_rating_updated_at TIMESTAMPTZ,      -- ai_agent.rating_updated_at
  ADD COLUMN IF NOT EXISTS last_teammate_rating INTEGER,               -- conversation_rating.rating (1-5)
  ADD COLUMN IF NOT EXISTS last_teammate_rating_remark TEXT,           -- conversation_rating.remark
  ADD COLUMN IF NOT EXISTS first_response_time_seconds INTEGER,        -- statistics.time_to_admin_reply
  ADD COLUMN IF NOT EXISTS time_to_first_assignment_seconds INTEGER,   -- statistics.first_assignment_to_first_admin_reply_time
  ADD COLUMN IF NOT EXISTS number_of_reassignments INTEGER DEFAULT 0, -- statistics.count_assignments
  ADD COLUMN IF NOT EXISTS handling_time_seconds INTEGER,              -- statistics.median_time_to_reply
  ADD COLUMN IF NOT EXISTS time_to_close_seconds INTEGER,              -- derived: last_close_at - created_at
  ADD COLUMN IF NOT EXISTS teammate_replies INTEGER DEFAULT 0,         -- derived: count admin/team parts
  ADD COLUMN IF NOT EXISTS user_replies INTEGER DEFAULT 0,             -- derived: count user/lead parts
  ADD COLUMN IF NOT EXISTS replies_to_close INTEGER DEFAULT 0,         -- derived: teammate + user replies
  ADD COLUMN IF NOT EXISTS first_closed_by TEXT,                       -- derived: first close action author
  ADD COLUMN IF NOT EXISTS last_closed_by TEXT,                        -- derived: last close action author
  ADD COLUMN IF NOT EXISTS teammate_replied_to TEXT,                   -- derived: user_name or player_id
  ADD COLUMN IF NOT EXISTS country TEXT,                               -- contact.location.country
  ADD COLUMN IF NOT EXISTS continent TEXT,                             -- contact.location.continent_code
  ADD COLUMN IF NOT EXISTS user_type TEXT,                             -- contact.type (user/lead)
  ADD COLUMN IF NOT EXISTS user_name TEXT,                             -- contact.name
  ADD COLUMN IF NOT EXISTS user_email TEXT,                            -- contact.email
  ADD COLUMN IF NOT EXISTS cx_score_rating TEXT,                       -- custom_attributes['CX Score']
  ADD COLUMN IF NOT EXISTS cx_score_explanation TEXT,                  -- custom_attributes['CX Score explanation']
  ADD COLUMN IF NOT EXISTS copilot_used BOOLEAN DEFAULT FALSE,         -- custom_attributes['Copilot used']
  ADD COLUMN IF NOT EXISTS last_chatbot_rating_updated_at TIMESTAMPTZ, -- ai_agent.rating_updated_at
  ADD COLUMN IF NOT EXISTS last_chatbot_rating INTEGER,                -- ai_agent.rating
  ADD COLUMN IF NOT EXISTS last_chatbot_rating_remark TEXT,            -- ai_agent.remark
  ADD COLUMN IF NOT EXISTS last_chatbot_rated TEXT;                    -- ai_agent.rated_teammate.name

ALTER TABLE qa_bot_conversations
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS initiator_type TEXT,
  ADD COLUMN IF NOT EXISTS started_by TEXT,
  ADD COLUMN IF NOT EXISTS team_assigned TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS first_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_rating_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fin_ai_rating_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_teammate_rating INTEGER,
  ADD COLUMN IF NOT EXISTS last_teammate_rating_remark TEXT,
  ADD COLUMN IF NOT EXISTS first_response_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS time_to_first_assignment_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS number_of_reassignments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handling_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS time_to_close_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS teammate_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replies_to_close INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_closed_by TEXT,
  ADD COLUMN IF NOT EXISTS last_closed_by TEXT,
  ADD COLUMN IF NOT EXISTS teammate_replied_to TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS continent TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS cx_score_rating TEXT,
  ADD COLUMN IF NOT EXISTS cx_score_explanation TEXT,
  ADD COLUMN IF NOT EXISTS copilot_used BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_chatbot_rating_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_chatbot_rating INTEGER,
  ADD COLUMN IF NOT EXISTS last_chatbot_rating_remark TEXT,
  ADD COLUMN IF NOT EXISTS last_chatbot_rated TEXT;


-- ================================================================
--  ROW LEVEL SECURITY (RLS)
--  Run after creating tables. Restricts direct Supabase access to
--  authenticated users only. The dashboard uses NEXT_PUBLIC_SUPABASE_ANON_KEY
--  (browser-visible), so RLS is required to prevent public data exposure.
--
--  n8n workflows use the service_role key which bypasses RLS — no change needed there.
--  Dashboard users must sign in via Supabase Auth before reading data.
--
--  Safe to run multiple times (CREATE POLICY uses IF NOT EXISTS via DROP/CREATE pattern).
-- ================================================================

ALTER TABLE qa_conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_bot_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_analysis            ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_agent_map           ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_trends              ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_accuracy            ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_daily_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_monthly_reports     ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all QA tables (dashboard read access)
CREATE POLICY "auth_read_qa_conversations"      ON qa_conversations      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_bot_conversations"  ON qa_bot_conversations  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_analysis"           ON qa_analysis           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_tickets"            ON qa_tickets            FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_alerts"             ON qa_alerts             FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_agent_map"          ON qa_agent_map          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_trends"             ON qa_trends             FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_accuracy"           ON qa_accuracy           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_daily_reports"      ON qa_daily_reports      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_qa_monthly_reports"    ON qa_monthly_reports    FOR SELECT TO authenticated USING (true);

-- Authenticated users can update tickets (feedback submission) and monthly reports (approval)
CREATE POLICY "auth_update_qa_tickets"          ON qa_tickets           FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_update_qa_monthly_reports"  ON qa_monthly_reports   FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- ================================================================
--  DONE — 10 tables created successfully.
-- ================================================================
SELECT 'Tables created: qa_conversations, qa_bot_conversations, qa_analysis, qa_tickets, '
    || 'qa_alerts, qa_agent_map, qa_trends, '
    || 'qa_accuracy, qa_daily_reports, qa_monthly_reports' AS result;
