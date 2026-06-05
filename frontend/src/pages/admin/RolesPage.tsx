import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Role, rolesApi } from '../../api/roles.api';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';

export function RolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ role_code: '', role_name: '' });
  const [localError, setLocalError] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: ['admin-roles', filterSearch],
    queryFn: () => rolesApi.getRoles({ search: filterSearch || undefined }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingRole) {
        return rolesApi.updateRole(editingRole.id, { role_name: form.role_name.trim() });
      }
      return rolesApi.createRole({
        role_code: form.role_code.trim().toUpperCase(),
        role_name: form.role_name.trim(),
      });
    },
    onSuccess: () => {
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
  });

  function openCreate() {
    setEditingRole(null);
    setForm({ role_code: '', role_name: '' });
    setLocalError(null);
    setModalOpen(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setForm({ role_code: role.role_code, role_name: role.role_name });
    setLocalError(null);
    setModalOpen(true);
  }

  function submit() {
    if (!editingRole && !form.role_code.trim()) return setLocalError('Role code is required');
    if (!form.role_name.trim()) return setLocalError('Role name is required');
    setLocalError(null);
    saveMutation.mutate();
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Security Administration</span>
          <h1>Role Management</h1>
        </div>
        <button className="primaryButton" type="button" onClick={openCreate}><Plus size={16} /> Add Role</button>
      </div>

      <form
        className="filters adminFilters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilterSearch(search);
        }}
      >
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="role code or name" /></label>
        <button className="primaryButton" type="submit">Search</button>
      </form>

      <section className="panel">
        {roles.isLoading ? <LoadingPanel /> : null}
        {roles.error ? <ErrorAlert error={roles.error} /> : null}
        {roles.data?.length === 0 ? <EmptyState /> : null}
        {roles.data?.length ? (
          <div className="tableScroll">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Action</th></tr></thead>
              <tbody>
                {roles.data.map((role) => (
                  <tr key={role.id}>
                    <td><Link to={`/admin/roles/${role.id}`}>{role.role_code}</Link></td>
                    <td>{role.role_name}</td>
                    <td>
                      <div className="rowActions">
                        <button className="textButton" type="button" onClick={() => openEdit(role)}><Edit size={15} /> Edit</button>
                        <Link className="textButton" to={`/admin/roles/${role.id}`}>Permissions</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <MasterDataFormModal open={modalOpen} title={editingRole ? 'Edit Role' : 'Create Role'} saving={saveMutation.isPending} error={saveMutation.error || (localError ? new Error(localError) : null)} onClose={() => setModalOpen(false)} onSubmit={submit}>
        <div className="formGrid modalGrid">
          <label>Role Code<input value={form.role_code} disabled={!!editingRole} onChange={(event) => setForm({ ...form, role_code: event.target.value })} /></label>
          <label>Role Name<input value={form.role_name} onChange={(event) => setForm({ ...form, role_name: event.target.value })} /></label>
        </div>
      </MasterDataFormModal>
    </div>
  );
}
