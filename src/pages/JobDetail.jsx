import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { JOB_STATUS } from '../lib/jobStatus.js'
import { formatZAR } from '../lib/money.js'
import '../customers.css'
import '../quotes.css'
import '../jobs.css'

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [job, setJob] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [quote, setQuote] = useState(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const j = await supabase.from('jobs').select('*').eq('id', id).maybeSingle()
      if (!active) return
      if (j.error || !j.data) {
        setError(j.error?.message || 'Job not found.')
        setLoading(false)
        return
      }
      const none = Promise.resolve({ data: null })
      const [c, q] = await Promise.all([
        j.data.customer_id ? supabase.from('customers').select('*').eq('id', j.data.customer_id).maybeSingle() : none,
        j.data.quotation_id
          ? supabase.from('quotations').select('id, quote_number, total_cents').eq('id', j.data.quotation_id).maybeSingle()
          : none,
      ])
      if (!active) return
      setJob(j.data)
      setTitle(j.data.title)
      setNotes(j.data.notes ?? '')
      setCustomer(c.data)
      setQuote(q.data)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [id])

  async function update(changes, okMessage) {
    setBusy(true)
    setMessage('')
    setError('')
    const { error: err } = await supabase.from('jobs').update(changes).eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return false
    }
    setJob((old) => ({ ...old, ...changes }))
    setMessage(okMessage)
    return true
  }

  async function saveDetails(e) {
    e.preventDefault()
    if (title.trim() === '') return setError('Please enter a job title.')
    await update({ title: title.trim(), notes: notes.trim() === '' ? null : notes.trim() }, 'Job saved.')
  }

  async function handleDelete() {
    if (!window.confirm('Delete this job? The quotation is not deleted.')) return
    const { error: err } = await supabase.from('jobs').delete().eq('id', id)
    if (err) setError(err.message)
    else navigate('/jobs')
  }

  if (loading) return <p className="muted">Loading…</p>
  if (!job) {
    return (
      <div>
        <Link to="/jobs" className="back-link">← Jobs</Link>
        <div className="alert alert-error">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <Link to="/jobs" className="back-link">← Jobs</Link>
      <div className="quote-top">
        <h1 className="page-title" style={{ margin: 0 }}>{job.title}</h1>
        <span className={`status status-${job.status}`}>{JOB_STATUS[job.status]}</span>
      </div>

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Job status</h2>
          <div className="status-buttons">
            {Object.entries(JOB_STATUS).map(([value, label]) => (
              <button
                key={value}
                className={`btn ${job.status === value ? 'btn-active' : ''}`}
                disabled={busy}
                onClick={() => update({ status: value }, `Status changed to ${label}.`)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Customer</h2>
          {customer ? (
            <>
              <div className="detail-line"><strong>{customer.name}</strong></div>
              {customer.phone && <div className="detail-line">📞 <a href={`tel:${customer.phone}`}>{customer.phone}</a></div>}
              {customer.email && <div className="detail-line">✉️ <a href={`mailto:${customer.email}`}>{customer.email}</a></div>}
              {customer.address && <div className="detail-line">📍 {customer.address}</div>}
            </>
          ) : (
            <div className="detail-line">No customer linked.</div>
          )}
        </div>

        {quote && (
          <div className="card">
            <h2>Quotation</h2>
            <div className="detail-line">
              <Link to={`/quotations/${quote.id}`} style={{ textDecoration: 'underline' }}>{quote.quote_number}</Link>
              {' · '}{formatZAR(quote.total_cents)}
            </div>
          </div>
        )}

        <form className="card" onSubmit={saveDetails} noValidate>
          <h2>Job details</h2>
          <label className="field">
            <span>Job title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="detail-line">Created {new Date(job.created_at).toLocaleDateString('en-CA')}</div>
          <div className="save-bar" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" disabled={busy}>Save details</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete job</button>
          </div>
        </form>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-ok">{message}</div>}
      </div>
    </div>
  )
}
