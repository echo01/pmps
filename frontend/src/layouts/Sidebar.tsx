import { BarChart3, Boxes, ClipboardCheck, ClipboardList, Factory, Gauge, PackageSearch, Ruler, ShieldCheck, UserCog, UserRound, UsersRound, Wrench } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { can } from '../auth/permission';

const menu = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge, permission: 'SearchReport' },
  { to: '/products/categories', label: 'Product Categories', icon: PackageSearch, permission: 'ProductMaster' },
  { to: '/products/sub-categories', label: 'Sub Categories', icon: PackageSearch, permission: 'ProductMaster' },
  { to: '/products/models', label: 'Product Models', icon: Boxes, permission: 'ProductMaster' },
  { to: '/equipment/types', label: 'Equipment Types', icon: Wrench, permission: 'EquipmentMaster' },
  { to: '/equipment/master', label: 'Equipment Master', icon: Wrench, permission: 'EquipmentMaster' },
  { to: '/equipment/model-required', label: 'Required Equipment', icon: Ruler, permission: 'ModelRequiredEquipment' },
  { to: '/templates', label: 'Test Templates', icon: ClipboardList, permission: 'TestTemplate' },
  { to: '/production-lots', label: 'Production Lots', icon: Factory, permission: 'ProductionLot' },
  { to: '/qc/inspection', label: 'QC Inspection', icon: ClipboardCheck, permission: 'QCInspection' },
  { to: '/qa/sampling', label: 'QA Sampling', icon: ShieldCheck, permission: 'QASampling' },
  { to: '/reports', label: 'Reports', icon: ClipboardList, permission: 'SearchReport' },
  { to: '/admin/users', label: 'Users', icon: UsersRound, permission: 'UserRole' },
  { to: '/admin/roles', label: 'Roles', icon: UserCog, permission: 'UserRole' },
  { to: '/profile', label: 'My Profile', icon: UserRound },
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
          .filter((item) => !item.permission || can(item.permission, user?.permissions || []))
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
