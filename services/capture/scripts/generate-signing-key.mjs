import { writeFileSync } from 'node:fs'
import { generateKeyPairSync } from 'node:crypto'

const target = process.argv[2]
if (!target) {
  console.error('missing path')
  process.exit(1)
}
const pair = generateKeyPairSync('ed25519')
writeFileSync(target, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
