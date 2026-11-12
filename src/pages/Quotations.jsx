import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { formatZAR } from '../lib/money.js'
import { STATUS_LABELS } from '../lib/quoteStatus.js'
import '../customers.css'
import '../quotes.css'


async function loadList() {
  const [quotes, customers] = await Promise.all([
    supabase
      .from('quotations')
      .select('id, quote_number, title, status, total_cents, issue_date, customer_id')
      .order('created_at', { ascending: false }),
    supabase.from('customers').select('id, name'),
  ])
  const names = Object.fromEntries((customers.data ?? []).map((c) => [c.id, c.name]))
  return {
    quotes: (quotes.data ?? []).map((q) => ({ ...q, customerName: names[q.customer_id] ?? 'No customer' })),
    error: quotes.error?.message || customers.error?.message || '',
  }
}

export default function Quotations() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    loadList().then((r) => {
      if (!active) return
      setQuotes(r.quotes)
      setError(r.error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const q = search.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return quotes
    return quotes.filter((x) =>
      [x.quote_number, x.title, x.customerName, STATUS_LABELS[x.status]].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      ),
    )
  }, [quotes, q])

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Quotations</h1>
        <Link to="/quotations/new" className="btn btn-primary">+ New quotation</Link>
      </div>

      <input
        className="search"
        type="search"
        placeholder="Search by number, title, customer or status"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted">Loading quotations…</p>
      ) : quotes.length === 0 ? (
        <div className="card empty">
          <p>No quotations yet. Create your first one.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <p>No quotations match “{search}”.</p>
        </div>
      ) : (
        <div className="quote-list">
          {visible.map((x) => (
            <Link to={`/quotations/${x.id}`} className="card quote-card" key={x.id}>
              <div className="quote-top">
                <span className="quote-number">{x.quote_number}</span>
                <span className={`status status-${x.status}`}>{STATUS_LABELS[x.status]}</span>
              </div>
              <div className="quote-title">{x.title}</div>
              <div className="quote-meta">{x.customerName} · {x.issue_date}</div>
              <div className="quote-total">{formatZAR(x.total_cents)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
