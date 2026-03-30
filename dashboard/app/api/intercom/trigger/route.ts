import { NextResponse } from 'next/server'

function cfg() {
  const base = (process.env.N8N_BASE_URL ?? '').replace(/\/$/, '')
  const key  = process.env.N8N_API_KEY ?? ''
  const wfId = process.env.N8N_WF1_ID  ?? ''
  if (!base || !key || !wfId) {
    throw new Error(`Missing env vars — N8N_BASE_URL="${base}" N8N_WF1_ID="${wfId}" key=${key ? 'set' : 'MISSING'}`)
  }
  return { base, key, wfId }
}

export async function POST(req: Request) {
  try {
    const { pin, dateFrom, dateTo } = await req.json()

    if (!pin || pin !== process.env.MANAGER_PIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { base, key, wfId } = cfg()

    let res: Response

    if (dateFrom && dateTo) {
      // Custom date range — POST to WF1's dedicated Dashboard Trigger webhook.
      // The "Compute Date Range" node reads dateFrom/dateTo from the webhook body.
      // Requires WF1 to be active in n8n.
      const webhookUrl = `${base}/webhook/wf1-dashboard-trigger`
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
    } else {
      // No custom date — trigger via workflow run API.
      // WF1's "Compute Date Range" node falls back to yesterday's UTC window.
      res = await fetch(`${base}/api/v1/workflows/${wfId}/run`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    }

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `n8n ${res.status}: ${txt}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ ok: true, executionId: data.data?.executionId ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
