import { supabase } from './supabaseClient.js'

// Fetches the SAVED quotation from the database and turns it into a PDF.
// pdf-lib is loaded only when needed, so it doesn't slow down the rest of the app.
export async function buildQuotePdf(quotationId) {
  const q = await supabase.from('quotations').select('*').eq('id', quotationId).maybeSingle()
  if (q.error || !q.data) throw new Error(q.error?.message || 'Quotation not found.')

  const [items, biz, cust] = await Promise.all([
    supabase.from('quotation_items').select('*').eq('quotation_id', quotationId).order('sort_order'),
    supabase.from('businesses').select('*').maybeSingle(),
    q.data.customer_id
      ? supabase.from('customers').select('*').eq('id', q.data.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const failure = items.error || biz.error || cust.error
  if (failure || !biz.data) throw new Error(failure?.message || 'Business details could not be loaded.')

  const { renderQuotePdf } = await import('./quotePdfRender.js')
  const bytes = await renderQuotePdf({
    business: biz.data,
    customer: cust.data,
    quotation: q.data,
    items: items.data ?? [],
  })
  const safeNumber = q.data.quote_number.replace(/[^A-Za-z0-9-]/g, '-')
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `Quotation-${safeNumber}.pdf`,
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
