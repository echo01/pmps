import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { productsApi, ProductModel } from '../../api/products.api';
import { BooleanBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { MasterDataToolbar } from '../../components/master-data/MasterDataToolbar';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { FormFieldError } from '../../components/common/FormFieldError';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { SelectField } from '../../components/common/SelectField';
import { logger } from '../../utils/logger';
import { activeQuery, logConflict, ModalMode, preventDefault, textOrNull } from './masterDataUtils';

const emptyForm = { sub_category_id: '', model_code: '', product_name: '', model_name: '', description: '', active: true };

export function ProductModelsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [filters, setFilters] = useState({ search: '', active: '', subCategoryId: '' });
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const subCategories = useQuery({ queryKey: ['product-sub-categories', 'lookup-all'], queryFn: () => productsApi.getProductSubCategories({ active: true }) });
  const models = useQuery({
    queryKey: ['product-models', filters],
    queryFn: async () => {
      logger.info('[PRODUCT][MODEL_LOAD][START]', filters);
      const rows = await productsApi.getProductModels({ search: filters.search, active: activeQuery(filters.active), sub_category_id: filters.subCategoryId });
      logger.info('[PRODUCT][MODEL_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.sub_category_id) throw new Error('sub_category_id is required');
      if (!form.model_code.trim()) throw new Error('model_code is required');
      if (!form.product_name.trim()) throw new Error('product_name is required');
      const payload = {
        sub_category_id: Number(form.sub_category_id),
        model_code: form.model_code.trim().toUpperCase(),
        product_name: form.product_name.trim(),
        model_name: textOrNull(form.model_name),
        description: textOrNull(form.description),
        active: form.active,
      };
      logger.info('[PRODUCT][MODEL_SAVE][START]', { model_code: payload.model_code });
      return mode === 'create' ? productsApi.createProductModel(payload) : productsApi.updateProductModel(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[PRODUCT][MODEL_SAVE][API_SUCCESS]', { modelId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['product-models'] });
      queryClient.invalidateQueries({ queryKey: ['product-model-lookups'] });
    },
    onError: (error) => logConflict('[PRODUCT][MODEL_SAVE]', error, { model_code: form.model_code }),
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: ProductModel) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      sub_category_id: String(row.sub_category_id),
      model_code: row.model_code,
      product_name: row.product_name,
      model_name: row.model_name || '',
      description: row.description || '',
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
    if (!form.sub_category_id) return setFormError('sub_category_id is required');
    if (!form.model_code.trim()) return setFormError('model_code is required');
    if (!form.product_name.trim()) return setFormError('product_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  const subCategoryOptions = (subCategories.data || []).map((row) => ({ value: row.id, label: `${row.sub_category_code} - ${row.sub_category_name}` }));

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Product Master</span><h1>Product Models</h1></div></div>
      <MasterDataToolbar search={search} active={active} addLabel="Add Model" onSearchChange={setSearch} onActiveChange={setActive} onSubmit={preventDefault(() => setFilters({ search, active, subCategoryId }))} onAdd={openCreate}>
        <SelectField label="Sub Category" value={subCategoryId} options={subCategoryOptions} onChange={setSubCategoryId} />
      </MasterDataToolbar>
      <section className="panel">
        {models.isLoading ? <LoadingPanel /> : null}
        {models.error ? <ErrorAlert error={models.error} /> : null}
        {models.data?.length === 0 ? <EmptyState /> : null}
        {models.data?.length ? (
          <table><thead><tr><th>Model</th><th>Product</th><th>Model Name</th><th>Sub Category</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>{models.data.map((row) => <tr key={row.id}><td>{row.model_code}</td><td>{row.product_name}</td><td>{row.model_name || '-'}</td><td>{row.sub_category_code}</td><td><BooleanBadge value={row.active} /></td><td><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Product Model' : 'Edit Product Model'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <label>Sub Category<select value={form.sub_category_id} onChange={(event) => setForm({ ...form, sub_category_id: event.target.value })}><option value="">Select sub category</option>{subCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Model Code<input value={form.model_code} onChange={(event) => setForm({ ...form, model_code: event.target.value })} /></label>
        <label>Product Name<input value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} /></label>
        <label>Model Name<input value={form.model_name} onChange={(event) => setForm({ ...form, model_name: event.target.value })} /></label>
        <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      </MasterDataFormModal>
    </div>
  );
}
