import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productionLotsApi } from '../../api/productionLots.api';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { formatDate, formatDateTime } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';
import { KeyValueGrid } from '../reports/detailHelpers';

function parseEcnIds(value: string) {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function ProductionLotDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ecnIds, setEcnIds] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'COMPLETED' | 'CLOSED' | 'HOLD' | 'CANCELLED'>('OPEN');
  const [remark, setRemark] = useState('');
  const [lotQty, setLotQty] = useState('1');
  const [serialPrefix, setSerialPrefix] = useState('');
  const [serialStartNumber, setSerialStartNumber] = useState('1');
  const [serialPadding, setSerialPadding] = useState('3');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const lotQuery = useQuery({
    queryKey: ['production-lot-detail', id],
    queryFn: async () => {
      const lot = await productionLotsApi.getProductionLot(id);
      setEcnIds((lot.ecn_refs || []).map((ref) => ref.ecn_id).join(','));
      setStatus(lot.status as 'OPEN' | 'COMPLETED' | 'CLOSED' | 'HOLD' | 'CANCELLED');
      setRemark(lot.remark || '');
      setLotQty(String(lot.lot_qty));
      return lot;
    },
  });

  const serialsQuery = useQuery({
    queryKey: ['production-lot-serials', id],
    queryFn: () => productionLotsApi.getProductionLotSerials(id),
  });

  const updateLot = useMutation({
    mutationFn: () => {
      const nextQty = Number(lotQty);
      const currentQty = Number(lotQuery.data?.serial_count || 0);

      return productionLotsApi.updateProductionLot(id, {
        status,
        remark,
        lot_qty: nextQty,
        ...(nextQty > currentQty
          ? {
              serial_generation: {
                prefix: serialPrefix,
                start_number: Number(serialStartNumber),
                count: nextQty - currentQty,
                padding: Number(serialPadding),
              },
            }
          : {}),
      });
    },
    onSuccess: (updated) => {
      logger.info('[PRODUCTION_LOTS][UPDATE][API_SUCCESS]', { lotId: id });
      setLotQty(String(updated.lot_qty));
      queryClient.invalidateQueries({ queryKey: ['production-lot-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['production-lot-serials', id] });
      queryClient.invalidateQueries({ queryKey: ['production-lots'] });
      queryClient.invalidateQueries({ queryKey: ['current-lots'] });
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const deleteLot = useMutation({
    mutationFn: () => productionLotsApi.deleteProductionLot(id),
    onSuccess: () => {
      logger.info('[PRODUCTION_LOTS][DELETE][API_SUCCESS]', { lotId: id });
      queryClient.invalidateQueries({ queryKey: ['production-lots'] });
      queryClient.invalidateQueries({ queryKey: ['current-lots'] });
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate('/production-lots');
    },
  });

  const updateEcn = useMutation({
    mutationFn: () => productionLotsApi.updateLotEcnRefs(id, parseEcnIds(ecnIds)),
    onSuccess: () => {
      logger.info('[PRODUCTION_LOTS][ECN_UPDATE][API_SUCCESS]', { lotId: id });
      queryClient.invalidateQueries({ queryKey: ['production-lot-detail', id] });
    },
  });

  function submitLot(event: FormEvent) {
    event.preventDefault();
    const nextQty = Number(lotQty);
    if (!Number.isInteger(nextQty) || nextQty < 1 || nextQty > 5000) return;

    logger.info('[PRODUCTION_LOTS][UPDATE][START]', { lotId: id, status, lotQty: nextQty });
    updateLot.mutate();
  }

  function submitEcn(event: FormEvent) {
    event.preventDefault();
    logger.info('[PRODUCTION_LOTS][ECN_UPDATE][START]', { lotId: id, ecnCount: parseEcnIds(ecnIds).length });
    updateEcn.mutate();
  }

  if (lotQuery.isLoading) return <LoadingPanel />;
  if (lotQuery.error) return <ErrorAlert error={lotQuery.error} />;
  if (!lotQuery.data) return <EmptyState message="Production lot not found" />;

  const lot = lotQuery.data;
  const nextQty = Number(lotQty);
  const addedQty = Number.isFinite(nextQty) ? nextQty - lot.serial_count : 0;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <Link className="backLink" to="/production-lots">Back to Production Lots</Link>
          <h1>{lot.lot_number}</h1>
        </div>
      </div>

      <section className="panel" id="update-lot">
        <KeyValueGrid items={[
          ['Model', `${lot.model_code} - ${lot.product_name}`],
          ['Status', <StatusBadge value={lot.status} />],
          ['Qty', lot.lot_qty],
          ['Serial Count', lot.serial_count],
          ['Production Date', formatDate(lot.production_date)],
          ['Created At', formatDateTime(lot.created_at)],
        ]} />
      </section>

      <section className="panel">
        <h2>Update Lot</h2>
        {updateLot.error ? <ErrorAlert error={updateLot.error} title="Unable to update lot" /> : null}
        <form className="formGrid" onSubmit={submitLot}>
          <label>Lot Qty<input type="number" min="1" max="5000" value={lotQty} onChange={(event) => setLotQty(event.target.value)} /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="OPEN">OPEN</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="HOLD">HOLD</option>
            <option value="CLOSED">CLOSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select></label>
          <label className="span2">Remark<input value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
          {addedQty > 0 ? (
            <>
              <div className="span2 mutedText">Add {addedQty} new serial{addedQty === 1 ? '' : 's'} to this lot.</div>
              <label>New Serial Prefix<input value={serialPrefix} onChange={(event) => setSerialPrefix(event.target.value)} /></label>
              <label>Start Number<input type="number" min="0" value={serialStartNumber} onChange={(event) => setSerialStartNumber(event.target.value)} /></label>
              <label>Padding<input type="number" min="0" max="20" value={serialPadding} onChange={(event) => setSerialPadding(event.target.value)} /></label>
            </>
          ) : null}
          {addedQty < 0 ? (
            <div className="span2 alert warning">
              <strong>Reduce lot by {Math.abs(addedQty)} serial{Math.abs(addedQty) === 1 ? '' : 's'}</strong>
              <span>Untested serials are removed first. Related QC, QA, and audit records for removed serials are deleted.</span>
            </div>
          ) : null}
          <div className="formActions"><button className="primaryButton" type="submit"><Save size={16} /> Save Lot</button></div>
        </form>
      </section>

      <section className="panel">
        <h2>ECN References</h2>
        {updateEcn.error ? <ErrorAlert error={updateEcn.error} title="Unable to update ECN references" /> : null}
        <form className="formGrid" onSubmit={submitEcn}>
          <label className="span2">ECN IDs<input value={ecnIds} placeholder="1,2,3" onChange={(event) => setEcnIds(event.target.value)} /></label>
          <div className="formActions"><button className="primaryButton" type="submit"><Save size={16} /> Save ECN</button></div>
        </form>
        {(lot.ecn_refs || []).length ? (
          <table>
            <thead><tr><th>ECN No</th><th>Title</th><th>Revision</th><th>Created</th></tr></thead>
            <tbody>{(lot.ecn_refs || []).map((ref) => <tr key={ref.id}><td>{ref.ecn_no}</td><td>{ref.ecn_title || '-'}</td><td>{ref.revision || '-'}</td><td>{formatDateTime(ref.created_at)}</td></tr>)}</tbody>
          </table>
        ) : <EmptyState message="No ECN references" />}
      </section>

      <section className="panel">
        <h2>Serials</h2>
        {serialsQuery.isLoading ? <LoadingPanel /> : null}
        {serialsQuery.error ? <ErrorAlert error={serialsQuery.error} /> : null}
        {serialsQuery.data?.length ? (
          <table>
            <thead><tr><th>Serial</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{serialsQuery.data.map((serial) => <tr key={serial.id}><td>{serial.serial_number}</td><td><StatusBadge value={serial.unit_status} /></td><td>{formatDateTime(serial.created_at)}</td></tr>)}</tbody>
          </table>
        ) : <EmptyState message="No serials found" />}
      </section>

      <section className="panel">
        <h2>Delete Production Lot</h2>
        {deleteLot.error ? <ErrorAlert error={deleteLot.error} title="Unable to delete production lot" /> : null}
        <p className="mutedText">Deletes this lot together with serials, QC inspections, QA sampling, audit history, reports, ECN references, and its test plan.</p>
        <button className="dangerButton" type="button" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} /> Delete Lot
        </button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Production Lot"
        message={`Delete "${lot.lot_number}" and all related QC, QA, report, audit, serial, and planning data? This cannot be undone.`}
        confirming={deleteLot.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteLot.mutate()}
      />
    </div>
  );
}
