import { NextResponse } from 'next/server'

function cfg() {
  const base  = (process.env.N8N_BASE_URL ?? '').replace(/\/$/, '')
  const key   = process.env.N8N_API_KEY ?? ''
  const wfId  = process.env.N8N_WF1_ID  ?? ''
  if (!base || !key || !wfId) {
    throw new Error(`Missing env vars — N8N_BASE_URL="${base}" N8N_WF1_ID="${wfId}" key=${key ? 'set' : 'MISSING'}`)
  }
  return { base, key, wfId }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTime(nodes: any[]): string {
  const node = nodes.find((n: any) => n.type === 'n8n-nodes-base.scheduleTrigger')
  const cron: string = node?.parameters?.rule?.interval?.[0]?.expression ?? '0 6 * * *'
  const parts  = cron.trim().split(/\s+/)
  const minute = (parts[0] ?? '0').padStart(2, '0')
  const hour   = (parts[1] ?? '6').padStart(2, '0')
  return `${hour}:${minute}`
}

export async function GET() {
  try {
    const { base, key, wfId } = cfg()
    const res = await fetch(`${base}/api/v1/workflows/${wfId}`, {
      headers: { 'X-N8N-API-KEY': key },
      cache: 'no-store',
    })
    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `n8n ${res.status}: ${txt}` }, { status: 500 })
    }
    const wf = await res.json()
    return NextResponse.json({ time: extractTime(wf.nodes ?? []) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { pin, time } = await req.json()

    if (!pin || pin !== process.env.MANAGER_PIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { base, key, wfId } = cfg()

    const [hourStr, minuteStr] = (time as string).split(':')
    const cron = `${parseInt(minuteStr, 10)} ${parseInt(hourStr, 10)} * * *`

    // Fetch current workflow
    const getRes = await fetch(`${base}/api/v1/workflows/${wfId}`, {
      headers: { 'X-N8N-API-KEY': key },
    })
    if (!getRes.ok) {
      const txt = await getRes.text()
      return NextResponse.json({ error: `n8n fetch ${getRes.status}: ${txt}` }, { status: 500 })
    }
    const wf = await getRes.json()

    // Patch only the Schedule Trigger node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = (wf.nodes ?? []).map((n: any) => {
      if (n.type !== 'n8n-nodes-base.scheduleTrigger') return n
      return {
        ...n,
        parameters: {
          ...n.parameters,
          rule: { interval: [{ field: 'cronExpression', expression: cron }] },
        },
      }
    })

    // n8n PUT requires name, nodes, connections, settings
    const putRes = await fetch(`${base}/api/v1/workflows/${wfId}`, {
      method: 'PUT',
      headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        wf.name,
        nodes,
        connections: wf.connections ?? {},
        settings:    wf.settings    ?? {},
        staticData:  wf.staticData  ?? null,
        tags:        (wf.tags ?? []).map((t: any) => ({ id: t.id })),
      }),
    })
    if (!putRes.ok) {
      const txt = await putRes.text()
      return NextResponse.json({ error: `n8n update ${putRes.status}: ${txt}` }, { status: putRes.status })
    }

    return NextResponse.json({ ok: true, cron })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
