import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { rolesApi } from '../../api/roles.api';
import { usersApi } from '../../api/users.api';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';

export function UserDetailPage() {
  const { userId = '' } = useParams();

  const user = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  });

  const roles = useQuery({
    queryKey: ['admin-user-roles', userId],
    queryFn: () => usersApi.getUserRoles(userId),
    enabled: !!userId,
  });

  const permissions = useQuery({
    queryKey: ['admin-user-permissions', roles.data?.map((role) => role.id).join(',')],
    enabled: !!roles.data?.length,
    queryFn: async () => {
      const rolePermissions = await Promise.all(
        (roles.data || []).map((role) => rolesApi.getRolePermissions(role.id))
      );
      const unique = new Map(rolePermissions.flat().map((permission) => [permission.permission_code, permission]));
      return [...unique.values()].sort((a, b) => a.permission_code.localeCompare(b.permission_code));
    },
  });

  return (
    <div className="pageStack">
      <div>
        <Link className="backLink" to="/admin/users"><ArrowLeft size={16} /> Back to User Management</Link>
        <span className="eyebrow">Security Administration</span>
        <h1>{user.data?.username || 'User Detail'}</h1>
      </div>

      {user.isLoading ? <LoadingPanel /> : null}
      {user.error ? <ErrorAlert error={user.error} /> : null}

      {user.data ? (
        <section className="panel">
          <dl className="kvGrid">
            <div><dt>Username</dt><dd>{user.data.username}</dd></div>
            <div><dt>Full Name</dt><dd>{user.data.full_name}</dd></div>
            <div><dt>Status</dt><dd><span className={`badge ${user.data.active ? 'active' : 'rejected'}`}>{user.data.active ? 'ACTIVE' : 'LOCKED'}</span></dd></div>
            <div><dt>Failed Logins</dt><dd>{user.data.failed_login_count ?? 0}</dd></div>
            <div><dt>Employee</dt><dd>{user.data.employee_code || '-'}</dd></div>
            <div><dt>Department</dt><dd>{user.data.department || '-'}</dd></div>
            <div><dt>Email</dt><dd>{user.data.email || '-'}</dd></div>
            <div><dt>Password Changed</dt><dd>{user.data.password_changed_at ? new Date(user.data.password_changed_at).toLocaleString() : '-'}</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="panel">
        <div className="sectionHeader">
          <h2>Roles</h2>
          <Link className="textButton" to="/admin/users">Edit Roles</Link>
        </div>
        {roles.error ? <ErrorAlert error={roles.error} /> : null}
        <div className="chipList">
          {roles.data?.map((role) => <span className="badge active" key={role.id}>{role.role_code}</span>)}
          {!roles.data?.length ? <span className="mutedText">No role assigned</span> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Permissions</h2>
        {permissions.error ? <ErrorAlert error={permissions.error} /> : null}
        <div className="permissionGrid">
          {permissions.data?.map((permission) => (
            <span className="badge" key={permission.id}>{permission.permission_code}</span>
          ))}
          {!permissions.data?.length && roles.data?.length ? <span className="mutedText">No permissions on assigned roles</span> : null}
          {!roles.data?.length ? <span className="mutedText">Assign roles to see permissions</span> : null}
        </div>
      </section>
    </div>
  );
}
