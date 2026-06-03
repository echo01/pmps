import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../../api/reports.api';
import type { QaSamplingReportRow, QcInspectionReportRow, ReportFilters as ReportFilterParams, SerialReportRow } from '../../api/reports.api';
import { ResultBadge } from '../../components/badges/ResultBadge';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { Pagination } from '../../components/common/Pagination';
import { ExportButtons } from '../../components/reports/ExportButtons';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { ReportTabs } from '../../components/reports/ReportTabs';
import { formatDate, formatDateTime } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';
import styles from './ReportsPage.module.css';

export type ReportTab = 'lots' | 'serials' | 'qc' | 'qa';

export type ReportFiltersState = {
  search: string;
  model_code: string;
  lot_number: string;
  serial_number: string;
  status: string;
  result: string;
  date_from: string;
  date_to: string;
  page: number;
  page_size: number;
};

const defaultFilters: ReportFiltersState = {
  search: '',
  model_code: '',
  lot_number: '',
  serial_number: '',
  status: '',
  result: '',
  date_from: '2026-06-01',
  date_to: '2026-12-31',
  page: 1,
  page_size: 20,
};

function normalizeFilterValue(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  if (!trimmed || normalized === 'all' || trimmed === 'ทั้งหมด') {
    return '';
  }

  return trimmed;
}

function toApiFilters(filters: ReportFiltersState): ReportFilterParams {
  return {
    search: normalizeFilterValue(filters.search),
    model_code: normalizeFilterValue(filters.model_code),
    lot_number: normalizeFilterValue(filters.lot_number),
    serial_number: normalizeFilterValue(filters.serial_number),
    status: normalizeFilterValue(filters.status),
    result: normalizeFilterValue(filters.result),
    date_from: filters.date_from,
    date_to: filters.date_to,
    page: filters.page,
    page_size: filters.page_size,
  };
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useStateWithStorage<ReportTab>('pmps_report_tab', 'lots');
  const [filters, setFilters] = useStateWithStorage<ReportFiltersState>('pmps_report_filters', defaultFilters);

  const query = useQuery({
    queryKey: ['reports', activeTab, filters],
    queryFn: async () => {
      logger.info('[REPORT][SEARCH][START]', { activeTab, page: filters.page, pageSize: filters.page_size });
      const params = toApiFilters(filters);
      const data = await ({
        lots: () => reportsApi.searchLots(params),
        serials: () => reportsApi.searchSerials(params),
        qc: () => reportsApi.searchQcInspections(params),
        qa: () => reportsApi.searchQaSamplings(params),
      }[activeTab]());
      logger.info('[REPORT][SEARCH][API_SUCCESS]', { activeTab, total: data.pagination.total, returned: data.rows.length });
      return data;
    },
  });

  function changeTab(tab: ReportTab) {
    setActiveTab(tab);
    setFilters({ ...filters, page: 1, status: '', result: '' });
  }

  function submitSearch() {
    setFilters({ ...filters, page: 1 });
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Reports</span>
          <h1>Search and Export</h1>
        </div>
        <ExportButtons activeTab={activeTab} filters={filters} />
      </div>

      <ReportTabs activeTab={activeTab} onChange={changeTab} />
      <ReportFilters activeTab={activeTab} filters={filters} onChange={setFilters} onSubmit={submitSearch} />

      <section className="panel">
        {query.isLoading ? <LoadingPanel /> : null}
        {query.error ? <ErrorAlert error={query.error} /> : null}
        {query.data && query.data.rows.length === 0 ? <EmptyState /> : null}
        {query.data && query.data.rows.length > 0 ? (
          <>
            <div className={styles.tableWrap}>{renderTable(activeTab, query.data.rows)}</div>
            <Pagination
              page={query.data.pagination.page}
              pageSize={query.data.pagination.page_size}
              total={query.data.pagination.total}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function renderTable(activeTab: ReportTab, rows: unknown[]) {
  if (activeTab === 'lots') {
    return (
      <table>
        <thead><tr><th>Lot</th><th>Model</th><th>Qty</th><th>Serials</th><th>QC</th><th>QA</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const lot = row as { lot_id: number; lot_number: string; model_code: string; lot_qty: number; serial_count: number; qc_count: number; qa_sampling_count: number; lot_status: string; production_date: string };
            return (
              <tr key={lot.lot_id}>
                <td><Link className={styles.rowLink} to={`/reports/lots/${lot.lot_id}`}>{lot.lot_number}</Link></td>
                <td>{lot.model_code}</td>
                <td>{lot.lot_qty}</td>
                <td>{lot.serial_count}</td>
                <td>{lot.qc_count}</td>
                <td>{lot.qa_sampling_count}</td>
                <td><StatusBadge value={lot.lot_status} /></td>
                <td>{formatDate(lot.production_date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (activeTab === 'serials') {
    return (
      <table>
        <thead><tr><th>Serial</th><th>Lot</th><th>Model</th><th>Unit</th><th>QC</th><th>QA</th></tr></thead>
        <tbody>
          {(rows as SerialReportRow[]).map((row) => (
            <tr key={row.product_unit_id}>
              <td><Link className={styles.rowLink} to={`/reports/serials/${row.product_unit_id}`}>{row.serial_number}</Link></td>
              <td>{row.lot_number}</td>
              <td>{row.model_code}</td>
              <td><StatusBadge value={row.unit_status} /></td>
              <td><ResultBadge value={row.latest_qc_result} /></td>
              <td><ResultBadge value={row.latest_qa_result} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (activeTab === 'qc') {
    return (
      <table>
        <thead><tr><th>ID</th><th>Serial</th><th>Lot</th><th>Model</th><th>Status</th><th>Result</th><th>Datetime</th></tr></thead>
        <tbody>
          {(rows as QcInspectionReportRow[]).map((row) => (
            <tr key={row.inspection_id}>
              <td><Link className={styles.rowLink} to={`/reports/qc-inspections/${row.inspection_id}`}>{row.inspection_id}</Link></td>
              <td>{row.serial_number}</td>
              <td>{row.lot_number}</td>
              <td>{row.model_code}</td>
              <td><StatusBadge value={row.status} /></td>
              <td><ResultBadge value={row.overall_result} /></td>
              <td>{formatDateTime(row.inspection_datetime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table>
      <thead><tr><th>ID</th><th>Lot</th><th>Model</th><th>Sample Qty</th><th>Status</th><th>Result</th><th>Datetime</th></tr></thead>
      <tbody>
        {(rows as QaSamplingReportRow[]).map((row) => (
          <tr key={row.qa_sampling_id}>
            <td><Link className={styles.rowLink} to={`/reports/qa-samplings/${row.qa_sampling_id}`}>{row.qa_sampling_id}</Link></td>
            <td>{row.lot_number}</td>
            <td>{row.model_code}</td>
            <td>{row.sample_qty}</td>
            <td><StatusBadge value={row.status} /></td>
            <td><ResultBadge value={row.overall_result} /></td>
            <td>{formatDateTime(row.sampling_datetime)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useStateWithStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : initialValue;
  });

  function setStored(next: T) {
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  return [value, setStored] as const;
}
