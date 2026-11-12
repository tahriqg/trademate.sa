import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/authContext.js'
import '../auth.css'

// People land here from the link in the "reset your password" email.
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Your password must be at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError(err.message)
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  if (loading) return <div className="splash">Loading…</div>

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-brand">Trade<span>Mate</span> SA</h1>
        {!session ? (
          <>
            <p className="login-sub">This reset link is invalid or has expired.</p>
            <Link to="/login" className="btn btn-primary btn-block">Back to log in</Link>
          </>
        ) : done ? (
          <div className="alert alert-ok">Password updated. Taking you to your dashboard…</div>
        ) : (
          <>
            <p className="login-sub">Choose a new password</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label className="field">
                <span>New password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" minLength={8} required />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password" minLength={8} required />
              </label>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Please wait…' : 'Save new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
