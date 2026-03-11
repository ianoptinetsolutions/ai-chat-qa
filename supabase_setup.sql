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
--  DONE — 10 tables created successfully.
-- ================================================================
SELECT 'Tables created: qa_conversations, qa_bot_conversations, qa_analysis, qa_tickets, '
    || 'qa_alerts, qa_agent_map, qa_trends, '
    || 'qa_accuracy, qa_daily_reports, qa_monthly_reports' AS result;
