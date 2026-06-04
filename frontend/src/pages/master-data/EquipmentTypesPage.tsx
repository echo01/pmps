import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { equipmentApi, EquipmentType } from '../../api/equipment.api';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { MasterDataToolbar } from '../../components/master-data/MasterDataToolbar';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { logger } from '../../utils/logger';
import { logConflict, ModalMode, preventDefault, textOrNull } from './masterDataUtils';

const emptyForm = { type_code: '', type_name: '', description: '' };

export function EquipmentTypesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const types = useQuery({
    queryKey: ['equipment-types', filterSearch],
    queryFn: async () => {
      logger.info('[EQUIPMENT][TYPE_LOAD][START]', { search: filterSearch });
      const rows = await equipmentApi.getEquipmentTypes({ search: filterSearch });
      logger.info('[EQUIPMENT][TYPE_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.type_code.trim()) throw new Error('type_code is required');
      if (!form.type_name.trim()) throw new Error('type_name is required');
      const payload = { type_code: form.type_code.trim().toUpperCase(), type_name: form.type_name.trim(), description: textOrNull(form.description) };
      logger.info('[EQUIPMENT][TYPE_SAVE][START]', { type_code: payload.type_code });
      return mode === 'create' ? equipmentApi.createEquipmentType(payload) : equipmentApi.updateEquipmentType(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[EQUIPMENT][TYPE_SAVE][API_SUCCESS]', { typeId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['equipment-types'] });
    },
    onError: (error) => logConflict('[EQUIPMENT][TYPE_SAVE]', error, { type_code: form.type_code }),
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: EquipmentType) {
    setMode('edit');
    setEditingId(row.id);
    setForm({ type_code: row.type_code, type_name: row.type_name, description: row.description || '' });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setEditingId(null);
    setFormError(null);
    setModalOpen(false);
  }

  function save() {
    if (!form.type_code.trim()) return setFormError('type_code is required');
    if (!form.type_name.trim()) return setFormError('type_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Equipment Master</span><h1>Equipment Types</h1></div></div>
      <MasterDataToolbar search={search} addLabel="Add Type" onSearchChange={setSearch} onSubmit={preventDefault(() => setFilterSearch(search))} onAdd={openCreate} />
      <section className="panel">
        {types.isLoading ? <LoadingPanel /> : null}
        {types.error ? <ErrorAlert error={types.error} /> : null}
        {types.data?.length === 0 ? <EmptyState /> : null}
        {types.data?.length ? (
          <table><thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>{types.data.map((row) => <tr key={row.id}><td>{row.type_code}</td><td>{row.type_name}</td><td>{row.description || '-'}</td><td><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Equipment Type' : 'Edit Equipment Type'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <label>Type Code<input value={form.type_code} onChange={(event) => setForm({ ...form, type_code: event.target.value })} /></label>
        <label>Type Name<input value={form.type_name} onChange={(event) => setForm({ ...form, type_name: event.target.value })} /></label>
        <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      </MasterDataFormModal>
    </div>
  );
}
