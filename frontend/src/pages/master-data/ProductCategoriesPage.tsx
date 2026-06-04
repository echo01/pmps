import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { productsApi, ProductCategory } from '../../api/products.api';
import { BooleanBadge } from '../../components/master-data/MasterDataBadges';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';
import { MasterDataToolbar } from '../../components/master-data/MasterDataToolbar';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { FormFieldError } from '../../components/common/FormFieldError';
import { logger } from '../../utils/logger';
import { activeQuery, logConflict, ModalMode, preventDefault, textOrNull } from './masterDataUtils';

const emptyForm = { category_code: '', category_name: '', description: '', active: true };

export function ProductCategoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [filters, setFilters] = useState({ search: '', active: '' });
  const [mode, setMode] = useState<ModalMode>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['product-categories', filters],
    queryFn: async () => {
      logger.info('[PRODUCT][CATEGORY_LOAD][START]', filters);
      const rows = await productsApi.getProductCategories({ search: filters.search, active: activeQuery(filters.active) });
      logger.info('[PRODUCT][CATEGORY_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.category_code.trim()) throw new Error('category_code is required');
      if (!form.category_name.trim()) throw new Error('category_name is required');
      const payload = {
        category_code: form.category_code.trim().toUpperCase(),
        category_name: form.category_name.trim(),
        description: textOrNull(form.description),
        active: form.active,
      };
      logger.info('[PRODUCT][CATEGORY_SAVE][START]', { category_code: payload.category_code });
      return mode === 'create'
        ? productsApi.createProductCategory(payload)
        : productsApi.updateProductCategory(editingId || 0, payload);
    },
    onSuccess: (row) => {
      logger.info('[PRODUCT][CATEGORY_SAVE][API_SUCCESS]', { categoryId: row.id });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error) => logConflict('[PRODUCT][CATEGORY_SAVE]', error, { category_code: form.category_code }),
  });

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: ProductCategory) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      category_code: row.category_code,
      category_name: row.category_name,
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
    if (!form.category_code.trim()) return setFormError('category_code is required');
    if (!form.category_name.trim()) return setFormError('category_name is required');
    setFormError(null);
    saveMutation.mutate();
  }

  return (
    <div className="pageStack">
      <div className="pageHeader"><div><span className="eyebrow">Product Master</span><h1>Product Categories</h1></div></div>
      <MasterDataToolbar
        search={search}
        active={active}
        addLabel="Add Category"
        onSearchChange={setSearch}
        onActiveChange={setActive}
        onSubmit={preventDefault(() => setFilters({ search, active }))}
        onAdd={openCreate}
      />
      <section className="panel">
        {categories.isLoading ? <LoadingPanel /> : null}
        {categories.error ? <ErrorAlert error={categories.error} /> : null}
        {categories.data?.length === 0 ? <EmptyState /> : null}
        {categories.data?.length ? (
          <table><thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>{categories.data.map((row) => <tr key={row.id}><td>{row.category_code}</td><td>{row.category_name}</td><td>{row.description || '-'}</td><td><BooleanBadge value={row.active} /></td><td><button className="textButton" onClick={() => openEdit(row)}><Edit size={16} /> Edit</button></td></tr>)}</tbody></table>
        ) : null}
      </section>
      <MasterDataFormModal open={modalOpen} title={mode === 'create' ? 'Add Category' : 'Edit Category'} error={saveMutation.error} saving={saveMutation.isPending} onClose={closeModal} onSubmit={save}>
        {formError ? <FormFieldError message={formError} /> : null}
        <label>Code<input value={form.category_code} onChange={(event) => setForm({ ...form, category_code: event.target.value })} /></label>
        <label>Name<input value={form.category_name} onChange={(event) => setForm({ ...form, category_name: event.target.value })} /></label>
        <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="checkRow"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      </MasterDataFormModal>
    </div>
  );
}
