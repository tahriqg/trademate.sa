import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import {
  parseRandsToCents,
  parseQuantityMilli,
  centsToInput,
  lineTotalCents,
  calcTotals,
  formatZAR,
} from '../lib/money.js'
import { STATUS_LABELS } from '../lib/quoteStatus.js'
import { buildQuotePdf, downloadBlob } from '../lib/quotePdf.js'
import '../customers.css'
import '../quotes.css'
import '../settings.css'

const DEFAULT_TERMS =
  'A 50% deposit is required before work starts. The balance is due on completion. This quotation is valid until the expiry date shown.'

const dateString = (daysFromNow = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}
const blankItem = () => ({
  key: crypto.randomUUID(),
  kind: 'material',
  description: '',
  quantity: '1',
  unitPrice: '',
})
const clean = (v) => (v.trim() === '' ? null : v.trim())
// A text fingerprint of what is on screen, used to spot unsaved changes.
const snapshotOf = (form, items) =>
  JSON.stringify({ form, items: items.map((it) => [it.kind, it.description, it.quantity, it.unitPrice]) })

export default function QuoteEditor() {
  const { id } = useParams() // undefined when creating a new quotation
  const isNew = !id
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [business, setBusiness] = useState(null)
  const [customers, setCustomers] = useState([])
  const [quoteNumber, setQuoteNumber] = useState('')
  const [oldItemIds, setOldItemIds] = useState([])

  const [form, setForm] = useState({
    customerId: '',
    title: '',
    status: 'draft',
    issueDate: dateString(0),
    expiryDate: dateString(30),
    vatEnabled: false,
    vatRate: '15',
    labour: '',
    transport: '',
    discount: '',
    notes: '',
    terms: '',
  })
  const [items, setItems] = useState([blankItem()])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMessage, setPdfMessage] = useState('')
  const [jobId, setJobId] = useState(null)
  const [jobBusy, setJobBusy] = useState(false)
  const [jobError, setJobError] = useState('')

  // quick "new customer" mini form
  const [newCust, setNewCust] = useState(null)
  const [custError, setCustError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const [biz, cust] = await Promise.all([
        supabase.from('businesses').select('*').maybeSingle(),
        supabase.from('customers').select('id, name').order('name', { ascending: true }),
      ])
      if (!active) return
      if (biz.error || cust.error || !biz.data) {
        setLoadError(biz.error?.message || cust.error?.message || 'Your business could not be loaded.')
        setLoading(false)
        return
      }
      setBusiness(biz.data)
      setCustomers(cust.data ?? [])

      if (isNew) {
        setForm((f) => ({
          ...f,
          vatEnabled: biz.data.vat_enabled,
          vatRate: String(biz.data.vat_rate),
          terms: biz.data.default_terms || DEFAULT_TERMS,
        }))
      } else {
        const [q, it, jb] = await Promise.all([
          supabase.from('quotations').select('*').eq('id', id).maybeSingle(),
          supabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
          supabase.from('jobs').select('id').eq('quotation_id', id).maybeSingle(),
        ])
        if (!active) return
        if (q.error || it.error || !q.data) {
          setLoadError(q.error?.message || it.error?.message || 'Quotation not found.')
          setLoading(false)
          return
        }
        const d = q.data
        const formObj = {
          customerId: d.customer_id ?? '',
          title: d.title,
          status: d.status,
          issueDate: d.issue_date,
          expiryDate: d.expiry_date ?? '',
          vatEnabled: d.vat_enabled,
          vatRate: String(d.vat_rate),
          labour: d.labour_cents ? centsToInput(d.labour_cents) : '',
          transport: d.transport_cents ? centsToInput(d.transport_cents) : '',
          discount: d.discount_cents ? centsToInput(d.discount_cents) : '',
          notes: d.notes ?? '',
          terms: d.terms ?? '',
        }
        const rows = it.data ?? []
        const itemsObj = rows.length
          ? rows.map((r) => ({
              key: r.id,
              kind: r.kind,
              description: r.description,
              quantity: String(Number(r.quantity)),
              unitPrice: centsToInput(r.unit_price_cents),
            }))
          : [blankItem()]
        setQuoteNumber(d.quote_number)
        setOldItemIds(rows.map((r) => r.id))
        setForm(formObj)
        setItems(itemsObj)
        setSavedSnapshot(snapshotOf(formObj, itemsObj))
        setJustSaved(false)
        setJobId(jb.data?.id ?? null)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [id, isNew])

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }
  function setItem(key, field, value) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
  }

  // ---- all the maths, recalculated live ----
  const calc = useMemo(() => {
    const problems = []
    const lines = []
    const lineById = {}

    items.forEach((it, i) => {
      if (it.description.trim() === '' && it.unitPrice.trim() === '') return // empty row, ignore
      const qty = parseQuantityMilli(it.quantity)
      const unit = parseRandsToCents(it.unitPrice)
      if (it.description.trim() === '') problems.push(`Item ${i + 1}: add a description.`)
      if (qty === null || qty <= 0) problems.push(`Item ${i + 1}: quantity must be more than 0.`)
      if (unit === null) problems.push(`Item ${i + 1}: the price is not a valid amount.`)
      if (qty !== null && qty > 0 && unit !== null) {
        const total = lineTotalCents(qty, unit)
        lines.push({ item: it, index: i, qtyMilli: qty, unitCents: unit, totalCents: total })
        lineById[it.key] = total
      }
    })
    if (lines.length === 0 && problems.length === 0) problems.push('Add at least one item.')

    const labour = parseRandsToCents(form.labour)
    const transport = parseRandsToCents(form.transport)
    const discount = parseRandsToCents(form.discount)
    if (labour === null) problems.push('Labour is not a valid amount.')
    if (transport === null) problems.push('Transport is not a valid amount.')
    if (discount === null) problems.push('Discount is not a valid amount.')

    const vatRate = Number(String(form.vatRate).replace(',', '.'))
    const vatRateOk = String(form.vatRate).trim() !== '' && vatRate >= 0 && vatRate <= 100
    if (form.vatEnabled && !vatRateOk) {
      problems.push('VAT rate must be between 0 and 100.')
    }
    if (form.title.trim() === '') problems.push('Add a quotation title.')
    if (form.customerId === '') problems.push('Select a customer.')

    const totals = calcTotals({
      lineCents: lines.map((l) => l.totalCents),
      labourCents: labour ?? 0,
      transportCents: transport ?? 0,
      discountCents: discount ?? 0,
      vatEnabled: form.vatEnabled,
      vatRatePercent: vatRateOk ? vatRate : 0,
    })
    return { problems, lines, lineById, labour: labour ?? 0, transport: transport ?? 0, vatRate, vatRateOk, totals }
  }, [items, form])

  // ---- quick new customer ----
  async function createCustomer(e) {
    e.preventDefault()
    if (newCust.name.trim() === '') {
      setCustError('Enter the customer’s name.')
      return
    }
    const { data, error } = await supabase
      .from('customers')
      .insert({
        business_id: business.id,
        name: newCust.name.trim(),
        phone: clean(newCust.phone),
        email: clean(newCust.email),
      })
      .select('id, name')
      .single()
    if (error) {
      setCustError(error.message)
      return
    }
    setCustomers((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)))
    setField('customerId', data.id)
    setNewCust(null)
    setCustError('')
  }

  // ---- save ----
  async function handleSave(e) {
    e.preventDefault()
    setShowErrors(true)
    setSaveError('')
    setJustSaved(false)
    if (calc.problems.length > 0) return

    setSaving(true)
    const t = calc.totals
    const header = {
      customer_id: form.customerId,
      title: form.title.trim(),
      status: form.status,
      issue_date: form.issueDate,
      expiry_date: form.expiryDate || null,
      vat_enabled: form.vatEnabled,
      vat_rate: form.vatEnabled ? calc.vatRate : Number(business.vat_rate),
      labour_cents: calc.labour,
      transport_cents: calc.transport,
      discount_cents: t.discountCents,
      subtotal_cents: t.subtotalCents,
      vat_cents: t.vatCents,
      total_cents: t.totalCents,
      notes: clean(form.notes),
      terms: clean(form.terms),
    }
    const makeRows = (quotationId) =>
      calc.lines.map((l, i) => ({
        business_id: business.id,
        quotation_id: quotationId,
        kind: l.item.kind,
        description: l.item.description.trim(),
        quantity: l.qtyMilli / 1000,
        unit_price_cents: l.unitCents,
        sort_order: i,
      }))

    try {
      if (isNew) {
        const num = await supabase.rpc('generate_quote_number')
        if (num.error) throw num.error
        const created = await supabase
          .from('quotations')
          .insert({ ...header, business_id: business.id, quote_number: num.data })
          .select('id')
          .single()
        if (created.error) throw created.error
        const added = await supabase.from('quotation_items').insert(makeRows(created.data.id))
        if (added.error) {
          await supabase.from('quotations').delete().eq('id', created.data.id) // don't leave an empty quote behind
          throw added.error
        }
        setSaving(false)
        navigate(`/quotations/${created.data.id}`, { replace: true })
      } else {
        // Safe order: add the new items first, then update the quotation, then remove the old items.
        // If any step fails, nothing the customer already had is lost.
        const added = await supabase.from('quotation_items').insert(makeRows(id)).select('id')
        if (added.error) throw added.error
        const newIds = added.data.map((r) => r.id)
        const updated = await supabase.from('quotations').update(header).eq('id', id)
        if (updated.error) {
          await supabase.from('quotation_items').delete().in('id', newIds)
          throw updated.error
        }
        if (oldItemIds.length > 0) {
          const removed = await supabase.from('quotation_items').delete().in('id', oldItemIds)
          if (removed.error) throw removed.error
        }
        setOldItemIds(newIds)
        setSavedSnapshot(snapshotOf(form, items))
        setJustSaved(true)
        setSaving(false)
      }
    } catch (err) {
      setSaveError(err.message || 'Something went wrong while saving.')
      setSaving(false)
    }
  }

  // mode is 'download' or 'share'
  async function makePdf(mode) {
    setPdfBusy(true)
    setPdfMessage('')
    try {
      const { blob, filename } = await buildQuotePdf(id)
      if (mode === 'download') {
        downloadBlob(blob, filename)
      } else {
        const file = new File([blob], filename, { type: 'application/pdf' })
        let shared = false
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Quotation ${quoteNumber}`,
              text: `Quotation ${quoteNumber} from ${business.name}`,
            })
            shared = true
          } catch (err) {
            if (err.name === 'AbortError') shared = true // the person closed the share menu: that's fine
          }
        }
        if (!shared) {
          downloadBlob(blob, filename)
          setPdfMessage('Sharing is not available here, so the PDF was downloaded instead.')
        }
      }
    } catch (err) {
      setPdfMessage(`Could not create the PDF: ${err.message}`)
    }
    setPdfBusy(false)
  }

  async function convertToJob() {
    setJobBusy(true)
    setJobError('')
    const existing = await supabase.from('jobs').select('id').eq('quotation_id', id).maybeSingle()
    if (existing.error) {
      setJobError(existing.error.message)
      setJobBusy(false)
      return
    }
    if (existing.data) {
      navigate(`/jobs/${existing.data.id}`)
      return
    }
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        business_id: business.id,
        customer_id: form.customerId || null,
        quotation_id: id,
        title: form.title.trim(),
        status: 'not_started',
      })
      .select('id')
      .single()
    if (error) {
      setJobError(error.message)
      setJobBusy(false)
      return
    }
    navigate(`/jobs/${data.id}`)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete quotation ${quoteNumber}? This cannot be undone.`)) return
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) setSaveError(error.message)
    else navigate('/quotations')
  }

  if (loading) return <p className="muted">Loading…</p>
  if (loadError) {
    return (
      <div>
        <Link to="/quotations" className="back-link">← Quotations</Link>
        <div className="alert alert-error">{loadError}</div>
      </div>
    )
  }

  const t = calc.totals
  const dirty = !isNew && savedSnapshot !== '' && snapshotOf(form, items) !== savedSnapshot

  return (
    <div>
      <Link to="/quotations" className="back-link">← Quotations</Link>
      <h1 className="page-title">{isNew ? 'New quotation' : `Quotation ${quoteNumber}`}</h1>

      <form className="editor" onSubmit={handleSave} noValidate>
        {/* ---- customer and basics ---- */}
        <div className="card">
          <h2>Customer and details</h2>
          <div className="inline-row">
            <label className="field">
              <span>Customer *</span>
              <select value={form.customerId} onChange={(e) => setField('customerId', e.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNewCust({ name: '', phone: '', email: '' })
                setCustError('')
              }}
            >
              + New
            </button>
          </div>

          {newCust && (
            <div className="mini-form">
              {custError && <div className="alert alert-error">{custError}</div>}
              <label className="field">
                <span>Customer name *</span>
                <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input type="tel" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setNewCust(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={createCustomer}>Add customer</button>
              </div>
            </div>
          )}

          <label className="field">
            <span>Quotation title / description of work *</span>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Double steel driveway gate with motor"
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.issueDate} onChange={(e) => setField('issueDate', e.target.value)} />
            </label>
            <label className="field">
              <span>Expiry date</span>
              <input type="date" value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* ---- materials and services ---- */}
        <div className="card">
          <h2>Materials and services</h2>
          {items.map((it, i) => (
            <div className="line-item" key={it.key}>
              <div className="line-grid">
                <label className="field desc">
                  <span>Item {i + 1} description</span>
                  <input
                    value={it.description}
                    onChange={(e) => setItem(it.key, 'description', e.target.value)}
                    placeholder="e.g. 50x50 square tubing, 6m"
                  />
                </label>
                <label className="field wide">
                  <span>Type</span>
                  <select value={it.kind} onChange={(e) => setItem(it.key, 'kind', e.target.value)}>
                    <option value="material">Material</option>
                    <option value="service">Service</option>
                  </select>
                </label>
                <label className="field">
                  <span>Quantity</span>
                  <input
                    inputMode="decimal"
                    value={it.quantity}
                    onChange={(e) => setItem(it.key, 'quantity', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Unit price (R)</span>
                  <input
                    inputMode="decimal"
                    value={it.unitPrice}
                    onChange={(e) => setItem(it.key, 'unitPrice', e.target.value)}
                    placeholder="0.00"
                  />
                </label>
              </div>
              <div className="line-foot">
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={items.length === 1}
                  onClick={() => setItems((list) => list.filter((x) => x.key !== it.key))}
                >
                  Remove
                </button>
                <span className="line-total">{formatZAR(calc.lineById[it.key] ?? 0)}</span>
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setItems((list) => [...list, blankItem()])}>
            + Add item
          </button>
        </div>

        {/* ---- extra costs ---- */}
        <div className="card">
          <h2>Labour, transport and discount</h2>
          <div className="two-col">
            <label className="field">
              <span>Labour (R)</span>
              <input inputMode="decimal" value={form.labour} onChange={(e) => setField('labour', e.target.value)} placeholder="0.00" />
            </label>
            <label className="field">
              <span>Transport (R)</span>
              <input inputMode="decimal" value={form.transport} onChange={(e) => setField('transport', e.target.value)} placeholder="0.00" />
            </label>
          </div>
          <label className="field">
            <span>Discount (R)</span>
            <input inputMode="decimal" value={form.discount} onChange={(e) => setField('discount', e.target.value)} placeholder="0.00" />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.vatEnabled} onChange={(e) => setField('vatEnabled', e.target.checked)} />
            Add VAT to this quotation
          </label>
          {form.vatEnabled && (
            <>
              <label className="field">
                <span>VAT rate (%)</span>
                <input inputMode="decimal" value={form.vatRate} onChange={(e) => setField('vatRate', e.target.value)} />
              </label>
              {!calc.vatRateOk && (
                <div className="alert alert-error">Enter a VAT rate between 0 and 100 (for example 15).</div>
              )}
            </>
          )}
        </div>

        {/* ---- live totals ---- */}
        <div className="card totals">
          <h2>Totals</h2>
          <div className="totals-row"><span>Materials and services</span><span>{formatZAR(t.itemsCents)}</span></div>
          <div className="totals-row"><span>Labour</span><span>{formatZAR(calc.labour)}</span></div>
          <div className="totals-row"><span>Transport</span><span>{formatZAR(calc.transport)}</span></div>
          <div className="totals-row"><span>Subtotal</span><span>{formatZAR(t.subtotalCents)}</span></div>
          {t.discountCents > 0 && (
            <div className="totals-row"><span>Discount</span><span>-{formatZAR(t.discountCents)}</span></div>
          )}
          {form.vatEnabled && (
            <div className="totals-row">
              {calc.vatRateOk ? (
                <>
                  <span>VAT ({form.vatRate}%)</span>
                  <span>{formatZAR(t.vatCents)}</span>
                </>
              ) : (
                <>
                  <span>VAT (rate not valid)</span>
                  <span>—</span>
                </>
              )}
            </div>
          )}
          <div className="totals-row grand"><span>Total</span><span>{formatZAR(t.totalCents)}</span></div>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Prices are entered excluding VAT. The discount comes off before VAT is added.
          </p>
        </div>

        {/* ---- notes and terms ---- */}
        <div className="card">
          <h2>Notes and payment terms</h2>
          <label className="field">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </label>
          <label className="field">
            <span>Payment terms and conditions</span>
            <textarea value={form.terms} onChange={(e) => setField('terms', e.target.value)} />
          </label>
        </div>

        {!isNew && form.status === 'accepted' && (
          <div className="card">
            <h2>Job</h2>
            {jobId ? (
              <Link to={`/jobs/${jobId}`} className="btn btn-primary">View job</Link>
            ) : dirty ? (
              <p className="muted">Save your changes first, then you can convert this accepted quotation into a job.</p>
            ) : (
              <>
                <p className="muted">This quotation is accepted. Turn it into a job to start tracking the work.</p>
                <button type="button" className="btn btn-primary" onClick={convertToJob} disabled={jobBusy || saving}>
                  {jobBusy ? 'Creating job…' : 'Convert to job'}
                </button>
              </>
            )}
            {jobError && <div className="alert alert-error" style={{ marginTop: 12 }}>{jobError}</div>}
          </div>
        )}

        <div className="card">
          <h2>PDF quotation</h2>
          {isNew ? (
            <p className="muted">Save the quotation first, then you can download or share its PDF.</p>
          ) : (
            <>
              {dirty && (
                <p className="muted">You have unsaved changes. Save them first so the PDF matches.</p>
              )}
              <div className="pdf-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={dirty || pdfBusy || saving}
                  onClick={() => makePdf('download')}
                >
                  {pdfBusy ? 'Preparing…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={dirty || pdfBusy || saving}
                  onClick={() => makePdf('share')}
                >
                  Share (WhatsApp, email…)
                </button>
              </div>
              {pdfMessage && <div className="alert alert-error" style={{ marginTop: 12 }}>{pdfMessage}</div>}
            </>
          )}
        </div>

        {showErrors && calc.problems.length > 0 && (
          <div className="alert alert-error">
            Please fix these before saving:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {calc.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}
        {saveError && <div className="alert alert-error">{saveError}</div>}
        {justSaved && !dirty && <div className="alert alert-ok">Quotation saved.</div>}

        <div className="save-bar">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save quotation'}
          </button>
          {!isNew && (
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
