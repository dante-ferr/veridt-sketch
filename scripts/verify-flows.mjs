import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const exec = promisify(execFile)

const base = 'https://localhost:8443'
const password = 'senha-segura'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function checkDigit(digits) {
  let weight = digits.length + 1
  let sum = 0
  for (const digit of digits) {
    sum += digit * weight
    weight -= 1
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

function newCpf() {
  const baseDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (baseDigits.every((digit) => digit === baseDigits[0])) baseDigits[8] = (baseDigits[8] + 1) % 10
  const first = checkDigit(baseDigits)
  const second = checkDigit([...baseDigits, first])
  return [...baseDigits, first, second].join('')
}

async function request(path, options = {}) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}) }
  if (options.token) headers.authorization = `Bearer ${options.token}`
  const response = await fetch(base + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: true }
    }
  }
  return { status: response.status, body }
}

function assert(condition, detail) {
  if (!condition) throw new Error(detail)
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await request('/v1/health')
      if (response.status === 200) return
    } catch {
      // proxy still starting
    }
    await sleep(2000)
  }
  throw new Error('gateway did not become ready')
}

async function mailText(email, subjectPart) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch('http://localhost:8025/api/v1/messages')
    const data = await response.json()
    for (const message of data.messages ?? []) {
      const recipients = (message.To ?? []).map((item) => item.Address ?? '').join(' ')
      if (!recipients.includes(email)) continue
      const detail = await fetch(`http://localhost:8025/api/v1/message/${message.ID}`).then((item) => item.json())
      if (String(detail.Subject ?? '').includes(subjectPart)) return String(detail.Text ?? '')
    }
    await sleep(1000)
  }
  throw new Error(`mail not found: ${subjectPart}`)
}

function tokenFrom(text) {
  const match = text.match(/token=([A-Za-z0-9_-]+)/)
  if (!match) throw new Error('token missing from mail')
  return match[1]
}

async function register(profile, email) {
  return request('/v1/accounts', {
    method: 'POST',
    body: {
      profile,
      fullName: 'Ana Ribeiro',
      email,
      cpf: newCpf(),
      oab: profile === 'lawyer' ? 'SP 123456' : undefined,
      password,
      passwordConfirmation: password,
      acceptedTerms: true,
    },
  })
}

async function composeStatus(service, path, accessToken) {
  const code = accessToken
    ? `fetch('http://127.0.0.1:3000${path}',{headers:{authorization:'Bearer '+process.env.ACCESS_TOKEN}}).then(r=>process.stdout.write(String(r.status)))`
    : `fetch('http://127.0.0.1:3000${path}').then(r=>process.stdout.write(String(r.status)))`
  const args = ['compose', 'exec', '-T']
  if (accessToken) args.push('-e', `ACCESS_TOKEN=${accessToken}`)
  args.push(service, 'node', '-e', code)
  const { stdout } = await exec('docker', args)
  return stdout.trim()
}

async function main() {
  await waitUntilReady()
  const stamp = Date.now()
  const lawyerEmail = `lawyer-${stamp}@example.com`
  const lockedEmail = `locked-${stamp}@example.com`

  const mismatch = await request('/v1/accounts', {
    method: 'POST',
    body: {
      profile: 'lawyer',
      fullName: 'Ana Ribeiro',
      email: `bad-${stamp}@example.com`,
      cpf: newCpf(),
      oab: 'SP 1',
      password,
      passwordConfirmation: 'outra-senha',
      acceptedTerms: true,
    },
  })
  assert(mismatch.status === 400 && mismatch.body?.error === 'password_mismatch', `mismatch ${mismatch.status}`)
  console.log('ok password mismatch')

  const created = await register('lawyer', lawyerEmail)
  assert(created.status === 201, `register ${created.status} ${created.body?.error ?? ''}`)
  console.log('ok register')

  const early = await request('/v1/sessions', { method: 'POST', body: { email: lawyerEmail, password } })
  assert(early.status === 403 && early.body?.error === 'email_not_confirmed', `early login ${early.status}`)
  console.log('ok login before confirmation')

  const locked = await register('common_user', lockedEmail)
  assert(locked.status === 201, `lock account ${locked.status}`)
  let lastStatus = 0
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await request('/v1/sessions', {
      method: 'POST',
      body: { email: lockedEmail, password: 'senha-errada' },
    })
    lastStatus = failed.status
  }
  assert(lastStatus === 423, `lock status ${lastStatus}`)
  console.log('ok lock on fifth failure')

  const confirmation = tokenFrom(await mailText(lawyerEmail, 'Confirme seu e-mail'))
  const confirmed = await request('/v1/accounts/confirmation', { method: 'POST', body: { token: confirmation } })
  assert(confirmed.status === 200, `confirm ${confirmed.status}`)
  console.log('ok email confirmation')

  const session = await request('/v1/sessions', { method: 'POST', body: { email: lawyerEmail, password } })
  assert(session.status === 200 && session.body?.accessToken && session.body?.refreshToken, `login ${session.status}`)
  console.log('ok login')

  const me = await request('/v1/me', { token: session.body.accessToken })
  assert(me.status === 200 && me.body?.fullName === 'Ana Ribeiro', `me ${me.status}`)
  const missing = await request('/v1/me')
  assert(missing.status === 401, `me without token ${missing.status}`)
  console.log('ok current account')

  const identityStatus = await composeStatus('identity', '/v1/me')
  assert(identityStatus === '401', `identity without token ${identityStatus}`)
  const notificationStatus = await composeStatus('notification', '/v1/session')
  assert(notificationStatus === '401', `notification without token ${notificationStatus}`)
  const notificationOk = await composeStatus('notification', '/v1/session', session.body.accessToken)
  assert(notificationOk === '204', `notification with token ${notificationOk}`)
  console.log('ok services validate the access token')

  const logout = await request('/v1/sessions/logout', {
    method: 'POST',
    token: session.body.accessToken,
    body: { refreshToken: session.body.refreshToken },
  })
  assert(logout.status === 204, `logout ${logout.status}`)
  console.log('ok logout')

  const renewed = await request('/v1/sessions/refresh', {
    method: 'POST',
    body: { refreshToken: session.body.refreshToken },
  })
  assert(renewed.status === 401, `revoked refresh ${renewed.status}`)
  console.log('ok revoked refresh')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'verify failed')
  process.exit(1)
})
