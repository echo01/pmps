import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { productionLotsApi } from '../../api/productionLots.api';
import { StatusBadge } from '../../components/badges/StatusBadge';
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
  const queryClient = useQueryClient();
  const [ecnIds, setEcnIds] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'CLOSED' | 'HOLD' | 'CANCELLED'>('OPEN');
  const [remark, setRemark] = useState('');

  const lotQuery = useQuery({
    queryKey: ['production-lot-detail', id],
    queryFn: async () => {
      const lot = await productionLotsApi.getProductionLot(id);
      setEcnIds((lot.ecn_refs || []).map((ref) => ref.ecn_id).join(','));
      setStatus(lot.status as 'OPEN' | 'CLOSED' | 'HOLD' | 'CANCELLED');
      setRemark(lot.remark || '');
      return lot;
    },
  });

  const serialsQuery = useQuery({
    queryKey: ['production-lot-serials', id],
    queryFn: () => productionLotsApi.getProductionLotSerials(id),
  });

  const updateLot = useMutation({
    mutationFn: () => productionLotsApi.updateProductionLot(id, { status, remark }),
    onSuccess: () => {
      logger.info('[PRODUCTION_LOTS][UPDATE][API_SUCCESS]', { lotId: id });
      queryClient.invalidateQueries({ queryKey: ['production-lot-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['production-lots'] });
      queryClient.invalidateQueries({ queryKey: ['current-lots'] });
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
    logger.info('[PRODUCTION_LOTS][UPDATE][START]', { lotId: id, status });
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

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <Link className="backLink" to="/production-lots">Back to Production Lots</Link>
          <h1>{lot.lot_number}</h1>
        </div>
      </div>

      <section className="panel">
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
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="OPEN">OPEN</option>
            <option value="HOLD">HOLD</option>
            <option value="CLOSED">CLOSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select></label>
          <label className="span2">Remark<input value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
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
    </div>
  );
}
