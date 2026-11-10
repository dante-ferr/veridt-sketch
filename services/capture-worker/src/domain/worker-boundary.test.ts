import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORKER_FORBIDDEN_ENV } from './worker-boundary'

describe('worker boundary', () => {
  it('does not mention the manifest signing key', () => {
    const root = path.resolve(__dirname, '..')
    const sources = walk(root).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('worker-boundary.ts'))
    const text = sources.map((file) => readFileSync(file, 'utf8')).join('\n')
    for (const name of WORKER_FORBIDDEN_ENV) expect(text).not.toContain(name)
  })
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return [full]
  })
}
