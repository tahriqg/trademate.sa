// Run with:  node src/lib/money.test.mjs
import assert from 'node:assert/strict'
import {
  parseRandsToCents, parseQuantityMilli, centsToInput, formatZAR, lineTotalCents, calcTotals,
} from './money.js'

// parsing money
assert.equal(parseRandsToCents('1250.50'), 125050)
assert.equal(parseRandsToCents('1 250,50'), 125050)
assert.equal(parseRandsToCents('1,250.50'), 125050)
assert.equal(parseRandsToCents('R99'), 9900)
assert.equal(parseRandsToCents(''), 0)
assert.equal(parseRandsToCents('0.995'), 100)
assert.equal(parseRandsToCents('19.99'), 1999)
assert.equal(parseRandsToCents('abc'), null)
assert.equal(parseRandsToCents('-5'), null)
assert.equal(parseRandsToCents('1.2.3'), null)

// parsing quantities
assert.equal(parseQuantityMilli('2.5'), 2500)
assert.equal(parseQuantityMilli('2,5'), 2500)
assert.equal(parseQuantityMilli('1.005'), 1005)
assert.equal(parseQuantityMilli(''), null)
assert.equal(parseQuantityMilli('x'), null)

// showing money
assert.equal(centsToInput(125050), '1250.50')
assert.equal(centsToInput(5), '0.05')
assert.equal(formatZAR(125050), 'R\u00a01\u00a0250,50')
assert.equal(formatZAR(0), 'R\u00a00,00')

// line totals
assert.equal(lineTotalCents(2500, 10000), 25000) // 2.5 x R100
assert.equal(lineTotalCents(3000, 1999), 5997) // 3 x R19.99
assert.equal(lineTotalCents(1333, 1000), 1333) // 1.333 x R10

// whole quotation, VAT on: 1000 + 500 labour + 100 transport = 1600, less 100 = 1500, VAT 225
let t = calcTotals({
  lineCents: [100000], labourCents: 50000, transportCents: 10000, discountCents: 10000,
  vatEnabled: true, vatRatePercent: 15,
})
assert.deepEqual(t, {
  itemsCents: 100000, subtotalCents: 160000, discountCents: 10000,
  taxableCents: 150000, vatCents: 22500, totalCents: 172500,
})

// VAT off (the default)
t = calcTotals({ lineCents: [100000], vatEnabled: false })
assert.equal(t.vatCents, 0)
assert.equal(t.totalCents, 100000)

// discount can never be bigger than the subtotal
t = calcTotals({ lineCents: [5000], discountCents: 999999 })
assert.equal(t.discountCents, 5000)
assert.equal(t.totalCents, 0)

// VAT rounds half up to the nearest cent
assert.equal(calcTotals({ lineCents: [5], vatEnabled: true, vatRatePercent: 15 }).vatCents, 1) // 0.75c -> 1c
assert.equal(calcTotals({ lineCents: [3], vatEnabled: true, vatRatePercent: 15 }).vatCents, 0) // 0.45c -> 0c
assert.equal(calcTotals({ lineCents: [1000], vatEnabled: true, vatRatePercent: 15 }).vatCents, 150)

console.log('All money tests passed ✅')
