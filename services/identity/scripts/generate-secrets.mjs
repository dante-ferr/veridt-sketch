import { generateKeyPairSync, randomBytes } from 'node:crypto'

const { privateKey } = generateKeyPairSync('ed25519')
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const line = (name, value) => {
  process.stdout.write(`${name}='${value}'\n`)
}

line('JWT_PRIVATE_KEY_PEM_B64', Buffer.from(pem).toString('base64'))
for (const name of ['CPF_KEY_B64', 'CPF_HMAC_B64', 'OAB_KEY_B64', 'REFRESH_HMAC_B64', 'TOKEN_HMAC_B64']) {
  line(name, randomBytes(32).toString('base64'))
}
