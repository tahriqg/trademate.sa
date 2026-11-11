import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// TEMPORARY developer page to prove businesses cannot see each other's data.
// Remove this page (and its route in App.jsx) before launch.

async function fetchVisible() {
  const biz = await supabase.from('businesses').select('id, name')
  const cust = await supabase.from('customers').select('id, name')
  return {
    businesses: biz.data ?? [],
    customers: cust.data ?? [],
    errors: [biz.error?.message, cust.error?.message].filter(Boolean),
  }
}

export default function SecurityTest() {
  const [rows, setRows] = useState(null)
  const [otherId, setOtherId] = useState('')
  const [result, setResult] = useState('')

  useEffect(() => {
    let active = true
    fetchVisible().then((r) => {
      if (active) setRows(r)
    })
    return () => {
      active = false
    }
  }, [])

  async function tryToBreakIn() {
    const id = otherId.trim()
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setResult('Paste the OTHER business ID first (36 characters).')
      return
    }
    const ins = await supabase.from('customers').insert({ business_id: id, name: 'Security test' })
    const upd = await supabase.from('businesses').update({ name: 'HACKED' }).eq('id', id).select()
    setResult(
      [
        ins.error
          ? `Insert into their business: BLOCKED ✅ (${ins.error.message})`
          : 'Insert into their business: ALLOWED ❌ SECURITY PROBLEM',
        upd.error || (upd.data && upd.data.length === 0)
          ? 'Edit their business: BLOCKED ✅ (nothing changed)'
          : 'Edit their business: ALLOWED ❌ SECURITY PROBLEM',
      ].join('\n'),
    )
    setRows(await fetchVisible())
  }

  return (
    <div>
      <h1 className="page-title">Security test</h1>
      <div className="card">
        <p className="muted">What this account can see (should be ONLY its own data):</p>
        {!rows && <p>Loading…</p>}
        {rows && (
          <>
            {rows.errors.length > 0 && <div className="alert alert-error">{rows.errors.join(' | ')}</div>}
            <p><strong>Businesses visible: {rows.businesses.length}</strong></p>
            <ul className="test-list">
              {rows.businesses.map((b) => (
                <li key={b.id}>{b.name}<br /><span className="mono">{b.id}</span></li>
              ))}
            </ul>
            <p><strong>Customers visible: {rows.customers.length}</strong></p>
            <ul className="test-list">
              {rows.customers.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <h2 className="section-title">Try to break in</h2>
      <div className="card">
        <label className="field">
          <span>Business ID of the OTHER account</span>
          <input value={otherId} onChange={(e) => setOtherId(e.target.value)} />
        </label>
        <button className="btn" onClick={tryToBreakIn}>Try to write into their business</button>
        {result && <p className="test-result">{result}</p>}
      </div>
    </div>
  )
}
