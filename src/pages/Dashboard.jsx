import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import '../dashboard.css'

const newest = { ascending: false }

async function loadDashboard() {
  const count = { count: 'exact', head: true }
  const [biz, customers, quotations, jobs, recentQ, recentC, recentJ] = await Promise.all([
    supabase.from('businesses').select('name').maybeSingle(),
    supabase.from('customers').select('*', count),
    supabase.from('quotations').select('*', count),
    supabase.from('jobs').select('*', count).in('status', ['not_started', 'in_progress']),
    supabase.from('quotations').select('id, quote_number, title, created_at').order('created_at', newest).limit(5),
    supabase.from('customers').select('id, name, created_at').order('created_at', newest).limit(5),
    supabase.from('jobs').select('id, title, created_at').order('created_at', newest).limit(5),
  ])

  const activity = [
    ...(recentQ.data ?? []).map((q) => ({
      key: `q${q.id}`, icon: '📄', text: `Quotation ${q.quote_number}: ${q.title}`, to: `/quotations/${q.id}`, date: q.created_at,
    })),
    ...(recentC.data ?? []).map((c) => ({
      key: `c${c.id}`, icon: '👥', text: `Customer added: ${c.name}`, to: '/customers', date: c.created_at,
    })),
    ...(recentJ.data ?? []).map((j) => ({
      key: `j${j.id}`, icon: '🔧', text: `Job started: ${j.title}`, to: `/jobs/${j.id}`, date: j.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)

  const failed = [biz, customers, quotations, jobs, recentQ, recentC, recentJ].find((r) => r.error)
  return {
    businessName: biz.data?.name ?? 'Your Business',
    customers: customers.count ?? 0,
    quotations: quotations.count ?? 0,
    jobs: jobs.count ?? 0,
    activity,
    error: failed?.error.message ?? '',
  }
}

export default function Dashboard() {
  const [data, setData] = useState({ businessName: '…', customers: 0, quotations: 0, jobs: 0, activity: [], error: '' })

  useEffect(() => {
    let active = true
    loadDashboard().then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [])

  const stats = [
    { label: 'Customers', value: data.customers },
    { label: 'Quotations', value: data.quotations },
    { label: 'Active jobs', value: data.jobs },
  ]

  return (
    <div>
      <p className="muted">Welcome back 👋</p>
      <h1 className="page-title">{data.businessName}</h1>
      {data.error && <div className="alert alert-error">Could not load data: {data.error}</div>}

      <div className="stats">
        {stats.map((s) => (
          <div className="card stat" key={s.label}>
            <div className="stat-value">{s.value}</div>
            <div className="muted">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Quick actions</h2>
      <div className="actions">
        <Link to="/quotations/new" className="btn btn-primary">+ New quotation</Link>
        <Link to="/customers" className="btn">+ Add customer</Link>
        <Link to="/jobs" className="btn">View jobs</Link>
      </div>

      <h2 className="section-title">Recent activity</h2>
      {data.activity.length === 0 ? (
        <div className="card empty">
          <p>No activity yet. Add your first customer or quotation to get started.</p>
        </div>
      ) : (
        <div className="card activity-list">
          {data.activity.map((a) => (
            <Link to={a.to} className="activity-item" key={a.key}>
              <span className="activity-icon">{a.icon}</span>
              <span className="activity-text">{a.text}</span>
              <span className="activity-date">{new Date(a.date).toLocaleDateString('en-GB')}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
