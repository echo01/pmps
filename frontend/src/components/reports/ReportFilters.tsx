import { Search } from 'lucide-react';
import { FormEvent } from 'react';
import type { ReportFiltersState, ReportTab } from '../../pages/reports/ReportsPage';

type ReportFiltersProps = {
  activeTab: ReportTab;
  filters: ReportFiltersState;
  onChange: (filters: ReportFiltersState) => void;
  onSubmit: () => void;
};

export function ReportFilters({ activeTab, filters, onChange, onSubmit }: ReportFiltersProps) {
  function setField(key: keyof ReportFiltersState, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="filters" onSubmit={submit}>
      <label>
        Search
        <input value={filters.search} onChange={(event) => setField('search', event.target.value)} placeholder="All, lot, serial, model" />
      </label>
      <label>
        Model
        <input value={filters.model_code} onChange={(event) => setField('model_code', event.target.value)} placeholder="All" />
      </label>
      <label>
        Lot
        <input value={filters.lot_number} onChange={(event) => setField('lot_number', event.target.value)} placeholder="All" />
      </label>
      {activeTab !== 'lots' && (
        <label>
          Serial
          <input value={filters.serial_number} onChange={(event) => setField('serial_number', event.target.value)} placeholder="All" />
        </label>
      )}
      <label>
        Status
        <select value={filters.status} onChange={(event) => setField('status', event.target.value)}>
          <option value="">All</option>
          <option value="OPEN">OPEN</option>
          <option value="HOLD">HOLD</option>
          <option value="CLOSED">CLOSED</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="REVIEWED">REVIEWED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </label>
      {(activeTab === 'qc' || activeTab === 'qa') && (
        <label>
          Result
          <select value={filters.result} onChange={(event) => setField('result', event.target.value)}>
            <option value="">All</option>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
            <option value="N/A">N/A</option>
          </select>
        </label>
      )}
      <label>
        From
        <input type="date" value={filters.date_from} onChange={(event) => setField('date_from', event.target.value)} />
      </label>
      <label>
        To
        <input type="date" value={filters.date_to} onChange={(event) => setField('date_to', event.target.value)} />
      </label>
      <button type="submit" className="primaryButton">
        <Search size={16} />
        Search
      </button>
    </form>
  );
}
