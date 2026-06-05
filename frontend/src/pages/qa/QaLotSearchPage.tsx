import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { qaApi } from '../../api/qa.api';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { logger } from '../../utils/logger';

export function QaLotSearchPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: '',
    model_code: '',
    lot_number: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  const [submittedFilters, setSubmittedFilters] = useState(filters);

  const lots = useQuery({
    queryKey: ['qa-lot-search', submittedFilters],
    queryFn: () => {
      logger.info('[QA_LOT_PAGE][LOAD][START]', submittedFilters);
      return qaApi.getLots(submittedFilters);
    },
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters({ ...filters, [key]: value });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmittedFilters(filters);
  }

  function openLot(lotId: number) {
    logger.info('[QA_LOT_PAGE][LOT_OPEN]', { lotId });
    navigate(`/qa/sampling/lots/${lotId}`);
  }

  if (lots.isSuccess) {
    logger.info('[QA_LOT_PAGE][LOAD][API_SUCCESS]', { count: lots.data.length });
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">QA Sampling</span>
          <h1>Lot Search</h1>
          <p className="mutedText">Select a production lot to create or continue QA sampling.</p>
        </div>
      </div>

      <form className="filters qcLotFilters" onSubmit={submit}>
        <label>Search<input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="lot, model, product" /></label>
        <label>Model<input value={filters.model_code} onChange={(event) => updateFilter('model_code', event.target.value)} placeholder="All" /></label>
        <label>Lot<input value={filters.lot_number} onChange={(event) => updateFilter('lot_number', event.target.value)} placeholder="All" /></label>
        <label>Status<select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="">All</option>
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select></label>
        <label>From<input type="date" value={filters.date_from} onChange={(event) => updateFilter('date_from', event.target.value)} /></label>
        <label>To<input type="date" value={filters.date_to} onChange={(event) => updateFilter('date_to', event.target.value)} /></label>
        <button className="primaryButton" type="submit"><Search size={16} /> Search</button>
      </form>

      {lots.error ? <ErrorAlert error={lots.error} /> : null}
      {lots.isLoading ? <LoadingPanel /> : null}

      <section className="panel">
        <h2>QA Lots</h2>
        {!lots.data?.length && !lots.isLoading ? <EmptyState message="No QA lots found" /> : null}
        {lots.data?.length ? (
          <div className="tableScroll">
            <table>
              <thead><tr><th>Lot</th><th>Model</th><th>Product</th><th>Qty</th><th>Serials</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {lots.data.map((lot) => (
                  <tr key={lot.id}>
                    <td>{lot.lot_number}</td>
                    <td>{lot.model_code}</td>
                    <td>{lot.product_name}</td>
                    <td>{lot.lot_qty}</td>
                    <td>{lot.serial_count}</td>
                    <td><StatusBadge value={lot.status} /></td>
                    <td><button className="textButton" onClick={() => openLot(lot.id)} type="button">Open Lot</button></td>
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
