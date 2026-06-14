import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-surface-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/groups" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <span className="font-bold text-lg tracking-tight">
            <span className="text-gradient">SPlit</span>
          </span>
        </Link>

        {/* User */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-200">{user.name}</span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-sm uppercase">
              {user.name?.[0] || '?'}
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
