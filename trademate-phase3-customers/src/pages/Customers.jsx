import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import '../customers.css'

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' }

// Empty text boxes are saved as "nothing" rather than an empty string.
const clean = (value) => (value.trim() === '' ? null : value.trim())

async function loadAll() {
  const [biz, list] = await Promise.all([
    supabase.from('businesses').select('id').maybeSingle(),
    supabase.from('customers').select('*').order('name', { ascending: true }),
  ])
  return {
    businessId: biz.data?.id ?? null,
    customers: list.data ?? [],
    error: biz.error?.message || list.error?.message || '',
  }
}

export default function Customers() {
  const [businessId, setBusinessId] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(null) // null = closed. Has an "id" when editing.
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    loadAll().then((r) => {
      if (!active) return
      setBusinessId(r.businessId)
      setCustomers(r.customers)
      setError(r.error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  async function refresh() {
    const r = await loadAll()
    setBusinessId(r.businessId)
    setCustomers(r.customers)
    setError(r.error)
  }

  const q = search.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return customers
    return customers.filter((c) =>
      [c.name, c.phone, c.email, c.address].some((v) => (v ?? '').toLowerCase().includes(q)),
    )
  }, [customers, q])

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setFormError('')
  }

  function openEdit(c) {
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    })
    setFormError('')
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Please enter the customer’s name.')
      return
    }
    if (!form.id && !businessId) {
      setFormError('Your business could not be loaded. Refresh the page and try again.')
      return
    }
    setSaving(true)
    setFormError('')
    const payload = {
      name: form.name.trim(),
      phone: clean(form.phone),
      email: clean(form.email),
      address: clean(form.address),
      notes: clean(form.notes),
    }
    const result = form.id
      ? await supabase.from('customers').update(payload).eq('id', form.id)
      : await supabase.from('customers').insert({ ...payload, business_id: businessId })
    setSaving(false)
    if (result.error) {
      setFormError(result.error.message)
      return
    }
    setForm(null)
    await refresh()
  }

  async function handleDelete(c) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return
    const { error: err } = await supabase.from('customers').delete().eq('id', c.id)
    if (err) setError(err.message)
    else await refresh()
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Customers</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Add customer</button>
      </div>

      <input
        className="search"
        type="search"
        placeholder="Search by name, phone, email or address"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted">Loading customers…</p>
      ) : customers.length === 0 ? (
        <div className="card empty">
          <p>No customers yet. Add your first customer to get started.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <p>No customers match “{search}”.</p>
        </div>
      ) : (
        <div className="customer-list">
          {visible.map((c) => (
            <div className="card customer-card" key={c.id}>
              <h3 className="customer-name">{c.name}</h3>
              {c.phone && (
                <div className="customer-line">📞 <a href={`tel:${c.phone}`}>{c.phone}</a></div>
              )}
              {c.email && (
                <div className="customer-line">✉️ <a href={`mailto:${c.email}`}>{c.email}</a></div>
              )}
              {c.address && <div className="customer-line">📍 {c.address}</div>}
              {c.notes && <div className="customer-notes">{c.notes}</div>}
              <div className="card-actions">
                <button className="btn btn-small" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(c)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="modal-backdrop">
          <div className="card modal">
            <h2>{form.id ? 'Edit customer' : 'Add customer'}</h2>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleSave}>
              <label className="field">
                <span>Name *</span>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} autoFocus />
              </label>
              <label className="field">
                <span>Phone number</span>
                <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
              </label>
              <label className="field">
                <span>Email address</span>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </label>
              <label className="field">
                <span>Address</span>
                <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setForm(null)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
