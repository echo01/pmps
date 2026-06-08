import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Edit, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { testTemplatesApi, TestTemplate } from '../../api/testTemplates.api';
import { BooleanBadge, TemplateTypeBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { MasterDataToolbar } from '../../components/master-data/MasterDataToolbar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { Pagination } from '../../components/common/Pagination';
import { SelectField } from '../../components/common/SelectField';
import { formatDate } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';
import { activeQuery, logConflict, ModalMode, preventDefault, textOrNull } from './masterDataUtils';

const emptyForm = {
  template_type: 'INSPECTION',
  template_name: '',
  revision: 'REV.00',
  revision_note: '',
  effective_from: '',
  effective_to: '',
  active: true,
};

type TemplateForm = typeof emptyForm;
const emptyDuplicateForm = {
  template_name: '',
  revision: 'REV.00',
  revision_note: '',
  effective_from: '',
  effective_to: '',
  active: true,
  copy_models: true,
};
type DuplicateTemplateForm = typeof emptyDuplicateForm;
const TEMPLATE_PAGE_SIZE = 20;

export function TestTemplatesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'templates' | 'models'>('templates');
  const [modelId, setModelId] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [active, setActive] = useState('');
  const [filters, setFilters] = useState({ modelId: '', templateType: '', active: '' });
  const [templatePage, setTemplatePage] = useState(1);
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState<TestTemplate | null>(null);
  const [duplicateForm, setDuplicateForm] = useState<DuplicateTemplateForm>(emptyDuplicateForm);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<TestTemplate | null>(null);
  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([]);
  const [primaryModelId, setPrimaryModelId] = useState<number | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');

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

  const allTemplates = useQuery({
    queryKey: ['test-templates', 'assignment-options'],
    queryFn: () => testTemplatesApi.getTestTemplates({ active: true }),
  });

  const assignedModels = useQuery({
    queryKey: ['test-template-models', assignTemplateId],
    enabled: Boolean(assignTemplateId),
    queryFn: () => testTemplatesApi.getTemplateModels(assignTemplateId),
  });

  useEffect(() => {
    if (!assignTemplateId || !assignedModels.data) {
      return;
    }

    const modelIds = assignedModels.data.map((model) => model.id);
    setSelectedModelIds(modelIds);
    setPrimaryModelId(assignedModels.data.find((model) => model.is_primary)?.id || modelIds[0] || null);
  }, [assignedModels.data, assignTemplateId]);

  useEffect(() => {
    const total = templates.data?.length || 0;
    const totalPages = Math.max(Math.ceil(total / TEMPLATE_PAGE_SIZE), 1);

    if (templatePage > totalPages) {
      setTemplatePage(totalPages);
    }
  }, [templatePage, templates.data?.length]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.template_name.trim()) throw new Error('template_name is required');
      const payload = {
        template_type: form.template_type as TestTemplate['template_type'],
        template_name: form.template_name.trim(),
        revision: form.revision.trim() || 'REV.00',
        revision_note: textOrNull(form.revision_note),
        effective_from: textOrNull(form.effective_from),
        effective_to: textOrNull(form.effective_to),
        active: form.active,
      };
      logger.info('[TEMPLATE][HEADER_SAVE][START]', { template_type: payload.template_type, template_name: payload.template_name });
      return mode === 'create' ? testTemplatesApi.createTestTemplate(payload) : testTemplatesApi.updateTestTemplate(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[TEMPLATE][HEADER_SAVE][API_SUCCESS]', { templateId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['test-templates'] });
    },
    onError: (error) => logConflict('[TEMPLATE][HEADER_SAVE]', error, { template_name: form.template_name, revision: form.revision }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignTemplateId) throw new Error('template_id is required');
      if (!selectedModelIds.length) throw new Error('Select at least one model');
      const primary = primaryModelId && selectedModelIds.includes(primaryModelId) ? primaryModelId : selectedModelIds[0];
      return testTemplatesApi.updateTemplateModels(assignTemplateId, { model_ids: selectedModelIds, primary_model_id: primary });
    },
    onSuccess: () => {
      setAssignmentError(null);
      queryClient.invalidateQueries({ queryKey: ['test-template-models', assignTemplateId] });
      queryClient.invalidateQueries({ queryKey: ['test-templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => testTemplatesApi.deleteTestTemplate(deleteTemplate?.id || 0),
    onSuccess: () => {
      const deletedId = deleteTemplate?.id;
      setDeleteTemplate(null);
      if (deletedId && String(deletedId) === assignTemplateId) {
        setAssignTemplateId('');
        setSelectedModelIds([]);
        setPrimaryModelId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['test-templates'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!duplicateTemplate) throw new Error('template_id is required');
      if (!duplicateForm.template_name.trim()) throw new Error('template_name is required');

      return testTemplatesApi.duplicateTestTemplate(duplicateTemplate.id, {
        template_name: duplicateForm.template_name.trim(),
        revision: duplicateForm.revision.trim() || 'REV.00',
        revision_note: textOrNull(duplicateForm.revision_note),
        effective_from: textOrNull(duplicateForm.effective_from),
        effective_to: textOrNull(duplicateForm.effective_to),
        active: duplicateForm.active,
        copy_models: duplicateForm.copy_models,
      });
    },
    onSuccess: () => {
      closeDuplicateModal();
      queryClient.invalidateQueries({ queryKey: ['test-templates'] });
    },
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

  function openDuplicate(row: TestTemplate) {
    const copySuffix = Date.now().toString().slice(-5);
    setDuplicateTemplate(row);
    setDuplicateForm({
      template_name: `${row.template_name} Copy ${copySuffix}`,
      revision: row.revision || 'REV.00',
      revision_note: row.revision_note || '',
      effective_from: row.effective_from ? row.effective_from.slice(0, 10) : '',
      effective_to: row.effective_to ? row.effective_to.slice(0, 10) : '',
      active: row.active,
      copy_models: true,
    });
    setDuplicateError(null);
  }

  function closeModal() {
    setEditingId(null);
    setFormError(null);
    setModalOpen(false);
  }

  function closeDuplicateModal() {
    setDuplicateTemplate(null);
    setDuplicateForm(emptyDuplicateForm);
    setDuplicateError(null);
  }

  function save() {
    if (!form.template_name.trim()) return setFormError('template_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  function duplicate() {
    if (!duplicateForm.template_name.trim()) return setDuplicateError('template_name is required');
    setDuplicateError(null);
    duplicateMutation.mutate();
  }

  function selectAssignmentTemplate(templateId: string) {
    setAssignTemplateId(templateId);
    setAssignmentError(null);
    setModelSearch('');
    const row = allTemplates.data?.find((item) => String(item.id) === templateId);
    const modelIds = row?.model_ids || row?.models?.map((model) => model.id) || [];
    setSelectedModelIds(modelIds);
    setPrimaryModelId(row?.model_id || modelIds[0] || null);
  }

  function addModel(modelIdValue: number) {
    const next = [...new Set([...selectedModelIds, modelIdValue])];
    setSelectedModelIds(next);
    setPrimaryModelId(primaryModelId || modelIdValue);
    setAssignmentError(null);
  }

  function removeModel(modelIdValue: number) {
    const next = selectedModelIds.filter((item) => item !== modelIdValue);
    setSelectedModelIds(next);
    setPrimaryModelId(next.includes(primaryModelId || 0) ? primaryModelId : next[0] || null);
  }

  function saveAssignment() {
    if (!assignTemplateId) return setAssignmentError('template_id is required');
    if (!selectedModelIds.length) return setAssignmentError('Select at least one model');
    setAssignmentError(null);
    assignMutation.mutate();
  }

  function applyFilters() {
    setTemplatePage(1);
    setFilters({ modelId, templateType, active });
  }

  const modelOptions = (models.data || []).map((row) => ({ value: row.id, label: `${row.model_code} - ${row.product_name}` }));
  const selectedTemplate = useMemo(() => allTemplates.data?.find((row) => String(row.id) === assignTemplateId), [allTemplates.data, assignTemplateId]);
  const assignedRows = useMemo(
    () => selectedModelIds
      .map((id) => models.data?.find((model) => model.id === id))
      .filter(Boolean),
    [models.data, selectedModelIds]
  );
  const searchText = modelSearch.trim().toLowerCase();
  const availableRows = useMemo(
    () => (models.data || [])
      .filter((model) => !selectedModelIds.includes(model.id))
      .filter((model) => !searchText || `${model.model_code} ${model.product_name} ${model.model_name || ''}`.toLowerCase().includes(searchText))
      .slice(0, 10),
    [modelSearch, models.data, searchText, selectedModelIds]
  );
  const templateRows = templates.data || [];
  const pagedTemplateRows = templateRows.slice((templatePage - 1) * TEMPLATE_PAGE_SIZE, templatePage * TEMPLATE_PAGE_SIZE);

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Test Template</span><h1>Test Templates</h1></div></div>
      <div className="tabs">
        <button className={tab === 'templates' ? 'active' : ''} type="button" onClick={() => setTab('templates')}>Create Templates</button>
        <button className={tab === 'models' ? 'active' : ''} type="button" onClick={() => setTab('models')}>Assign Models</button>
      </div>

      {tab === 'templates' ? (
        <>
          <MasterDataToolbar active={active} addLabel="Add Template" onActiveChange={setActive} onSubmit={preventDefault(applyFilters)} onAdd={openCreate}>
            <SelectField label="Assigned Model" value={modelId} options={modelOptions} onChange={setModelId} />
            <label>Type<select value={templateType} onChange={(event) => setTemplateType(event.target.value)}><option value="">All</option><option value="INSPECTION">INSPECTION</option><option value="QA">QA</option></select></label>
          </MasterDataToolbar>
          <section className="panel">
            {templates.isLoading ? <LoadingPanel /> : null}
            {templates.error ? <ErrorAlert error={templates.error} /> : null}
            {deleteMutation.error ? <ErrorAlert error={deleteMutation.error} /> : null}
            {templates.data?.length === 0 ? <EmptyState /> : null}
            {templates.data?.length ? (
              <>
                <div className="tableScroll templateTableScroll">
                  <table><thead><tr><th>Template</th><th>Assigned Models</th><th>Type</th><th>Revision</th><th>Effective</th><th>Active</th><th>Action</th></tr></thead>
                    <tbody>{pagedTemplateRows.map((row) => <tr key={row.id}><td>{row.template_name}</td><td>{formatModels(row)}</td><td><TemplateTypeBadge value={row.template_type} /></td><td>{row.revision}</td><td>{formatDate(row.effective_from)}</td><td><BooleanBadge value={row.active} /></td><td><div className="rowActions templateRowActions"><Link className="textButton" to={`/templates/${row.id}`}><Eye size={16} /> Detail</Link><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button><button className="textButton" onClick={() => openDuplicate(row)}><Copy size={16} /> Duplicate</button><button className="textButton dangerText" onClick={() => setDeleteTemplate(row)}><Trash2 size={16} /> Delete</button></div></td></tr>)}</tbody></table>
                </div>
                <Pagination page={templatePage} pageSize={TEMPLATE_PAGE_SIZE} total={templateRows.length} onPageChange={setTemplatePage} />
              </>
            ) : null}
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="sectionHeader"><h2>Assign Models to Test Template</h2><button className="primaryButton" type="button" disabled={assignMutation.isPending} onClick={saveAssignment}><Save size={18} /> Save Assignment</button></div>
          <FormFieldError message={assignmentError} />
          {assignMutation.error ? <ErrorAlert error={assignMutation.error} /> : null}
          {assignedModels.error ? <ErrorAlert error={assignedModels.error} /> : null}
          <div className="formGrid">
            <label>Template<select value={assignTemplateId} onChange={(event) => selectAssignmentTemplate(event.target.value)}><option value="">Select template</option>{(allTemplates.data || []).map((template) => <option key={template.id} value={template.id}>{template.template_name} rev {template.revision || '-'} ({template.template_type})</option>)}</select></label>
            <label>Primary Model<select value={primaryModelId || ''} onChange={(event) => setPrimaryModelId(Number(event.target.value) || null)} disabled={!selectedModelIds.length}><option value="">Auto</option>{selectedModelIds.map((id) => {
              const model = models.data?.find((item) => item.id === id);
              return <option key={id} value={id}>{model ? `${model.model_code} - ${model.product_name}` : id}</option>;
            })}</select></label>
          </div>
          {selectedTemplate ? <p className="mutedText">Selected: {selectedTemplate.template_name} rev {selectedTemplate.revision || '-'}</p> : null}
          {assignedModels.isFetching ? <LoadingPanel label="Loading assigned models..." /> : null}
          <div className="assignmentSearch">
            <label>Search Model<input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Search model code or product name" /></label>
            <div className="assignmentResults">
              {availableRows.length ? availableRows.map((model) => (
                <button className="assignmentResult" key={model.id} type="button" onClick={() => addModel(model.id)} disabled={!assignTemplateId}>
                  <Plus size={18} />
                  <span><strong>{model.model_code}</strong><small>{model.product_name}</small></span>
                </button>
              )) : <div className="assignmentNoResult">No matching model found</div>}
            </div>
          </div>
          <div className="subPanel">
            <h2>Assignment Table</h2>
            {assignedRows.length ? (
              <table><thead><tr><th>Primary</th><th>Model Code</th><th>Product Name</th><th>Action</th></tr></thead>
                <tbody>{assignedRows.map((model) => model ? <tr key={model.id}><td><input aria-label={`Set ${model.model_code} as primary`} type="radio" checked={primaryModelId === model.id} onChange={() => setPrimaryModelId(model.id)} /></td><td>{model.model_code}</td><td>{model.product_name}</td><td><button className="textButton dangerText" type="button" onClick={() => removeModel(model.id)}><Trash2 size={16} /> Remove</button></td></tr> : null)}</tbody></table>
            ) : <EmptyState message="No models assigned to this template" />}
          </div>
        </section>
      )}

      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Template' : 'Edit Template'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <label>Type<select value={form.template_type} onChange={(event) => setForm({ ...form, template_type: event.target.value })}><option value="INSPECTION">INSPECTION</option><option value="QA">QA</option></select></label>
        <label>Name<input value={form.template_name} onChange={(event) => setForm({ ...form, template_name: event.target.value })} /></label>
        <label>Revision<input value={form.revision} onChange={(event) => setForm({ ...form, revision: event.target.value })} /></label>
        <label>Effective From<input type="date" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} /></label>
        <label>Effective To<input type="date" value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} /></label>
        <label>Revision Note<input value={form.revision_note} onChange={(event) => setForm({ ...form, revision_note: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      </MasterDataFormModal>
      <MasterDataFormModal open={duplicateTemplate !== null} title="Duplicate Test Template" submitLabel="Duplicate" error={duplicateMutation.error} saving={duplicateMutation.isPending} onClose={closeDuplicateModal} onSubmit={duplicate}>
        <FormFieldError message={duplicateError} />
        <p className="mutedText">Source: {duplicateTemplate?.template_name || '-'} rev {duplicateTemplate?.revision || '-'}</p>
        <label>Name<input value={duplicateForm.template_name} onChange={(event) => setDuplicateForm({ ...duplicateForm, template_name: event.target.value })} /></label>
        <label>Revision<input value={duplicateForm.revision} onChange={(event) => setDuplicateForm({ ...duplicateForm, revision: event.target.value })} /></label>
        <label>Effective From<input type="date" value={duplicateForm.effective_from} onChange={(event) => setDuplicateForm({ ...duplicateForm, effective_from: event.target.value })} /></label>
        <label>Effective To<input type="date" value={duplicateForm.effective_to} onChange={(event) => setDuplicateForm({ ...duplicateForm, effective_to: event.target.value })} /></label>
        <label>Revision Note<input value={duplicateForm.revision_note} onChange={(event) => setDuplicateForm({ ...duplicateForm, revision_note: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={duplicateForm.copy_models} onChange={(event) => setDuplicateForm({ ...duplicateForm, copy_models: event.target.checked })} /> Copy assigned models</label>
        <label className="checkRow"><input type="checkbox" checked={duplicateForm.active} onChange={(event) => setDuplicateForm({ ...duplicateForm, active: event.target.checked })} /> Active</label>
      </MasterDataFormModal>
      <ConfirmDialog open={deleteTemplate !== null} title="Delete Test Template" message={`Delete "${deleteTemplate?.template_name || ''}"? This is allowed only when the template has not been used by QC/QA records.`} confirming={deleteMutation.isPending} onCancel={() => setDeleteTemplate(null)} onConfirm={() => deleteMutation.mutate()} />
    </div>
  );
}

function formatModels(row: TestTemplate) {
  const codes = row.model_codes?.length ? row.model_codes : row.models?.map((model) => model.model_code);

  if (!codes?.length) {
    return <span className="mutedText">Not assigned</span>;
  }

  const visibleCodes = codes.slice(0, 2);
  const hiddenCount = codes.length - visibleCodes.length;
  const label = hiddenCount > 0 ? `${visibleCodes.join(', ')} +${hiddenCount} more` : visibleCodes.join(', ');

  return <span className="modelListCompact" title={codes.join(', ')}>{label}</span>;
}
