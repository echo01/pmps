import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { equipmentApi, Equipment } from '../../api/equipment.api';
import { CalibrationStatusBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { MasterDataToolbar } from '../../components/master-data/MasterDataToolbar';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { SelectField } from '../../components/common/SelectField';
import { formatDate } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';
import { logConflict, ModalMode, preventDefault, textOrNull } from './masterDataUtils';

const emptyForm = {
  equipment_code: '',
  equipment_name: '',
  equipment_type_id: '',
  brand: '',
  model: '',
  serial_number: '',
  calibration_no: '',
  calibration_date: '',
  calibration_due_date: '',
  status: 'ACTIVE',
  location_name: '',
  asset_no: '',
  remark: '',
};

export function EquipmentMasterPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', equipmentTypeId: '', expiredOnly: false });
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const types = useQuery({ queryKey: ['equipment-types', 'lookup'], queryFn: () => equipmentApi.getEquipmentTypes() });
  const equipment = useQuery({
    queryKey: ['equipment-master', filters],
    queryFn: async () => {
      logger.info('[EQUIPMENT][MASTER_LOAD][START]', filters);
      const rows = filters.expiredOnly
        ? await equipmentApi.getExpiredCalibrationEquipment()
        : await equipmentApi.getEquipment({ search: filters.search, status: filters.status, equipment_type_id: filters.equipmentTypeId });
      logger.info('[EQUIPMENT][MASTER_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.equipment_code.trim()) throw new Error('equipment_code is required');
      if (!form.equipment_name.trim()) throw new Error('equipment_name is required');
      const payload = {
        equipment_code: form.equipment_code.trim().toUpperCase(),
        equipment_name: form.equipment_name.trim(),
        equipment_type_id: form.equipment_type_id ? Number(form.equipment_type_id) : null,
        brand: textOrNull(form.brand),
        model: textOrNull(form.model),
        serial_number: textOrNull(form.serial_number),
        calibration_no: textOrNull(form.calibration_no),
        calibration_date: textOrNull(form.calibration_date),
        calibration_due_date: textOrNull(form.calibration_due_date),
        status: form.status as Equipment['status'],
        location_name: textOrNull(form.location_name),
        asset_no: textOrNull(form.asset_no),
        remark: textOrNull(form.remark),
      };
      logger.info('[EQUIPMENT][MASTER_SAVE][START]', { equipment_code: payload.equipment_code });
      return mode === 'create' ? equipmentApi.createEquipment(payload) : equipmentApi.updateEquipment(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[EQUIPMENT][MASTER_SAVE][API_SUCCESS]', { equipmentId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['equipment-master'] });
    },
    onError: (error) => logConflict('[EQUIPMENT][MASTER_SAVE]', error, { equipment_code: form.equipment_code }),
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: Equipment) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      equipment_code: row.equipment_code,
      equipment_name: row.equipment_name,
      equipment_type_id: row.equipment_type_id ? String(row.equipment_type_id) : '',
      brand: row.brand || '',
      model: row.model || '',
      serial_number: row.serial_number || '',
      calibration_no: row.calibration_no || '',
      calibration_date: row.calibration_date ? row.calibration_date.slice(0, 10) : '',
      calibration_due_date: row.calibration_due_date ? row.calibration_due_date.slice(0, 10) : '',
      status: row.status,
      location_name: row.location_name || '',
      asset_no: row.asset_no || '',
      remark: row.remark || '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setEditingId(null);
    setFormError(null);
    setModalOpen(false);
  }

  function save() {
    if (!form.equipment_code.trim()) return setFormError('equipment_code is required');
    if (!form.equipment_name.trim()) return setFormError('equipment_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  const typeOptions = (types.data || []).map((row) => ({ value: row.id, label: `${row.type_code} - ${row.type_name}` }));

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Equipment Master</span><h1>Equipment Master</h1></div></div>
      <MasterDataToolbar search={search} addLabel="Add Equipment" onSearchChange={setSearch} onSubmit={preventDefault(() => setFilters({ search, status, equipmentTypeId, expiredOnly }))} onAdd={openCreate}>
        <SelectField label="Type" value={equipmentTypeId} options={typeOptions} onChange={setEquipmentTypeId} />
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="REPAIR">REPAIR</option><option value="CALIBRATION">CALIBRATION</option></select></label>
        <label className="checkRow filterCheck"><input type="checkbox" checked={expiredOnly} onChange={(event) => setExpiredOnly(event.target.checked)} /> Expired only</label>
      </MasterDataToolbar>
      <section className="panel">
        {equipment.isLoading ? <LoadingPanel /> : null}
        {equipment.error ? <ErrorAlert error={equipment.error} /> : null}
        {equipment.data?.length === 0 ? <EmptyState /> : null}
        {equipment.data?.length ? (
          <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th><th>Calibration</th><th>Due Date</th><th>Action</th></tr></thead>
            <tbody>{equipment.data.map((row) => <tr key={row.id}><td>{row.equipment_code}</td><td>{row.equipment_name}</td><td>{row.equipment_type_code || '-'}</td><td>{row.status}</td><td><CalibrationStatusBadge value={row.calibration_status} /></td><td>{formatDate(row.calibration_due_date)}</td><td><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Equipment' : 'Edit Equipment'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <div className="formGrid modalGrid">
          <label>Code<input value={form.equipment_code} onChange={(event) => setForm({ ...form, equipment_code: event.target.value })} /></label>
          <label>Name<input value={form.equipment_name} onChange={(event) => setForm({ ...form, equipment_name: event.target.value })} /></label>
          <label>Type<select value={form.equipment_type_id} onChange={(event) => setForm({ ...form, equipment_type_id: event.target.value })}><option value="">No type</option>{typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="REPAIR">REPAIR</option><option value="CALIBRATION">CALIBRATION</option></select></label>
          <label>Brand<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
          <label>Model<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label>
          <label>Serial<input value={form.serial_number} onChange={(event) => setForm({ ...form, serial_number: event.target.value })} /></label>
          <label>Calibration No<input value={form.calibration_no} onChange={(event) => setForm({ ...form, calibration_no: event.target.value })} /></label>
          <label>Calibration Date<input type="date" value={form.calibration_date} onChange={(event) => setForm({ ...form, calibration_date: event.target.value })} /></label>
          <label>Due Date<input type="date" value={form.calibration_due_date} onChange={(event) => setForm({ ...form, calibration_due_date: event.target.value })} /></label>
          <label>Location<input value={form.location_name} onChange={(event) => setForm({ ...form, location_name: event.target.value })} /></label>
          <label>Asset No<input value={form.asset_no} onChange={(event) => setForm({ ...form, asset_no: event.target.value })} /></label>
          <label className="span2">Remark<input value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} /></label>
        </div>
      </MasterDataFormModal>
    </div>
  );
}
