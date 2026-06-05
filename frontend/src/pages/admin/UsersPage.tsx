import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Lock, Plus, Shield, Unlock, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { rolesApi } from '../../api/roles.api';
import { CreateUserPayload, ManagedUser, usersApi } from '../../api/users.api';
import { useAuth } from '../../auth/useAuth';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';

const emptyUserForm: CreateUserPayload = {
  username: '',
  password: '',
  employee_code: '',
  full_name: '',
  department: '',
  email: '',
  active: true,
};

function cleanText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [filters, setFilters] = useState({ search: '', active: 'all' });
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userForm, setUserForm] = useState<CreateUserPayload>(emptyUserForm);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () =>
      usersApi.getUsers({
        search: filters.search || undefined,
        active: filters.active === 'all' ? undefined : filters.active,
      }),
  });

  const roles = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => rolesApi.getRoles(),
  });

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        username: userForm.username.trim(),
        password: userForm.password,
        employee_code: cleanText(userForm.employee_code),
        full_name: userForm.full_name.trim(),
        department: cleanText(userForm.department),
        email: cleanText(userForm.email),
        active: userForm.active,
      };

      if (editingUser) {
        return usersApi.updateUser(editingUser.id, {
          employee_code: payload.employee_code,
          full_name: payload.full_name,
          department: payload.department,
          email: payload.email,
          active: payload.active,
        });
      }

      return usersApi.createUser(payload);
    },
    onSuccess: (row) => {
      setSelectedUser(row);
      setUserModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => {
      if (passwordForm.password !== passwordForm.confirm) {
        throw new Error('Password confirmation does not match');
      }
      if (!selectedUser) throw new Error('Select a user first');
      return usersApi.resetPassword(selectedUser.id, passwordForm.password);
    },
    onSuccess: () => {
      setPasswordModalOpen(false);
      setPasswordForm({ password: '', confirm: '' });
    },
  });

  const lockMutation = useMutation({
    mutationFn: (row: ManagedUser) => (row.active ? usersApi.lockUser(row.id) : usersApi.unlockUser(row.id)),
    onSuccess: (row) => {
      setSelectedUser(row);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: () => {
      if (!selectedUser) throw new Error('Select a user first');
      return usersApi.updateUserRoles(selectedUser.id, roleIds);
    },
    onSuccess: () => {
      setRoleModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
    },
  });

  function openCreate() {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setLocalError(null);
    setUserModalOpen(true);
  }

  function openEdit(row: ManagedUser) {
    setEditingUser(row);
    setUserForm({
      username: row.username,
      password: '',
      employee_code: row.employee_code || '',
      full_name: row.full_name || '',
      department: row.department || '',
      email: row.email || '',
      active: row.active,
    });
    setLocalError(null);
    setUserModalOpen(true);
  }

  async function openRoles(row: ManagedUser) {
    setSelectedUser(row);
    setLocalError(null);
    const assignedRoles = await queryClient.fetchQuery({
      queryKey: ['admin-user-roles', row.id],
      queryFn: () => usersApi.getUserRoles(row.id),
    });
    setRoleIds(assignedRoles.map((role) => role.id));
    setRoleModalOpen(true);
  }

  function submitUser() {
    if (!userForm.username.trim() && !editingUser) return setLocalError('Username is required');
    if (!editingUser && userForm.password.length < 8) return setLocalError('Password must be at least 8 characters');
    if (!userForm.full_name.trim()) return setLocalError('Full name is required');
    setLocalError(null);
    saveUserMutation.mutate();
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Security Administration</span>
          <h1>User Management</h1>
        </div>
        <button className="primaryButton" type="button" onClick={openCreate}><Plus size={16} /> Add User</button>
      </div>

      <form
        className="filters adminFilters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ search, active });
        }}
      >
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="username, name, employee, email" /></label>
        <label>Status<select value={active} onChange={(event) => setActive(event.target.value)}><option value="all">All</option><option value="true">Active</option><option value="false">Locked / Inactive</option></select></label>
        <button className="primaryButton" type="submit">Search</button>
      </form>

      <section className="panel">
        {users.isLoading ? <LoadingPanel /> : null}
        {users.error ? <ErrorAlert error={users.error} /> : null}
        {users.data?.length === 0 ? <EmptyState /> : null}
        {users.data?.length ? (
          <div className="tableScroll">
            <table>
              <thead>
                <tr><th>Username</th><th>Name</th><th>Department</th><th>Email</th><th>Status</th><th>Failed</th><th>Action</th></tr>
              </thead>
              <tbody>
                {users.data.map((row) => {
                  const isSelf = currentUser?.id === row.id;
                  return (
                    <tr key={row.id} className={selectedUser?.id === row.id ? 'selectedRow' : undefined}>
                      <td><Link to={`/admin/users/${row.id}`}>{row.username}</Link></td>
                      <td>{row.full_name}</td>
                      <td>{row.department || '-'}</td>
                      <td>{row.email || '-'}</td>
                      <td><span className={`badge ${row.active ? 'active' : 'rejected'}`}>{row.active ? 'ACTIVE' : 'LOCKED'}</span></td>
                      <td>{row.failed_login_count ?? 0}</td>
                      <td>
                        <div className="rowActions">
                          <button className="textButton" type="button" onClick={() => openEdit(row)}><Edit size={15} /> Edit</button>
                          <button className="textButton" type="button" onClick={() => openRoles(row)}><Shield size={15} /> Roles</button>
                          <button className="textButton" type="button" onClick={() => { setSelectedUser(row); setPasswordModalOpen(true); }}><KeyRound size={15} /> Reset</button>
                          <button className="textButton" type="button" disabled={isSelf && row.active} onClick={() => lockMutation.mutate(row)}>
                            {row.active ? <Lock size={15} /> : <Unlock size={15} />} {row.active ? 'Lock' : 'Unlock'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <MasterDataFormModal open={userModalOpen} title={editingUser ? 'Edit User' : 'Create User'} saving={saveUserMutation.isPending} error={saveUserMutation.error || (localError ? new Error(localError) : null)} onClose={() => setUserModalOpen(false)} onSubmit={submitUser}>
        <div className="formGrid modalGrid">
          <label>Username<input value={userForm.username} disabled={!!editingUser} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} /></label>
          {!editingUser ? <label>Password<input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label> : null}
          <label>Full Name<input value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} /></label>
          <label>Employee Code<input value={userForm.employee_code || ''} onChange={(event) => setUserForm({ ...userForm, employee_code: event.target.value })} /></label>
          <label>Department<input value={userForm.department || ''} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })} /></label>
          <label>Email<input value={userForm.email || ''} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
          <label>Status<select value={String(userForm.active)} onChange={(event) => setUserForm({ ...userForm, active: event.target.value === 'true' })}><option value="true">Active</option><option value="false">Locked / Inactive</option></select></label>
        </div>
      </MasterDataFormModal>

      <MasterDataFormModal open={roleModalOpen} title={`Assign Roles${selectedUser ? `: ${selectedUser.username}` : ''}`} submitLabel="Save Roles" saving={roleMutation.isPending} error={roleMutation.error || (localError ? new Error(localError) : null)} onClose={() => setRoleModalOpen(false)} onSubmit={() => roleMutation.mutate()}>
        <div className="permissionGrid">
          {roles.data?.map((role) => (
            <label className="checkRow" key={role.id}>
              <input type="checkbox" checked={roleIds.includes(role.id)} onChange={(event) => setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} />
              <span><strong>{role.role_code}</strong> {role.role_name}</span>
            </label>
          ))}
        </div>
      </MasterDataFormModal>

      <MasterDataFormModal open={passwordModalOpen} title={`Reset Password${selectedUser ? `: ${selectedUser.username}` : ''}`} submitLabel="Reset Password" saving={passwordMutation.isPending} error={passwordMutation.error} onClose={() => setPasswordModalOpen(false)} onSubmit={() => passwordMutation.mutate()}>
        <label>New Password<input type="password" value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} /></label>
        <label>Confirm Password<input type="password" value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} /></label>
      </MasterDataFormModal>
    </div>
  );
}
