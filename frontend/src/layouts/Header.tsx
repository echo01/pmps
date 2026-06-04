import { LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

export function Header() {
  const { user, logout, refreshMe } = useAuth();

  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">Signed in</span>
        <strong>{user?.full_name || user?.username || '-'}</strong>
      </div>
      <div className="topbarActions">
        <button type="button" className="iconButton" onClick={refreshMe} title="Refresh session">
          <RefreshCw size={17} />
        </button>
        <button type="button" className="textButton" onClick={logout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </header>
  );
}
