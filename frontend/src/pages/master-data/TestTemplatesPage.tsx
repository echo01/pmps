import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Eye } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { testTemplatesApi, TestTemplate } from '../../api/testTemplates.api';
import { BooleanBadge, TemplateTypeBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { MasterDataToolbar } from '../../components/master-data/MasterDataToolbar';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { SelectField } from '../../components/common/SelectField';
import { formatDate } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';
import { activeQuery, logConflict, ModalMode, preventDefault, textOrNull } from './masterDataUtils';

const emptyForm = {
  model_id: '',
  template_type: 'INSPECTION',
  template_name: '',
  revision: 'REV.00',
  revision_note: '',
  effective_from: '',
  effective_to: '',
  active: true,
};

export function TestTemplatesPage() {
  const queryClient = useQueryClient();
  const [modelId, setModelId] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [active, setActive] = useState('');
  const [filters, setFilters] = useState({ modelId: '', templateType: '', active: '' });
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const models = useQuery({ queryKey: ['product-model-lookups'], queryFn: productsApi.getProductModelLookups });
  const templates = useQuery({
    queryKey: ['test-templates', filters],
    queryFn: async () => {
      logger.info('[TEMPLATE][HEADER_LOAD][START]', filters);
      const rows = await testTemplatesApi.getTestTemplates({ model_id: filters.modelId, template_type: filters.templateType, active: activeQuery(filters.active) });
      logger.info('[TEMPLATE][HEADER_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.model_id) throw new Error('model_id is required');
      if (!form.template_name.trim()) throw new Error('template_name is required');
      const payload = {
        model_id: Number(form.model_id),
        template_type: form.template_type as TestTemplate['template_type'],
        template_name: form.template_name.trim(),
        revision: form.revision.trim() || 'REV.00',
        revision_note: textOrNull(form.revision_note),
        effective_from: textOrNull(form.effective_from),
        effective_to: textOrNull(form.effective_to),
        active: form.active,
      };
      logger.info('[TEMPLATE][HEADER_SAVE][START]', { model_id: payload.model_id, template_type: payload.template_type, template_name: payload.template_name });
      return mode === 'create' ? testTemplatesApi.createTestTemplate(payload) : testTemplatesApi.updateTestTemplate(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[TEMPLATE][HEADER_SAVE][API_SUCCESS]', { templateId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['test-templates'] });
    },
    onError: (error) => logConflict('[TEMPLATE][HEADER_SAVE]', error, { template_name: form.template_name, revision: form.revision }),
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: TestTemplate) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      model_id: String(row.model_id),
      template_type: row.template_type,
      template_name: row.template_name,
      revision: row.revision || 'REV.00',
      revision_note: row.revision_note || '',
      effective_from: row.effective_from ? row.effective_from.slice(0, 10) : '',
      effective_to: row.effective_to ? row.effective_to.slice(0, 10) : '',
      active: row.active,
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
    if (!form.template_name.trim()) return setFormError('template_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  const modelOptions = (models.data || []).map((row) => ({ value: row.id, label: `${row.model_code} - ${row.product_name}` }));

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Test Template</span><h1>Test Templates</h1></div></div>
      <MasterDataToolbar active={active} addLabel="Add Template" onActiveChange={setActive} onSubmit={preventDefault(() => setFilters({ modelId, templateType, active }))} onAdd={openCreate}>
        <SelectField label="Product Model" value={modelId} options={modelOptions} onChange={setModelId} />
        <label>Type<select value={templateType} onChange={(event) => setTemplateType(event.target.value)}><option value="">All</option><option value="INSPECTION">INSPECTION</option><option value="QA">QA</option></select></label>
      </MasterDataToolbar>
      <section className="panel">
        {templates.isLoading ? <LoadingPanel /> : null}
        {templates.error ? <ErrorAlert error={templates.error} /> : null}
        {templates.data?.length === 0 ? <EmptyState /> : null}
        {templates.data?.length ? (
          <table><thead><tr><th>Template</th><th>Model</th><th>Type</th><th>Revision</th><th>Effective</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>{templates.data.map((row) => <tr key={row.id}><td>{row.template_name}</td><td>{row.model_code}</td><td><TemplateTypeBadge value={row.template_type} /></td><td>{row.revision}</td><td>{formatDate(row.effective_from)}</td><td><BooleanBadge value={row.active} /></td><td><Link className="textButton" to={`/templates/${row.id}`}><Eye size={16} /> Detail</Link> <button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Template' : 'Edit Template'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <label>Product Model<select value={form.model_id} onChange={(event) => setForm({ ...form, model_id: event.target.value })}><option value="">Select model</option>{modelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Type<select value={form.template_type} onChange={(event) => setForm({ ...form, template_type: event.target.value })}><option value="INSPECTION">INSPECTION</option><option value="QA">QA</option></select></label>
        <label>Name<input value={form.template_name} onChange={(event) => setForm({ ...form, template_name: event.target.value })} /></label>
        <label>Revision<input value={form.revision} onChange={(event) => setForm({ ...form, revision: event.target.value })} /></label>
        <label>Effective From<input type="date" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} /></label>
        <label>Effective To<input type="date" value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} /></label>
        <label>Revision Note<input value={form.revision_note} onChange={(event) => setForm({ ...form, revision_note: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      </MasterDataFormModal>
    </div>
  );
}
