import { ShieldAlert } from 'lucide-react';

export function NoPermission() {
  return (
    <div className="statePanel">
      <ShieldAlert size={28} />
      <strong>No Permission</strong>
      <span>Your account does not have permission to view this page.</span>
    </div>
  );
}
