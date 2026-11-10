import httpProxy from 'http-proxy'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { remoteJwks, verifyAccessToken } from '@veridit/auth'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { classifyRoute, isRateLimited, tooManyAttempts, upstreamFor } from './routes'

const identityUrl = required('IDENTITY_URL')
const captureUrl = required('CAPTURE_URL')
const recordsUrl = required('RECORDS_URL')
const workerUrl = required('CAPTURE_WORKER_URL')
const jwksUrl = required('JWKS_URL')
const issuer = process.env.JWT_ISSUER ?? 'veridit-identity'
const audience = process.env.JWT_AUDIENCE ?? 'veridit'
const port = Number(process.env.PORT ?? '8080')
const keys = remoteJwks(jwksUrl)
const buckets = new Map<string, { count: number; resetAt: number }>()
const openApiRoot = path.resolve(__dirname, '../..')

async function main(): Promise<void> {
  const app = Fastify({ logger: false, bodyLimit: 65_536 })
  app.addHook('onResponse', (request, reply, done) => {
    console.log(
      JSON.stringify({
        msg: 'request',
        method: request.method,
        path: request.url.split('?')[0],
        status: reply.statusCode,
      }),
    )
    done()
  })
  app.setErrorHandler((_error, _request, reply) => {
    reply.status(400).send({ error: 'invalid_input', message: 'Check the form fields.' })
  })
  app.all('/*', async (request, reply) => {
    await handle(request, reply)
  })
  await app.listen({ port, host: '0.0.0.0' })
  const proxyServer = httpProxy.createProxyServer({ ws: true, ignorePath: true })
  app.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://gateway')
    const match = /^\/v1\/captures\/([0-9a-f-]{36})\/session$/.exec(url.pathname)
    const token = url.searchParams.get('access_token') ?? ''
    if (!match || !token) {
      socket.destroy()
      return
    }
    verifyAccessToken(token, keys, { issuer, audience })
      .then((access) => {
        const id = match[1]
        request.url = `/sessions/${id}?accountId=${access.sub}`
        proxyServer.ws(request, socket, head, { target: workerUrl })
      })
      .catch(() => socket.destroy())
  })
  console.log(JSON.stringify({ msg: 'service_ready', service: 'gateway', port }))
}

async function handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const pathOnly = request.url.split('?')[0] ?? request.url
  const routeClass = classifyRoute(request.method, pathOnly)
  if (routeClass === 'missing') {
    reply.status(404).send({ error: 'not_found', message: 'Route not found.' })
    return
  }
  if (isRateLimited(request.method, pathOnly) && tooManyAttempts(buckets, clientIp(request), Date.now())) {
    reply.status(429).send({ error: 'too_many_requests', message: 'Too many attempts. Wait a minute and try again.' })
    return
  }
  if (routeClass === 'protected') {
    const header = request.headers.authorization
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      reply.status(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' })
      return
    }
    try {
      await verifyAccessToken(token, keys, { issuer, audience })
    } catch {
      reply.status(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' })
      return
    }
  }
  if (pathOnly === '/v1/health') {
    reply.send({ status: 'ok' })
    return
  }
  if (pathOnly === '/v1/openapi/identity') {
    reply.type('application/yaml').send(readFileSync(path.join(openApiRoot, 'services/identity/openapi.yaml')))
    return
  }
  if (pathOnly === '/v1/openapi/notification') {
    reply.type('application/yaml').send(readFileSync(path.join(openApiRoot, 'services/notification/openapi.yaml')))
    return
  }
  if (pathOnly === '/v1/openapi/capture') {
    reply.type('application/yaml').send(readFileSync(path.join(openApiRoot, 'services/capture/openapi.yaml')))
    return
  }
  if (pathOnly === '/v1/openapi/records') {
    reply.type('application/yaml').send(readFileSync(path.join(openApiRoot, 'services/records/openapi.yaml')))
    return
  }
  await proxy(request, reply, upstreamFor(pathOnly))
}

async function proxy(request: FastifyRequest, reply: FastifyReply, upstreamName: 'identity' | 'capture' | 'records'): Promise<void> {
  const base = upstreamName === 'capture' ? captureUrl : upstreamName === 'records' ? recordsUrl : identityUrl
  const headers = new Headers()
  const contentType = request.headers['content-type']
  if (typeof contentType === 'string') headers.set('content-type', contentType)
  if (typeof request.headers.authorization === 'string') headers.set('authorization', request.headers.authorization)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  try {
    const upstream = await fetch(new URL(request.url, base), {
      method: request.method,
      headers,
      body: hasBody ? JSON.stringify(request.body ?? {}) : undefined,
    })
    reply.status(upstream.status)
    const type = upstream.headers.get('content-type')
    if (type) reply.header('content-type', type)
    if (upstream.status === 204) {
      reply.send()
      return
    }
    reply.send(await upstream.text())
  } catch (error) {
    console.log(JSON.stringify({
      msg: 'upstream_unavailable',
      upstream: upstreamName,
      error: error instanceof Error ? error.message : 'unknown',
    }))
    reply.status(502).send({ error: 'unavailable', message: 'The upstream service is unavailable.' })
  }
}

function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || request.ip
  }
  return request.ip
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(JSON.stringify({ msg: 'missing_config', key: name }))
    process.exit(1)
  }
  return value
}

main()
