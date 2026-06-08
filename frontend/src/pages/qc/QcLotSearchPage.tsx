import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { qcApi } from '../../api/qc.api';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { logger } from '../../utils/logger';

const initialFilters = {
  search: '',
  lot_number: '',
  model_code: '',
  status: '',
  date_from: '',
  date_to: '',
};

export function QcLotSearchPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);

  const lots = useQuery({
    queryKey: ['qc-lot-page', filters],
    queryFn: async () => {
      logger.info('[QC_LOT_PAGE][LOAD][START]', { filters });
      const rows = await qcApi.getLots(filters);
      logger.info('[QC_LOT_PAGE][LOAD][API_SUCCESS]', { count: rows.length });
      return rows;
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFilters(form);
  }

  function reset() {
    setForm(initialFilters);
    setFilters(initialFilters);
  }

  function openLot(lotId: number, lotNumber: string) {
    logger.info('[QC_LOT_PAGE][LOT_OPEN]', { lotId, lotNumber });
    navigate(`/qc/inspection/lots/${lotId}`);
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">QC Inspection</span>
          <h1>Lot Search</h1>
        </div>
      </div>

      <form className="filters qcLotFilters" onSubmit={submit}>
        <label>Search<input value={form.search} placeholder="Lot No / Model / Product" onChange={(event) => setForm({ ...form, search: event.target.value })} /></label>
        <label>Lot<input value={form.lot_number} placeholder="Lot number" onChange={(event) => setForm({ ...form, lot_number: event.target.value })} /></label>
        <label>Model<input value={form.model_code} placeholder="Model code" onChange={(event) => setForm({ ...form, model_code: event.target.value })} /></label>
        <label>QC Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="">All</option>
          <option value="NOT_STARTED">NOT_STARTED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="REVIEWED">REVIEWED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="EDIT_REQUESTED">EDIT_REQUESTED</option>
        </select></label>
        <label>From<input type="date" value={form.date_from} onChange={(event) => setForm({ ...form, date_from: event.target.value })} /></label>
        <label>To<input type="date" value={form.date_to} onChange={(event) => setForm({ ...form, date_to: event.target.value })} /></label>
        <button className="primaryButton" type="submit"><Search size={16} /> Search</button>
        <button className="textButton" type="button" onClick={reset}><RotateCcw size={16} /> Reset</button>
      </form>

      <section className="panel">
        {lots.isLoading ? <LoadingPanel /> : null}
        {lots.error ? <ErrorAlert error={lots.error} /> : null}
        {lots.data?.length === 0 ? <EmptyState message="No QC lots found" /> : null}
        {lots.data?.length ? (
          <div className="tableScroll">
            <table>
              <thead>
                <tr>
                  <th>Lot Number</th>
                  <th>Model</th>
                  <th>Product</th>
                  <th>Lot Qty</th>
                  <th>Serial Count</th>
                  <th>QC Status</th>
                  <th>QC Progress</th>
                  <th>Result</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lots.data.map((lot) => (
                  <tr key={lot.id}>
                    <td>{lot.lot_number}</td>
                    <td>{lot.model_code}</td>
                    <td>{lot.product_name}</td>
                    <td>{lot.lot_qty}</td>
                    <td>{lot.serial_count}</td>
                    <td><StatusBadge value={lot.qc_status} /></td>
                    <td>{lot.approved_count} / {lot.serial_count} approved</td>
                    <td><StatusBadge value={lot.qc_result} /></td>
                    <td><button className="textButton" onClick={() => openLot(lot.id, lot.lot_number)}>Open Lot</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
