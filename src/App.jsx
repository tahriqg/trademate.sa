import { Routes, Route } from 'react-router-dom'
import AuthProvider from './context/AuthProvider.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import Quotations from './pages/Quotations.jsx'
import QuoteEditor from './pages/QuoteEditor.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Settings from './pages/Settings.jsx'
import SecurityTest from './pages/SecurityTest.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/quotations" element={<Quotations />} />
          <Route path="/quotations/new" element={<QuoteEditor />} />
          <Route path="/quotations/:id" element={<QuoteEditor />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/settings" element={<Settings />} />
          {/* Temporary developer page. Remove before launch. */}
          <Route path="/security-test" element={<SecurityTest />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
