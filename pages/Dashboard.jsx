import { Link } from 'react-router-dom'

// Placeholder numbers. These get connected to the database in Phase 2.
const stats = [
  { label: 'Customers', value: 0 },
  { label: 'Quotations', value: 0 },
  { label: 'Active jobs', value: 0 },
]

export default function Dashboard() {
  return (
    <div>
      <p className="muted">Welcome back 👋</p>
      <h1 className="page-title">Your Business Name</h1>

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
