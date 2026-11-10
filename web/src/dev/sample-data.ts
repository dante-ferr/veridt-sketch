const EXAMPLE_PASSWORD = 'exemplo-dev'

let serial = 0

function checkDigit(base: number[]): number {
  let weight = base.length + 1
  let sum = 0
  for (const digit of base) {
    sum += digit * weight
    weight -= 1
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function generateCpfDigits(now = Date.now()): string {
  serial = (serial + 1) % 1000
  let body = String((now % 1_000_000_000) * 1000 + serial).slice(-9).padStart(9, '0')
  if (/^(\d)\1{8}$/.test(body)) body = `${body.slice(0, 8)}${(Number(body[8]) + 1) % 10}`
  const base = [...body].map((digit) => Number(digit))
  const first = checkDigit(base)
  const second = checkDigit([...base, first])
  return `${body}${first}${second}`
}

export function formatCpf(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function uniqueEmail(): string {
  serial = (serial + 1) % 1000
  return `dev+${Date.now()}${String(serial).padStart(3, '0')}@example.com`
}

export function registrationSample(profile: 'lawyer' | 'common_user') {
  return {
    fullName: 'Marina Alves Costa',
    email: uniqueEmail(),
    cpf: formatCpf(generateCpfDigits()),
    oab: profile === 'lawyer' ? 'BA 123456' : '',
    password: EXAMPLE_PASSWORD,
  }
}

export function billingSample() {
  return {
    fullName: 'Marina Alves Costa',
    email: uniqueEmail(),
    phone: '(71) 98888-0142',
    cpf: formatCpf(generateCpfDigits()),
    postalCode: '40140-110',
    street: 'Rua das Acácias',
    number: '120',
    complement: 'Sala 4',
    district: 'Barra',
    city: 'Salvador',
    state: 'BA',
  }
}
