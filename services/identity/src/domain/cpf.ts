export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  if (/^(\d)\1{10}$/.test(value)) return false
  const digits = [...value].map((digit) => Number(digit))
  const first = checkDigit(digits.slice(0, 9))
  const second = checkDigit(digits.slice(0, 10))
  return first === digits[9] && second === digits[10]
}

function checkDigit(base: number[]): number {
  let weight = base.length + 1
  let sum = 0
  for (const digit of base) {
    sum += digit * weight
    weight -= 1
  }
  const remainder = sum % 11
  if (remainder < 2) return 0
  return 11 - remainder
}
