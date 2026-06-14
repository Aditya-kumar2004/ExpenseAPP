import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Pages — lazy loaded for performance
const Login        = React.lazy(() => import('./pages/Login'));
const Register     = React.lazy(() => import('./pages/Register'));
const Groups       = React.lazy(() => import('./pages/Groups'));
const NewGroup     = React.lazy(() => import('./pages/NewGroup'));
const GroupDashboard = React.lazy(() => import('./pages/GroupDashboard'));
const NewExpense   = React.lazy(() => import('./pages/NewExpense'));
const ExpenseDetail = React.lazy(() => import('./pages/ExpenseDetail'));
const Settle       = React.lazy(() => import('./pages/Settle'));
const Import       = React.lazy(() => import('./pages/Import'));

// ─── Protected route wrapper ──────────────────────────────────────────────────
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// ─── Guest route (redirect if already authed) ─────────────────────────────────
function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/groups" replace />;
  return <Outlet />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <React.Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            {/* Guest only */}
            <Route element={<GuestOnly />}>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* Protected */}
            <Route element={<RequireAuth />}>
              <Route path="/groups"                        element={<Groups />} />
              <Route path="/groups/new"                    element={<NewGroup />} />
              <Route path="/groups/:id"                    element={<GroupDashboard />} />
              <Route path="/groups/:id/expenses/new"       element={<NewExpense />} />
              <Route path="/groups/:id/settle"             element={<Settle />} />
              <Route path="/groups/:id/import"             element={<Import />} />
              <Route path="/expenses/:id"                  element={<ExpenseDetail />} />
            </Route>

            {/* Root redirect */}
            <Route path="/"  element={<Navigate to="/groups" replace />} />
            <Route path="*"  element={<Navigate to="/groups" replace />} />
          </Routes>
        </React.Suspense>
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
  </React.StrictMode>
);
