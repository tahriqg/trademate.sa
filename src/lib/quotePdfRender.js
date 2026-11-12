// Draws a professional A4 quotation PDF. Pure drawing code: it is given the
// data and returns the PDF bytes, so it can be tested without the database.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatZAR, lineTotalCents } from './money.js'

const PAGE_W = 595.28
const PAGE_H = 841.89
const M = 42 // page margin
const BOTTOM = 56 // space kept free at the bottom of every page
const W = PAGE_W - M * 2

const NAVY = rgb(0.043, 0.122, 0.227)
const GREEN = rgb(0.184, 0.714, 0.486)
const INK = rgb(0.1, 0.14, 0.2)
const GREY = rgb(0.4, 0.44, 0.52)
const LIGHT = rgb(0.96, 0.97, 0.98)
const LINE = rgb(0.89, 0.91, 0.94)
const WHITE = rgb(1, 1, 1)

const money = (cents) => formatZAR(cents).replace(/\u00a0/g, ' ')
const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}
const fmtQty = (q) => String(Number(q))

export async function renderQuotePdf({ business, customer, quotation, items }) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Quotation ${quotation.quote_number}`)
  pdf.setAuthor(business.name || 'TradeMate SA')
  pdf.setCreator('TradeMate SA')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const allowed = new Set(regular.getCharacterSet())

  // PDF standard fonts can't draw every character (emoji, for example). Swap those for "?".
  const safe = (v) =>
    Array.from(String(v ?? '').replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/\t/g, ' '))
      .map((ch) => (ch === '\n' || allowed.has(ch.codePointAt(0)) ? ch : '?'))
      .join('')

  // Splits text into lines that fit a given width.
  function wrap(str, font, size, maxW) {
    const out = []
    for (const para of safe(str).split('\n')) {
      let line = ''
      for (const word of para.split(' ')) {
        const attempt = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(attempt, size) <= maxW) {
          line = attempt
          continue
        }
        if (line) out.push(line)
        let chunk = '' // a single very long word: break it by letters
        for (const ch of word) {
          if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxW) {
            out.push(chunk)
            chunk = ch
          } else chunk += ch
        }
        line = chunk
      }
      out.push(line)
    }
    return out
  }

  // "y" is always measured DOWN from the top of the page.
  let page
  let y
  const startPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = M
  }
  const ensure = (h) => {
    if (y + h > PAGE_H - BOTTOM) startPage()
  }
  const text = (str, x, top, size, { font = regular, color = INK, align = 'left' } = {}) => {
    const s = safe(str).replace(/\n/g, ' ')
    const w = font.widthOfTextAtSize(s, size)
    page.drawText(s, { x: align === 'right' ? x - w : x, y: PAGE_H - top - size * 0.8, size, font, color })
  }
  const rect = (x, top, w, h, color) =>
    page.drawRectangle({ x, y: PAGE_H - top - h, width: w, height: h, color })

  startPage()

  // ---------- header: logo, business details, quotation number ----------
  const top0 = y
  let leftX = M
  let logoH = 0
  if (business.logo_url) {
    try {
      const img = business.logo_url.startsWith('data:image/jpeg')
        ? await pdf.embedJpg(business.logo_url)
        : await pdf.embedPng(business.logo_url)
      const scale = Math.min(120 / img.width, 56 / img.height, 1)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(img, { x: M, y: PAGE_H - top0 - h, width: w, height: h })
      leftX = M + w + 12
      logoH = h
    } catch {
      // a broken logo should never stop the quotation from being created
    }
  }
  let leftY = top0
  text(business.name || 'Your Business', leftX, leftY, 18, { font: bold, color: NAVY })
  leftY += 24
  const details = []
  if (business.phone) details.push(`Tel: ${business.phone}`)
  if (business.email) details.push(business.email)
  if (business.address) details.push(...wrap(business.address, regular, 9, 240))
  if (business.vat_number) details.push(`VAT No: ${business.vat_number}`)
  for (const l of details) {
    text(l, leftX, leftY, 9, { color: GREY })
    leftY += 12
  }

  let rightY = top0
  text('QUOTATION', PAGE_W - M, rightY, 22, { font: bold, color: GREEN, align: 'right' })
  rightY += 32
  const meta = [
    ['Quotation no:', quotation.quote_number],
    ['Date:', fmtDate(quotation.issue_date)],
  ]
  if (quotation.expiry_date) meta.push(['Valid until:', fmtDate(quotation.expiry_date)])
  for (const [label, value] of meta) {
    text(value, PAGE_W - M, rightY, 10, { font: bold, color: NAVY, align: 'right' })
    text(label, PAGE_W - M - bold.widthOfTextAtSize(safe(value), 10) - 6, rightY, 10, {
      color: GREY,
      align: 'right',
    })
    rightY += 15
  }

  y = Math.max(leftY, rightY, top0 + logoH) + 8
  rect(M, y, W, 2, GREEN)
  y += 18

  // ---------- customer and description of work ----------
  text('QUOTATION FOR', M, y, 8, { font: bold, color: GREEN })
  y += 13
  text(customer?.name || 'No customer selected', M, y, 12, { font: bold, color: NAVY })
  y += 17
  const contact = []
  if (customer?.phone) contact.push(`Tel: ${customer.phone}`)
  if (customer?.email) contact.push(customer.email)
  if (customer?.address) contact.push(...wrap(customer.address, regular, 9.5, 300))
  for (const l of contact) {
    text(l, M, y, 9.5)
    y += 12.5
  }
  y += 12
  text('DESCRIPTION OF WORK', M, y, 8, { font: bold, color: GREEN })
  y += 13
  for (const l of wrap(quotation.title, bold, 11.5, W)) {
    ensure(16)
    text(l, M, y, 11.5, { font: bold })
    y += 15
  }
  y += 12

  // ---------- items table ----------
  const cols = { type: 62, qty: 44, unit: 84, total: 84 }
  const descW = W - cols.type - cols.qty - cols.unit - cols.total
  const xType = M + descW
  const xQty = xType + cols.type
  const xUnit = xQty + cols.qty
  const xTotal = xUnit + cols.unit
  const PAD = 6

  const drawHead = () => {
    ensure(60)
    rect(M, y, W, 22, NAVY)
    text('Description', M + PAD, y + 7, 9, { font: bold, color: WHITE })
    text('Type', xType + PAD, y + 7, 9, { font: bold, color: WHITE })
    text('Qty', xQty + cols.qty - PAD, y + 7, 9, { font: bold, color: WHITE, align: 'right' })
    text('Unit price', xUnit + cols.unit - PAD, y + 7, 9, { font: bold, color: WHITE, align: 'right' })
    text('Total', xTotal + cols.total - PAD, y + 7, 9, { font: bold, color: WHITE, align: 'right' })
    y += 22
  }
  drawHead()
  items.forEach((it, i) => {
    const lines = wrap(it.description, regular, 9.5, descW - PAD * 2)
    const h = lines.length * 12 + 10
    if (y + h > PAGE_H - BOTTOM) {
      startPage()
      drawHead()
    }
    if (i % 2 === 1) rect(M, y, W, h, LIGHT)
    lines.forEach((l, k) => text(l, M + PAD, y + 5 + k * 12, 9.5))
    text(it.kind === 'service' ? 'Service' : 'Material', xType + PAD, y + 5, 9.5, { color: GREY })
    text(fmtQty(it.quantity), xQty + cols.qty - PAD, y + 5, 9.5, { align: 'right' })
    text(money(it.unit_price_cents), xUnit + cols.unit - PAD, y + 5, 9.5, { align: 'right' })
    const total = lineTotalCents(Math.round(Number(it.quantity) * 1000), it.unit_price_cents)
    text(money(total), xTotal + cols.total - PAD, y + 5, 9.5, { font: bold, align: 'right' })
    rect(M, y + h - 0.5, W, 0.5, LINE)
    y += h
  })
  y += 14

  // ---------- totals ----------
  const rows = [
    ['Materials and services', quotation.subtotal_cents - quotation.labour_cents - quotation.transport_cents],
  ]
  if (quotation.labour_cents > 0) rows.push(['Labour', quotation.labour_cents])
  if (quotation.transport_cents > 0) rows.push(['Transport', quotation.transport_cents])
  rows.push(['Subtotal', quotation.subtotal_cents])
  if (quotation.discount_cents > 0) rows.push(['Discount', -quotation.discount_cents])
  if (quotation.vat_enabled) rows.push([`VAT (${Number(quotation.vat_rate)}%)`, quotation.vat_cents])

  const boxW = 240
  const boxX = PAGE_W - M - boxW
  ensure(rows.length * 17 + 56)
  for (const [label, cents] of rows) {
    text(label, boxX, y, 10, { color: GREY })
    text(money(cents), PAGE_W - M, y, 10, { align: 'right' })
    y += 17
  }
  y += 3
  rect(boxX - 8, y, boxW + 8, 28, NAVY)
  text('TOTAL', boxX, y + 9, 11, { font: bold, color: WHITE })
  text(money(quotation.total_cents), PAGE_W - M - 8, y + 6, 14, { font: bold, color: WHITE, align: 'right' })
  y += 28 + 22

  // ---------- notes and terms ----------
  const block = (title, body) => {
    if (!body || !body.trim()) return
    ensure(44)
    text(title, M, y, 10, { font: bold, color: NAVY })
    y += 15
    for (const l of wrap(body, regular, 9.5, W)) {
      ensure(14)
      text(l, M, y, 9.5)
      y += 13
    }
    y += 12
  }
  block('Notes', quotation.notes)
  block('Terms and conditions', quotation.terms)

  // ---------- footer on every page ----------
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    const label = safe(`Generated with TradeMate SA  -  Page ${i + 1} of ${pages.length}`)
    p.drawText(label, {
      x: PAGE_W / 2 - regular.widthOfTextAtSize(label, 8) / 2,
      y: 26,
      size: 8,
      font: regular,
      color: GREY,
    })
  })

  return pdf.save()
}
