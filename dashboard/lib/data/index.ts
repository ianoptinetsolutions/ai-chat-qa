import { mockAdapter } from './mock-adapter'
import { supabaseAdapter } from './supabase-adapter'
import type { DataAdapter } from './types'

// Switch adapter via DATA_ADAPTER env var
// Values: 'mock' | 'supabase'
const adapterName = process.env.NEXT_PUBLIC_DATA_ADAPTER ?? process.env.DATA_ADAPTER ?? 'mock'

export function getAdapter(): DataAdapter {
  switch (adapterName) {
    case 'supabase':
      return supabaseAdapter
    case 'mock':
    default:
      return mockAdapter
  }
}

export const db = getAdapter()
