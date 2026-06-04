import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { equipmentApi } from '../../api/equipment.api';
import { modelRequiredEquipmentApi, ModelRequiredEquipment } from '../../api/modelRequiredEquipment.api';
import { productsApi } from '../../api/products.api';
import { CalibrationStatusBadge, BooleanBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { logger } from '../../utils/logger';
import { formatDate } from '../../utils/dateFormat';
import { logConflict, ModalMode, textOrNull } from './masterDataUtils';

const emptyForm = { model_id: '', equipment_type_id: '', required_qty: '1', mandatory: true, remark: '' };

export function ModelRequiredEquipmentPage() {
  const queryClient = useQueryClient();
  const [modelId, setModelId] = useState('');
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const models = useQuery({ queryKey: ['product-model-lookups'], queryFn: productsApi.getProductModelLookups });
  const types = useQuery({ queryKey: ['equipment-types', 'lookup'], queryFn: () => equipmentApi.getEquipmentTypes() });
  const required = useQuery({
    queryKey: ['model-required-equipment', modelId],
    queryFn: async () => {
      logger.info('[MODEL_REQUIRED_EQUIPMENT][LOAD][START]', { model_id: modelId });
      const rows = await modelRequiredEquipmentApi.getModelRequiredEquipment({ model_id: modelId });
      logger.info('[MODEL_REQUIRED_EQUIPMENT][LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });
  const available = useQuery({
    queryKey: ['available-equipment-by-model', modelId],
    queryFn: () => modelRequiredEquipmentApi.getAvailableEquipmentByModel(modelId),
    enabled: Boolean(modelId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.model_id) throw new Error('model_id is required');
      if (!form.equipment_type_id) throw new Error('equipment_type_id is required');
      if (Number(form.required_qty) <= 0) throw new Error('required_qty must be greater than 0');
      const payload = {
        model_id: Number(form.model_id),
        equipment_type_id: Number(form.equipment_type_id),
        required_qty: Number(form.required_qty),
        mandatory: form.mandatory,
        remark: textOrNull(form.remark),
      };
      logger.info('[MODEL_REQUIRED_EQUIPMENT][SAVE][START]', { model_id: payload.model_id, equipment_type_id: payload.equipment_type_id });
      return mode === 'create'
        ? modelRequiredEquipmentApi.createModelRequiredEquipment(payload)
        : modelRequiredEquipmentApi.updateModelRequiredEquipment(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[MODEL_REQUIRED_EQUIPMENT][SAVE][API_SUCCESS]', { id: row.id });
      closeModal();
      setModelId(String(row.model_id));
      queryClient.invalidateQueries({ queryKey: ['model-required-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['available-equipment-by-model'] });
    },
    onError: (error) => logConflict('[MODEL_REQUIRED_EQUIPMENT][SAVE]', error, { model_id: form.model_id, equipment_type_id: form.equipment_type_id }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => modelRequiredEquipmentApi.deleteModelRequiredEquipment(deleteId || 0),
    onSuccess: () => {
      logger.info('[MODEL_REQUIRED_EQUIPMENT][DELETE][API_SUCCESS]', { id: deleteId });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['model-required-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['available-equipment-by-model'] });
    },
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm({ ...emptyForm, model_id: modelId });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: ModelRequiredEquipment) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      model_id: String(row.model_id),
      equipment_type_id: String(row.equipment_type_id),
      required_qty: String(row.required_qty),
      mandatory: row.mandatory,
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
    if (!form.model_id) return setFormError('model_id is required');
    if (!form.equipment_type_id) return setFormError('equipment_type_id is required');
    if (Number(form.required_qty) <= 0) return setFormError('required_qty must be greater than 0');
    setFormError(null);
    saveMutation.mutate();
  }

  const modelOptions = (models.data || []).map((row) => ({ value: row.id, label: `${row.model_code} - ${row.product_name}` }));
  const typeOptions = (types.data || []).map((row) => ({ value: row.id, label: `${row.type_code} - ${row.type_name}` }));

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div><span className="eyebrow">Equipment Master</span><h1>Model Required Equipment</h1></div>
        <button className="primaryButton" type="button" onClick={openCreate}>Add Required Equipment</button>
      </div>
      <section className="panel">
        <div className="formGrid">
          <label className="span2">Product Model<select value={modelId} onChange={(event) => setModelId(event.target.value)}><option value="">All models</option>{modelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
      </section>
      <section className="panel">
        <h2>Required Equipment</h2>
        {required.isLoading ? <LoadingPanel /> : null}
        {required.error ? <ErrorAlert error={required.error} /> : null}
        {required.data?.length === 0 ? <EmptyState /> : null}
        {required.data?.length ? (
          <table><thead><tr><th>Model</th><th>Equipment Type</th><th>Required Qty</th><th>Mandatory</th><th>Remark</th><th>Action</th></tr></thead>
            <tbody>{required.data.map((row) => <tr key={row.id}><td>{row.model_code}</td><td>{row.equipment_type_code}</td><td>{row.required_qty}</td><td><BooleanBadge value={row.mandatory} trueLabel="Mandatory" falseLabel="Optional" /></td><td>{row.remark || '-'}</td><td><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button> <button className="textButton dangerText" onClick={() => setDeleteId(row.id)}><Trash2 size={16} /> Delete</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      {modelId ? (
        <section className="panel">
          <h2>Available Equipment for Selected Model</h2>
          {available.isLoading ? <LoadingPanel /> : null}
          {available.error ? <ErrorAlert error={available.error} /> : null}
          {available.data?.length === 0 ? <EmptyState message="No active equipment matches this model requirement" /> : null}
          {available.data?.length ? (
            <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th><th>Calibration</th><th>Due</th></tr></thead>
              <tbody>{available.data.map((row) => <tr key={row.equipment_id}><td>{row.equipment_code}</td><td>{row.equipment_name}</td><td>{row.equipment_type_code}</td><td>{row.status}</td><td><CalibrationStatusBadge value={row.calibration_status} /></td><td>{formatDate(row.calibration_due_date)}</td></tr>)}</tbody></table>
          ) : null}
        </section>
      ) : null}
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Required Equipment' : 'Edit Required Equipment'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <label>Product Model<select value={form.model_id} onChange={(event) => setForm({ ...form, model_id: event.target.value })}><option value="">Select model</option>{modelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Equipment Type<select value={form.equipment_type_id} onChange={(event) => setForm({ ...form, equipment_type_id: event.target.value })}><option value="">Select type</option>{typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Required Qty<input type="number" min="1" value={form.required_qty} onChange={(event) => setForm({ ...form, required_qty: event.target.value })} /></label>
        <label>Remark<input value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={form.mandatory} onChange={(event) => setForm({ ...form, mandatory: event.target.checked })} /> Mandatory</label>
      </MasterDataFormModal>
      <ConfirmDialog open={deleteId !== null} title="Delete Required Equipment" message="This removes the required equipment rule for the model." confirming={deleteMutation.isPending} onCancel={() => setDeleteId(null)} onConfirm={() => deleteMutation.mutate()} />
    </div>
  );
}
