import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/authContext.js'
import '../auth.css'

export default function Login() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { business_name: businessName.trim() } },
      })
      if (err) setError(err.message)
      else if (!data.session) setMessage('Account created. Check your email to confirm it, then log in.')
    }
    setBusy(false)
  }

  const isSignup = mode === 'signup'

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-brand">Trade<span>Mate</span> SA</h1>
        <p className="login-sub">
          {isSignup ? 'Create your business account' : 'Log in to your account'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-ok">{message}</div>}

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <label className="field">
              <span>Business name</span>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Cape Gates & Welding"
                required
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="switch">
          {isSignup ? 'Already have an account? ' : 'New to TradeMate SA? '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup')
              setError('')
              setMessage('')
            }}
          >
            {isSignup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  )
}
