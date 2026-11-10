export type Result<T> = { ok: true; value: T } | { ok: false; error: string; message: string; status: number }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail(error: string, message: string, status: number): Result<never> {
  return { ok: false, error, message, status }
}
