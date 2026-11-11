import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

async function loadDashboard() {
  const count = { count: 'exact', head: true }
  const [biz, customers, quotations, jobs] = await Promise.all([
    supabase.from('businesses').select('name').maybeSingle(),
    supabase.from('customers').select('*', count),
    supabase.from('quotations').select('*', count),
    supabase.from('jobs').select('*', count).in('status', ['not_started', 'in_progress']),
  ])
  return {
    businessName: biz.data?.name ?? 'Your Business',
    customers: customers.count ?? 0,
    quotations: quotations.count ?? 0,
    jobs: jobs.count ?? 0,
    error: biz.error?.message || customers.error?.message || quotations.error?.message || jobs.error?.message || '',
  }
}

export default function Dashboard() {
  const [data, setData] = useState({ businessName: '…', customers: 0, quotations: 0, jobs: 0, error: '' })

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
        <Link to="/quotations" className="btn btn-primary">+ New quotation</Link>
        <Link to="/customers" className="btn">+ Add customer</Link>
        <Link to="/jobs" className="btn">View jobs</Link>
      </div>

      <h2 className="section-title">Recent activity</h2>
      <div className="card empty">
        <p>No activity yet. Add your first customer or quotation to get started.</p>
      </div>
    </div>
  )
}
