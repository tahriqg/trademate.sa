import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContext.js'

// Only lets logged-in people through. Everyone else goes to the login page.
export default function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="splash">Loading TradeMate SA…</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}
