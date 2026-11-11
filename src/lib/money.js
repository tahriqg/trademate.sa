// Money helpers for TradeMate SA.
// All money is whole CENTS (R10.50 = 1050) and all maths uses whole numbers,
// so there are no floating-point rounding surprises.

const MAX_RANDS = 99999999 // R99,999,999

// "1250.50", "1 250,50", "R99" -> cents. Empty -> 0. Not a valid amount -> null.
export function parseRandsToCents(input) {
  const raw = String(input ?? '').trim()
  if (raw === '') return 0
  let s = raw.replace(/[R\s\u00a0]/gi, '')
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.') // 1250,50 -> 1250.50
  else s = s.replace(/,/g, '') // 1,250.50 -> 1250.50
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null
  const [whole = '', frac = ''] = s.split('.')
  const rands = Number(whole || '0')
  if (rands > MAX_RANDS) return null
  const thousandths = Number(frac.padEnd(3, '0').slice(0, 3))
  return rands * 100 + Math.floor((thousandths + 5) / 10) // round half up to cents
}

// "2.5" or "2,5" -> 2500 (thousandths). Empty or invalid -> null.
export function parseQuantityMilli(input) {
  const s = String(input ?? '').trim().replace(',', '.')
  if (s === '' || s === '.' || !/^\d*\.?\d*$/.test(s)) return null
  const milli = Math.round(Number(s) * 1000)
  return milli > 1e9 ? null : milli
}

// 125050 -> "1250.50" (for filling input boxes)
export function centsToInput(cents) {
  const c = Number(cents) || 0
  return `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, '0')}`
}

// 125050 -> "R 1 250,50" (South African style, for display)
export function formatZAR(cents) {
  const c = Number(cents) || 0
  const abs = Math.abs(c)
  const whole = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  const dec = String(abs % 100).padStart(2, '0')
  return `${c < 0 ? '-' : ''}R\u00a0${whole},${dec}`
}

// quantity (in thousandths) x unit price (cents) -> line total in cents
export function lineTotalCents(qtyMilli, unitCents) {
  return Math.floor((qtyMilli * unitCents + 500) / 1000)
}

// Works out every figure on a quotation.
// Prices are entered EXCLUDING VAT. The discount comes off before VAT is added.
export function calcTotals({
  lineCents = [],
  labourCents = 0,
  transportCents = 0,
  discountCents = 0,
  vatEnabled = false,
  vatRatePercent = 15,
}) {
  const itemsCents = lineCents.reduce((sum, c) => sum + c, 0)
  const subtotalCents = itemsCents + labourCents + transportCents
  const discount = Math.min(discountCents, subtotalCents) // can't discount more than the total
  const taxableCents = subtotalCents - discount
  const rateBasisPoints = Math.round(vatRatePercent * 100) // 15% -> 1500
  const vatCents = vatEnabled ? Math.floor((taxableCents * rateBasisPoints + 5000) / 10000) : 0
  return {
    itemsCents,
    subtotalCents,
    discountCents: discount,
    taxableCents,
    vatCents,
    totalCents: taxableCents + vatCents,
  }
}
