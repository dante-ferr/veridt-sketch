import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('audit trail migration', () => {
  it('rejects updates and deletes on the audit table', () => {
    const sql = readFileSync(
      path.resolve(__dirname, '../../prisma/migrations/20261108010000_init/migration.sql'),
      'utf8',
    )
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON audit_events')
    expect(sql).toContain('audit_events is append-only')
  })
})
