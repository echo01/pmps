import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { rolesApi } from '../../api/roles.api';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';

export function RoleDetailPage() {
  const { roleId = '' } = useParams();
  const queryClient = useQueryClient();
  const [permissionIds, setPermissionIds] = useState<number[]>([]);

  const role = useQuery({
    queryKey: ['admin-role', roleId],
    queryFn: () => rolesApi.getRole(roleId),
    enabled: !!roleId,
  });

  const permissions = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => rolesApi.getPermissions(),
  });

  const assignedPermissions = useQuery({
    queryKey: ['admin-role-permissions', roleId],
    queryFn: () => rolesApi.getRolePermissions(roleId),
    enabled: !!roleId,
  });

  useEffect(() => {
    if (assignedPermissions.data) {
      setPermissionIds(assignedPermissions.data.map((permission) => permission.id));
    }
  }, [assignedPermissions.data]);

  const saveMutation = useMutation({
    mutationFn: () => rolesApi.updateRolePermissions(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-role-permissions', roleId] });
    },
  });

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <Link className="backLink" to="/admin/roles"><ArrowLeft size={16} /> Back to Role Management</Link>
          <span className="eyebrow">Security Administration</span>
          <h1>{role.data?.role_code || 'Role Detail'}</h1>
        </div>
        <button className="primaryButton" type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save size={16} /> {saveMutation.isPending ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>

      {role.isLoading || permissions.isLoading || assignedPermissions.isLoading ? <LoadingPanel /> : null}
      {role.error ? <ErrorAlert error={role.error} /> : null}
      {permissions.error ? <ErrorAlert error={permissions.error} /> : null}
      {assignedPermissions.error ? <ErrorAlert error={assignedPermissions.error} /> : null}
      {saveMutation.error ? <ErrorAlert error={saveMutation.error} title="Unable to save permissions" /> : null}

      {role.data ? (
        <section className="panel">
          <dl className="kvGrid">
            <div><dt>Role Code</dt><dd>{role.data.role_code}</dd></div>
            <div><dt>Role Name</dt><dd>{role.data.role_name}</dd></div>
            <div><dt>Selected Permissions</dt><dd>{permissionIds.length}</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="panel">
        <h2>Permissions</h2>
        {permissions.data?.length === 0 ? <EmptyState message="No permissions found" /> : null}
        <div className="permissionGrid permissionMatrix">
          {permissions.data?.map((permission) => (
            <label className="checkRow permissionOption" key={permission.id}>
              <input
                type="checkbox"
                checked={permissionIds.includes(permission.id)}
                onChange={(event) =>
                  setPermissionIds((current) =>
                    event.target.checked
                      ? [...current, permission.id]
                      : current.filter((id) => id !== permission.id)
                  )
                }
              />
              <span>
                <strong>{permission.permission_code}</strong>
                <small>{permission.permission_name}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
