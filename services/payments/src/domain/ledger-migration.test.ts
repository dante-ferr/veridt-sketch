import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ledger migration', () => {
  it('rejects updates and deletes on the ledger', () => {
    const sql = readFileSync(
      path.resolve(__dirname, '../../prisma/migrations/20261110000000_init/migration.sql'),
      'utf8',
    )
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON ledger_entries')
    expect(sql).toContain('ledger_entries is append-only')
  })
})
