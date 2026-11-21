export function toWhatsAppE164(value: string) {
  const trimmed = value.trim()
  const hasCountryPrefix = trimmed.startsWith('+') || trimmed.startsWith('00')
  let digits = trimmed.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!hasCountryPrefix && digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`
  else if (!hasCountryPrefix && digits.length === 10) digits = `91${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}
