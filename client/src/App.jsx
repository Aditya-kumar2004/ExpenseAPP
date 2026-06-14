import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import { AuthProvider, useAuth } from './context/AuthContext'
import { setApiHandlers } from './lib/api'
import Navbar from './components/Navbar'

import LoginPage        from './pages/LoginPage'
import RegisterPage     from './pages/RegisterPage'
import GroupsPage       from './pages/GroupsPage'
import NewGroupPage     from './pages/NewGroupPage'
import GroupDashboard   from './pages/GroupDashboard'
import ExpenseListPage  from './pages/ExpenseListPage'
import NewExpensePage   from './pages/NewExpensePage'
import ImportWizardPage from './pages/ImportWizardPage'
import ExpenseDetailPage from './pages/ExpenseDetailPage'
import SettlePage       from './pages/SettlePage'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppInner() {
  const { user, getAccessToken, refreshToken, logout } = useAuth()

  // Wire up axios interceptors with auth functions
  useEffect(() => {
    setApiHandlers({ getToken: getAccessToken, refreshFn: refreshToken, onLogout: logout })
  }, [getAccessToken, refreshToken, logout])

  return (
    <div className="min-h-screen bg-surface-950">
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/login"    element={user ? <Navigate to="/groups" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/groups" replace /> : <RegisterPage />} />

        {/* Protected */}
        <Route path="/groups"          element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
        <Route path="/groups/new"      element={<ProtectedRoute><NewGroupPage /></ProtectedRoute>} />
        <Route path="/groups/:id"      element={<ProtectedRoute><GroupDashboard /></ProtectedRoute>} />
        <Route path="/groups/:id/expenses" element={<ProtectedRoute><ExpenseListPage /></ProtectedRoute>} />
        <Route path="/groups/:id/expenses/new" element={<ProtectedRoute><NewExpensePage /></ProtectedRoute>} />
        <Route path="/groups/:id/import"  element={<ProtectedRoute><ImportWizardPage /></ProtectedRoute>} />
        <Route path="/groups/:id/settle"  element={<ProtectedRoute><SettlePage /></ProtectedRoute>} />
        <Route path="/expenses/:id"   element={<ProtectedRoute><ExpenseDetailPage /></ProtectedRoute>} />

        {/* Default */}
        <Route path="/" element={<Navigate to={user ? '/groups' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color:      '#f1f5f9',
              border:     '1px solid #334155',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
