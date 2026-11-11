import Placeholder from '../components/Placeholder.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function Settings() {
  return (
    <div>
      <Placeholder title="Business Settings" text="Business details, VAT and quotation numbering go here." />
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
