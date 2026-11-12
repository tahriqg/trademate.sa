import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { JOB_STATUS } from '../lib/jobStatus.js'
import '../customers.css'
import '../quotes.css'
import '../jobs.css'

async function loadJobs() {
  const [jobs, customers] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, status, created_at, customer_id')
      .order('created_at', { ascending: false }),
    supabase.from('customers').select('id, name'),
  ])
  const names = Object.fromEntries((customers.data ?? []).map((c) => [c.id, c.name]))
  return {
    jobs: (jobs.data ?? []).map((j) => ({ ...j, customerName: names[j.customer_id] ?? 'No customer' })),
    error: jobs.error?.message || customers.error?.message || '',
  }
}

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    loadJobs().then((r) => {
      if (!active) return
      setJobs(r.jobs)
      setError(r.error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const q = search.trim().toLowerCase()
  const visible = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (filter === 'all' || j.status === filter) &&
          (!q || j.title.toLowerCase().includes(q) || j.customerName.toLowerCase().includes(q)),
      ),
    [jobs, filter, q],
  )

  return (
    <div>
      <h1 className="page-title">Jobs</h1>
      <div className="chips">
        {['all', ...Object.keys(JOB_STATUS)].map((s) => (
          <button
            key={s}
            className={`chip ${filter === s ? 'chip-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'All' : JOB_STATUS[s]}
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        placeholder="Search by job or customer"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <p className="muted">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <div className="card empty">
          <p>No jobs yet. Open an accepted quotation and choose “Convert to job”.</p>
          <Link to="/quotations" className="btn">Go to quotations</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty"><p>No jobs match.</p></div>
      ) : (
        <div className="quote-list">
          {visible.map((j) => (
            <Link to={`/jobs/${j.id}`} className="card quote-card" key={j.id}>
              <div className="quote-top">
                <span className="quote-title" style={{ margin: 0 }}>{j.title}</span>
                <span className={`status status-${j.status}`}>{JOB_STATUS[j.status]}</span>
              </div>
              <div className="quote-meta">
                {j.customerName} · started {new Date(j.created_at).toLocaleDateString('en-CA')}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
