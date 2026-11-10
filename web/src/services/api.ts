import {
  loseSession,
  readAccessToken,
  readRefreshToken,
  refreshStorageKey,
  singleFlightRefresh,
  writeAccessToken,
} from './session-store'

export { refreshStorageKey }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const copy: Record<string, string> = {
  password_mismatch: 'As senhas não conferem.',
  password_too_short: 'A senha precisa ter no mínimo 8 caracteres.',
  terms_required: 'Aceite os termos de uso e a política de privacidade.',
  invalid_name: 'Informe o nome completo.',
  invalid_email: 'Informe um e-mail válido.',
  invalid_cpf: 'Informe um CPF válido.',
  invalid_oab: 'Informe a OAB no formato UF 000000.',
  email_in_use: 'Já existe uma conta com este e-mail.',
  cpf_in_use: 'Já existe uma conta com este CPF.',
  invalid_credentials: 'E-mail ou senha inválidos.',
  email_not_confirmed: 'Confirme o e-mail antes de entrar.',
  account_locked: 'Após 5 tentativas sem sucesso, o acesso fica bloqueado por 15 minutos.',
  invalid_token: 'Link inválido ou expirado.',
  unauthenticated: 'Faça login para continuar.',
  invalid_input: 'Revise os campos do formulário.',
  too_many_requests: 'Muitas tentativas. Espere um minuto e tente de novo.',
  unavailable: 'Não foi possível falar com o servidor.',
  credit_reservation_blocked: 'A reserva de crédito está bloqueada até a ADR-003. O registro não começou.',
  insufficient_credits: 'Não há créditos suficientes para este registro. Cada registro consome 1 crédito.',
  credits_unavailable: 'O serviço de créditos não está respondendo. O registro não começou.',
  payments_unavailable: 'Pagamentos indisponíveis no momento. O provedor de pagamento não está respondendo.',
  unknown_package: 'Escolha um pacote.',
  invalid_phone: 'Informe o telefone.',
  invalid_postal_code: 'Informe o CEP com 8 dígitos.',
  invalid_address: 'Preencha o endereço.',
  invalid_region: 'Informe a UF com duas letras.',
  invalid_signature: 'A assinatura do webhook não confere.',
  blocked_url: 'Use um endereço público em http ou https. Endereços internos estão bloqueados.',
  invalid_title: 'Informe o título do registro.',
  invalid_state: 'Este registro não aceita mais essa ação.',
  record_not_concluded: 'Só um registro concluído gera relatório e zip.',
  not_found: 'Registro não encontrado.',
  purge_pending_adr_007: 'A exclusão da evidência fica para a ADR-007.',
}

export function userMessage(error: unknown): string {
  if (error instanceof ApiError) return copy[error.code] ?? error.message
  return 'Não foi possível falar com o servidor.'
}

type RequestOptions = { method?: string; body?: unknown; token?: string }

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request(path, options, false)
}

async function request<T>(path: string, options: RequestOptions, retried: boolean): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`
  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'unavailable', copy.unavailable ?? '')
  }
  if (response.status === 204) return undefined as T
  const payload = (await response.json().catch(() => null)) as { error?: string; message?: string; accessToken?: string } | null
  if (response.status === 401 && options.token && !retried) {
    const next = await refreshAccessToken()
    return request(path, { ...options, token: next }, true)
  }
  if (!response.ok) {
    if (response.status === 401 && retried && readAccessToken() === options.token) loseSession()
    const code = payload?.error ?? 'unavailable'
    throw new ApiError(response.status, code, copy[code] ?? payload?.message ?? 'Não foi possível concluir a operação.')
  }
  return payload as T
}

export function refreshAccessToken(): Promise<string> {
  return singleFlightRefresh(performRefresh)
}

async function performRefresh(): Promise<string> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) {
    loseSession()
    throw new ApiError(401, 'unauthenticated', copy.unauthenticated ?? '')
  }
  let response: Response
  try {
    response = await fetch('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    throw new ApiError(0, 'unavailable', copy.unavailable ?? '')
  }
  const payload = (await response.json().catch(() => null)) as { accessToken?: string; error?: string; message?: string } | null
  if (response.status === 401) {
    loseSession()
    const code = payload?.error ?? 'unauthenticated'
    throw new ApiError(response.status, code, copy[code] ?? payload?.message ?? copy.unauthenticated ?? '')
  }
  if (!response.ok || !payload?.accessToken) {
    const code = payload?.error ?? 'unavailable'
    throw new ApiError(response.status, code, copy[code] ?? payload?.message ?? 'Não foi possível concluir a operação.')
  }
  writeAccessToken(payload.accessToken)
  return payload.accessToken
}
