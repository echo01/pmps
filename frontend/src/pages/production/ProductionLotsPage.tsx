import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { CreateProductionLotPayload, productionLotsApi, ProductionLot } from '../../api/productionLots.api';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';

type TabKey = 'current' | 'all' | 'create';

const defaultFilters = {
  search: '',
  model_code: '',
  lot_number: '',
  status: '',
  date_from: '2026-06-01',
  date_to: '2026-12-31',
  page: 1,
  page_size: 20,
};

const defaultForm = {
  model_id: '',
  lot_number: '',
  production_date: new Date().toISOString().slice(0, 10),
  lot_qty: '1',
  serial_prefix: '',
  serial_start_number: '1',
  serial_padding: '3',
  ecn_ids: '',
  remark: '',
};

function normalize(value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed.toLowerCase() === 'all' || trimmed === 'ทั้งหมด' ? '' : trimmed;
}

function parseEcnIds(value: string) {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function ProductionLotsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('current');
  const [filters, setFilters] = useState(defaultFilters);
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingLot, setDeletingLot] = useState<ProductionLot | null>(null);

  const apiFilters = useMemo(() => ({
    search: normalize(filters.search),
    model_code: normalize(filters.model_code),
    lot_number: normalize(filters.lot_number),
    status: normalize(filters.status),
    date_from: filters.date_from,
    date_to: filters.date_to,
    page: filters.page,
    page_size: filters.page_size,
  }), [filters]);

  const models = useQuery({
    queryKey: ['product-model-lookups'],
    queryFn: productsApi.getProductModelLookups,
  });

  const currentLots = useQuery({
    queryKey: ['current-lots', apiFilters],
    queryFn: async () => {
      logger.info('[PRODUCTION_LOTS][CURRENT_LOAD][START]', apiFilters);
      const rows = await productionLotsApi.getCurrentLots(apiFilters);
      logger.info('[PRODUCTION_LOTS][CURRENT_LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
    enabled: activeTab === 'current',
  });

  const lotList = useQuery({
    queryKey: ['production-lots', apiFilters],
    queryFn: async () => {
      logger.info('[PRODUCTION_LOTS][LIST_LOAD][START]', apiFilters);
      const result = await productionLotsApi.getProductionLots(apiFilters);
      logger.info('[PRODUCTION_LOTS][LIST_LOAD][API_SUCCESS]', { total: result.pagination.total, returned: result.rows.length });
      return result;
    },
    enabled: activeTab === 'all',
  });

  const previewMutation = useMutation({
    mutationFn: () => productionLotsApi.generateSerials({
      prefix: form.serial_prefix,
      start_number: Number(form.serial_start_number),
      count: Number(form.lot_qty),
      padding: Number(form.serial_padding),
    }),
    onSuccess: (serials) => {
      logger.info('[PRODUCTION_LOTS][SERIAL_PREVIEW][API_SUCCESS]', { count: serials.length });
      setPreview(serials);
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateProductionLotPayload) => productionLotsApi.createProductionLot(payload),
    onSuccess: (result) => {
      logger.info('[PRODUCTION_LOTS][CREATE][API_SUCCESS]', { lotId: result.lot.id, serialCount: result.serials.length });
      setForm(defaultForm);
      setPreview([]);
      setActiveTab('all');
      queryClient.invalidateQueries({ queryKey: ['production-lots'] });
      queryClient.invalidateQueries({ queryKey: ['current-lots'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (lot: ProductionLot) => productionLotsApi.deleteProductionLot(lot.id),
    onSuccess: (_, lot) => {
      logger.info('[PRODUCTION_LOTS][DELETE][API_SUCCESS]', { lotId: lot.id });
      setDeletingLot(null);
      queryClient.invalidateQueries({ queryKey: ['production-lots'] });
      queryClient.invalidateQueries({ queryKey: ['current-lots'] });
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  function setFilter(key: keyof typeof defaultFilters, value: string | number) {
    setFilters({ ...filters, [key]: value });
  }

  function setFormField(key: keyof typeof defaultForm, value: string) {
    setForm({ ...form, [key]: value });
  }

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...filters, page: 1 });
  }

  function validateForm() {
    if (!form.model_id) return 'Product model is required';
    if (!form.lot_number.trim()) return 'Lot number is required';
    if (Number(form.lot_qty) <= 0) return 'Lot qty must be greater than 0';
    if (Number(form.serial_padding) < 0) return 'Serial padding must be 0 or more';
    if (Number(form.lot_qty) > 5000) return 'Lot qty must be 5000 or less';
    return null;
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    const validation = validateForm();
    setFormError(validation);
    if (validation) return;

    const payload: CreateProductionLotPayload = {
      model_id: Number(form.model_id),
      lot_number: form.lot_number.trim(),
      production_date: form.production_date || null,
      lot_qty: Number(form.lot_qty),
      remark: form.remark.trim() || null,
      serial_generation: {
        prefix: form.serial_prefix,
        start_number: Number(form.serial_start_number),
        count: Number(form.lot_qty),
        padding: Number(form.serial_padding),
      },
      ecn_ids: parseEcnIds(form.ecn_ids),
    };

    logger.info('[PRODUCTION_LOTS][CREATE][START]', {
      model_id: payload.model_id,
      lot_number: payload.lot_number,
      lot_qty: payload.lot_qty,
      ecnCount: payload.ecn_ids?.length || 0,
    });
    await createMutation.mutateAsync(payload);
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Production</span>
          <h1>Production Lots</h1>
        </div>
        <button className="textButton" type="button" onClick={() => {
          currentLots.refetch();
          lotList.refetch();
        }}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="tabs">
        <button type="button" className={activeTab === 'current' ? 'active' : ''} onClick={() => setActiveTab('current')}>Current Lots</button>
        <button type="button" className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All Lots</button>
        <button type="button" className={activeTab === 'create' ? 'active' : ''} onClick={() => setActiveTab('create')}><Plus size={16} /> Create Lot</button>
      </div>

      {activeTab !== 'create' ? (
        <form className="filters" onSubmit={submitFilters}>
          <label>Search<input value={filters.search} placeholder="All, lot, model" onChange={(event) => setFilter('search', event.target.value)} /></label>
          <label>Model<input value={filters.model_code} placeholder="All" onChange={(event) => setFilter('model_code', event.target.value)} /></label>
          <label>Lot<input value={filters.lot_number} placeholder="All" onChange={(event) => setFilter('lot_number', event.target.value)} /></label>
          <label>Status<select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">All</option><option value="OPEN">OPEN</option><option value="COMPLETED">COMPLETED</option><option value="HOLD">HOLD</option><option value="CLOSED">CLOSED</option><option value="CANCELLED">CANCELLED</option>
          </select></label>
          <label>From<input type="date" value={filters.date_from} onChange={(event) => setFilter('date_from', event.target.value)} /></label>
          <label>To<input type="date" value={filters.date_to} onChange={(event) => setFilter('date_to', event.target.value)} /></label>
          <button className="primaryButton" type="submit">Search</button>
        </form>
      ) : null}

      {deleteMutation.error ? <ErrorAlert error={deleteMutation.error} title="Unable to delete production lot" /> : null}

      {activeTab === 'current' ? <LotTable rows={currentLots.data || []} loading={currentLots.isLoading} error={currentLots.error} onDelete={setDeletingLot} /> : null}
      {activeTab === 'all' ? (
        <section className="panel">
          {lotList.isLoading ? <LoadingPanel /> : null}
          {lotList.error ? <ErrorAlert error={lotList.error} /> : null}
          {lotList.data && lotList.data.rows.length === 0 ? <EmptyState /> : null}
          {lotList.data && lotList.data.rows.length > 0 ? (
            <>
              <LotTableInner rows={lotList.data.rows} onDelete={setDeletingLot} />
              <Pagination
                page={lotList.data.pagination.page}
                pageSize={lotList.data.pagination.page_size}
                total={lotList.data.pagination.total}
                onPageChange={(page) => setFilters({ ...filters, page })}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'create' ? (
        <section className="panel">
          <h2>Create Production Lot</h2>
          {models.error ? <ErrorAlert error={models.error} title="Unable to load product models" /> : null}
          {formError ? <div className="alert error"><strong>Validation</strong><span>{formError}</span></div> : null}
          {previewMutation.error ? <ErrorAlert error={previewMutation.error} title="Unable to generate serial preview" /> : null}
          {createMutation.error ? <ErrorAlert error={createMutation.error} title="Unable to create production lot" /> : null}

          <form className="formGrid" onSubmit={submitCreate}>
            <label>Product Model<select value={form.model_id} onChange={(event) => setFormField('model_id', event.target.value)}>
              <option value="">Select model</option>
              {(models.data || []).map((model) => <option key={model.id} value={model.id}>{model.model_code} - {model.product_name}</option>)}
            </select></label>
            <label>Lot Number<input value={form.lot_number} onChange={(event) => setFormField('lot_number', event.target.value)} /></label>
            <label>Production Date<input type="date" value={form.production_date} onChange={(event) => setFormField('production_date', event.target.value)} /></label>
            <label>Lot Qty<input type="number" min="1" max="5000" value={form.lot_qty} onChange={(event) => setFormField('lot_qty', event.target.value)} /></label>
            <label>Serial Prefix<input value={form.serial_prefix} onChange={(event) => setFormField('serial_prefix', event.target.value)} /></label>
            <label>Start Number<input type="number" min="0" value={form.serial_start_number} onChange={(event) => setFormField('serial_start_number', event.target.value)} /></label>
            <label>Padding<input type="number" min="0" max="20" value={form.serial_padding} onChange={(event) => setFormField('serial_padding', event.target.value)} /></label>
            <label>ECN IDs<input value={form.ecn_ids} placeholder="1,2,3" onChange={(event) => setFormField('ecn_ids', event.target.value)} /></label>
            <label className="span2">Remark<input value={form.remark} onChange={(event) => setFormField('remark', event.target.value)} /></label>
            <div className="formActions">
              <button className="textButton" type="button" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
                <Wand2 size={16} /> Preview Serials
              </button>
              <button className="primaryButton" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Lot'}
              </button>
            </div>
          </form>

          <div className="previewPanel">
            <h2>Serial Preview</h2>
            {preview.length ? (
              <div className="serialPreview">{preview.slice(0, 200).map((serial) => <span key={serial}>{serial}</span>)}</div>
            ) : <EmptyState message="Generate preview before creating a lot" />}
            {preview.length > 200 ? <p className="mutedText">Showing first 200 of {preview.length} serials.</p> : null}
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingLot)}
        title="Delete Production Lot"
        message={deletingLot
          ? `Delete "${deletingLot.lot_number}" and all related serial, QC, QA, report, audit, ECN, and planning data? This cannot be undone.`
          : ''}
        confirming={deleteMutation.isPending}
        onCancel={() => setDeletingLot(null)}
        onConfirm={() => {
          if (deletingLot) deleteMutation.mutate(deletingLot);
        }}
      />
    </div>
  );
}

function LotTable({
  rows,
  loading,
  error,
  onDelete,
}: {
  rows: ProductionLot[];
  loading: boolean;
  error: unknown;
  onDelete: (lot: ProductionLot) => void;
}) {
  return (
    <section className="panel">
      {loading ? <LoadingPanel /> : null}
      {error ? <ErrorAlert error={error} /> : null}
      {!loading && !error && rows.length === 0 ? <EmptyState /> : null}
      {rows.length ? <LotTableInner rows={rows} onDelete={onDelete} /> : null}
    </section>
  );
}

function LotTableInner({ rows, onDelete }: { rows: ProductionLot[]; onDelete: (lot: ProductionLot) => void }) {
  return (
    <table>
      <thead><tr><th>Lot</th><th>Model</th><th>Qty</th><th>Serials</th><th>Status</th><th>Production Date</th><th>Action</th></tr></thead>
      <tbody>
        {rows.map((lot) => (
          <tr key={lot.id}>
            <td>{lot.lot_number}</td>
            <td>{lot.model_code}</td>
            <td>{lot.lot_qty}</td>
            <td>{lot.serial_count}</td>
            <td><StatusBadge value={lot.status} /></td>
            <td>{formatDate(lot.production_date)}</td>
            <td>
              <div className="tableActions">
                <Link className="textButton" to={`/production-lots/${lot.id}`}><Eye size={16} /> Detail</Link>
                <Link className="textButton" to={`/production-lots/${lot.id}#update-lot`}><Pencil size={16} /> Edit</Link>
                <button className="iconButton dangerButton" type="button" title={`Delete ${lot.lot_number}`} aria-label={`Delete ${lot.lot_number}`} onClick={() => onDelete(lot)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
