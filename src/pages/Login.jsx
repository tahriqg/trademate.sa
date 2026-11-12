import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/authContext.js'
import '../auth.css'

const SUBTITLES = {
  login: 'Log in to your account',
  signup: 'Create your business account',
  forgot: 'Reset your password',
}

export default function Login() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState('login') // 'login', 'signup' or 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (!loading && session) return <Navigate to="/" replace />

  function switchTo(next) {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    } else if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { business_name: businessName.trim() } },
      })
      if (err) setError(err.message)
      else if (!data.session) setMessage('Account created. Check your email to confirm it, then log in.')
    } else {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) setError(err.message)
      else setMessage('If that email has an account, a reset link is on its way. Check your inbox and spam folder.')
    }
    setBusy(false)
  }

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-brand">Trade<span>Mate</span> SA</h1>
        <p className="login-sub">{SUBTITLES[mode]}</p>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-ok">{message}</div>}

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <label className="field">
              <span>Business name</span>
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Cape Gates & Welding" required />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" required />
          </label>
          {!isForgot && (
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={8} required />
            </label>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : isForgot ? 'Send reset link' : 'Log in'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="switch">
            <button type="button" className="link-btn" onClick={() => switchTo('forgot')}>
              Forgot your password?
            </button>
          </p>
        )}
        <p className="switch">
          {isForgot ? (
            <button type="button" className="link-btn" onClick={() => switchTo('login')}>Back to log in</button>
          ) : (
            <>
              {isSignup ? 'Already have an account? ' : 'New to TradeMate SA? '}
              <button type="button" className="link-btn" onClick={() => switchTo(isSignup ? 'login' : 'signup')}>
                {isSignup ? 'Log in' : 'Create an account'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
