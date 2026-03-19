import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { pin } = await req.json()
  if (!pin || pin !== process.env.MANAGER_PIN) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
