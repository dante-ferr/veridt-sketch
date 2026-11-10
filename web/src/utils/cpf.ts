export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 11)]
  let masked = parts[0] ?? ''
  if (parts[1]) masked += `.${parts[1]}`
  if (parts[2]) masked += `.${parts[2]}`
  if (parts[3]) masked += `-${parts[3]}`
  return masked
}
