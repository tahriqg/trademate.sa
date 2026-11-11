import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { fileToLogoDataUrl } from '../lib/logo.js'
import '../settings.css'

const clean = (v) => (v.trim() === '' ? null : v.trim())

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [bizId, setBizId] = useState(null)
  const [f, setF] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('businesses')
      .select('*')
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!active) return
        if (err || !data) {
          setLoadError(err?.message || 'Your business could not be loaded.')
        } else {
          setBizId(data.id)
          setF({
            name: data.name,
            phone: data.phone ?? '',
            email: data.email ?? '',
            address: data.address ?? '',
            logo: data.logo_url ?? '',
            vatEnabled: data.vat_enabled,
            vatRate: String(data.vat_rate),
            vatNumber: data.vat_number ?? '',
            prefix: data.quote_prefix,
            nextNumber: String(data.next_quote_number),
            terms: data.default_terms ?? '',
          })
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function setField(field, value) {
    setF((old) => ({ ...old, [field]: value }))
    setSaved(false)
  }

  async function chooseLogo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      setField('logo', await fileToLogoDataUrl(file))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaved(false)

    const vatRate = Number(String(f.vatRate).replace(',', '.'))
    const nextNumber = Number(f.nextNumber)
    if (f.name.trim() === '') return setError('Please enter your business name.')
    if (String(f.vatRate).trim() === '' || !(vatRate >= 0 && vatRate <= 100)) {
      return setError('VAT rate must be between 0 and 100.')
    }
    if (!/^\d+$/.test(f.nextNumber.trim()) || nextNumber < 1) {
      return setError('The next quotation number must be a whole number, 1 or higher.')
    }
    if (f.prefix.trim().length > 10) return setError('The quotation prefix can be at most 10 characters.')

    setSaving(true)
    const { error: err } = await supabase
      .from('businesses')
      .update({
        name: f.name.trim(),
        phone: clean(f.phone),
        email: clean(f.email),
        address: clean(f.address),
        logo_url: f.logo || null,
        vat_enabled: f.vatEnabled,
        vat_rate: vatRate,
        vat_number: clean(f.vatNumber),
        quote_prefix: f.prefix.trim(),
        next_quote_number: nextNumber,
        default_terms: clean(f.terms),
      })
      .eq('id', bizId)
    setSaving(false)
    if (err) setError(err.message)
    else setSaved(true)
  }

  if (loading) return <p className="muted">Loading settings…</p>
  if (loadError) return <div className="alert alert-error">{loadError}</div>

  return (
    <div>
      <h1 className="page-title">Business Settings</h1>
      <form className="settings-stack" onSubmit={handleSave} noValidate>
        <div className="card">
          <h2>Business details</h2>
          <label className="field">
            <span>Business name *</span>
            <input value={f.name} onChange={(e) => setField('name', e.target.value)} />
          </label>
          <label className="field">
            <span>Phone number</span>
            <input type="tel" value={f.phone} onChange={(e) => setField('phone', e.target.value)} />
          </label>
          <label className="field">
            <span>Email address</span>
            <input type="email" value={f.email} onChange={(e) => setField('email', e.target.value)} />
          </label>
          <label className="field">
            <span>Address</span>
            <textarea value={f.address} onChange={(e) => setField('address', e.target.value)} />
          </label>

          <div className="field">
            <span>Logo (shown on your quotations)</span>
            <div className="logo-box">
              {f.logo ? (
                <img className="logo-preview" src={f.logo} alt="Your logo" />
              ) : (
                <span className="logo-empty">No logo yet</span>
              )}
              <div className="logo-buttons">
                <label className="btn btn-small file-btn">
                  {f.logo ? 'Change logo' : 'Choose logo'}
                  <input type="file" accept="image/*" onChange={chooseLogo} />
                </label>
                {f.logo && (
                  <button type="button" className="btn btn-small btn-danger" onClick={() => setField('logo', '')}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <label className="field">
            <span>Currency</span>
            <input value="ZAR (South African rand)" disabled />
          </label>
        </div>

        <div className="card">
          <h2>VAT</h2>
          <label className="check">
            <input type="checkbox" checked={f.vatEnabled} onChange={(e) => setField('vatEnabled', e.target.checked)} />
            My business charges VAT
          </label>
          <p className="hint">This only sets the starting choice on new quotations. You can still change it on each one.</p>
          <div className="two-col">
            <label className="field">
              <span>VAT rate (%)</span>
              <input inputMode="decimal" value={f.vatRate} onChange={(e) => setField('vatRate', e.target.value)} />
            </label>
            <label className="field">
              <span>VAT registration number</span>
              <input value={f.vatNumber} onChange={(e) => setField('vatNumber', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card">
          <h2>Quotation numbering</h2>
          <div className="two-col">
            <label className="field">
              <span>Prefix</span>
              <input value={f.prefix} onChange={(e) => setField('prefix', e.target.value)} placeholder="Q-" />
            </label>
            <label className="field">
              <span>Next number</span>
              <input inputMode="numeric" value={f.nextNumber} onChange={(e) => setField('nextNumber', e.target.value)} />
            </label>
          </div>
          <p className="hint">
            Example: prefix Q- and next number 12 gives Q-0012. Every quotation number must be unique, so only
            lower the next number if you know it has not been used.
          </p>
        </div>

        <div className="card">
          <h2>Default terms and conditions</h2>
          <label className="field">
            <span>Appears on every new quotation (you can edit it per quotation)</span>
            <textarea value={f.terms} onChange={(e) => setField('terms', e.target.value)} />
          </label>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {saved && <div className="alert alert-ok">Settings saved.</div>}

        <div className="save-bar">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </form>
    </div>
  )
}
