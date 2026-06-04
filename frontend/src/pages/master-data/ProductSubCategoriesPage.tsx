import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { productsApi, ProductSubCategory } from '../../api/products.api';
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

const emptyForm = { category_id: '', sub_category_code: '', sub_category_name: '', description: '', active: true };

export function ProductSubCategoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [filters, setFilters] = useState({ search: '', active: '', categoryId: '' });
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['product-categories', 'lookup-all'], queryFn: () => productsApi.getProductCategories({ active: true }) });
  const subCategories = useQuery({
    queryKey: ['product-sub-categories', filters],
    queryFn: async () => {
      logger.info('[PRODUCT][SUB_CATEGORY_LOAD][START]', filters);
      const rows = await productsApi.getProductSubCategories({
        search: filters.search,
        active: activeQuery(filters.active),
        category_id: filters.categoryId,
      });
      logger.info('[PRODUCT][SUB_CATEGORY_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.category_id) throw new Error('category_id is required');
      if (!form.sub_category_code.trim()) throw new Error('sub_category_code is required');
      if (!form.sub_category_name.trim()) throw new Error('sub_category_name is required');
      const payload = {
        category_id: Number(form.category_id),
        sub_category_code: form.sub_category_code.trim().toUpperCase(),
        sub_category_name: form.sub_category_name.trim(),
        description: textOrNull(form.description),
        active: form.active,
      };
      logger.info('[PRODUCT][SUB_CATEGORY_SAVE][START]', { sub_category_code: payload.sub_category_code });
      return mode === 'create'
        ? productsApi.createProductSubCategory(payload)
        : productsApi.updateProductSubCategory(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[PRODUCT][SUB_CATEGORY_SAVE][API_SUCCESS]', { subCategoryId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['product-sub-categories'] });
    },
    onError: (error) => logConflict('[PRODUCT][SUB_CATEGORY_SAVE]', error, { sub_category_code: form.sub_category_code }),
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: ProductSubCategory) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      category_id: String(row.category_id),
      sub_category_code: row.sub_category_code,
      sub_category_name: row.sub_category_name,
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
    if (!form.category_id) return setFormError('category_id is required');
    if (!form.sub_category_code.trim()) return setFormError('sub_category_code is required');
    if (!form.sub_category_name.trim()) return setFormError('sub_category_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  const categoryOptions = (categories.data || []).map((row) => ({ value: row.id, label: `${row.category_code} - ${row.category_name}` }));

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Product Master</span><h1>Product Sub Categories</h1></div></div>
      <MasterDataToolbar search={search} active={active} addLabel="Add Sub Category" onSearchChange={setSearch} onActiveChange={setActive} onSubmit={preventDefault(() => setFilters({ search, active, categoryId }))} onAdd={openCreate}>
        <SelectField label="Category" value={categoryId} options={categoryOptions} onChange={setCategoryId} />
      </MasterDataToolbar>
      <section className="panel">
        {subCategories.isLoading ? <LoadingPanel /> : null}
        {subCategories.error ? <ErrorAlert error={subCategories.error} /> : null}
        {subCategories.data?.length === 0 ? <EmptyState /> : null}
        {subCategories.data?.length ? (
          <table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>{subCategories.data.map((row) => <tr key={row.id}><td>{row.sub_category_code}</td><td>{row.sub_category_name}</td><td>{row.category_code}</td><td><BooleanBadge value={row.active} /></td><td><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Sub Category' : 'Edit Sub Category'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        <FormFieldError message={formError} />
        <label>Category<select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Select category</option>{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Code<input value={form.sub_category_code} onChange={(event) => setForm({ ...form, sub_category_code: event.target.value })} /></label>
        <label>Name<input value={form.sub_category_name} onChange={(event) => setForm({ ...form, sub_category_name: event.target.value })} /></label>
        <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      </MasterDataFormModal>
    </div>
  );
}
