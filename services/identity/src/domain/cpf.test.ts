import { describe, expect, it } from 'vitest'
import { isValidCpf } from './cpf'

describe('cpf', () => {
  it('accepts a number with valid check digits', () => {
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejects a bad check digit, a repeated sequence, and formatted text', () => {
    expect(isValidCpf('52998224724')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
    expect(isValidCpf('529.982.247-25')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
  })
})
