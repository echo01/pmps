import { BarChart3, ClipboardList, Gauge } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { can } from '../auth/permission';

const menu = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge, permission: 'SearchReport' },
  { to: '/reports', label: 'Reports', icon: ClipboardList, permission: 'SearchReport' },
];

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark"><BarChart3 size={22} /></div>
        <div>
          <strong>PMPS</strong>
          <span>Production Reports</span>
        </div>
      </div>

      <nav className="navMenu">
        {menu
          .filter((item) => can(item.permission, user?.permissions || []))
          .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'navItem active' : 'navItem'}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
      </nav>
    </aside>
  );
}
