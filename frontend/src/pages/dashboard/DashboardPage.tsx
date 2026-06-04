import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { reportsApi, SummaryGroup } from '../../api/reports.api';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { logger } from '../../utils/logger';
import styles from './DashboardPage.module.css';

function MetricCard({ label, value }: { label: string; value?: number }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </article>
  );
}

function BarList({ rows, labelKey }: { rows: SummaryGroup[]; labelKey: 'status' | 'overall_result' | 'model_code' }) {
  const max = Math.max(...rows.map((row) => Number(row.count || row.total || 0)), 1);

  if (!rows.length) {
    return <div className="mutedText">No chart data</div>;
  }

  return (
    <div className="barList">
      {rows.map((row) => {
        const label = row[labelKey] || 'N/A';
        const value = Number(row.count || row.total || 0);
        const width = Math.max((value / max) * 100, 4);
        return (
          <div className="barRow" key={label}>
            <span>{label}</span>
            <div><i style={{ width: `${width}%` }} /></div>
            <strong>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      logger.info('[DASHBOARD][LOAD][START]');
      const result = await Promise.all([
        reportsApi.getDashboardSummary(),
        reportsApi.getQcSummary({ date_from: '2026-06-01', date_to: '2026-12-31' }),
        reportsApi.getQaSummary({ date_from: '2026-06-01', date_to: '2026-12-31' }),
        reportsApi.getLotStatus(),
      ]);
      logger.info('[DASHBOARD][LOAD][API_SUCCESS]', {
        totalLots: result[0].production.total_lots,
        qcTotal: result[0].qc.total_inspections,
        qaTotal: result[0].qa.total_samplings,
      });
      return result;
    },
  });

  if (query.isLoading) {
    return <LoadingPanel label="Loading dashboard..." />;
  }

  if (query.error) {
    return <ErrorAlert error={query.error} />;
  }

  const [summary, qc, qa, lotStatus] = query.data!;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Production Overview</h1>
        </div>
        <button type="button" className="textButton" onClick={() => query.refetch()}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <section className={styles.metrics}>
        <MetricCard label="Total Lots" value={summary.production.total_lots} />
        <MetricCard label="Open Lots" value={summary.production.open_lots} />
        <MetricCard label="Total Units" value={summary.production.total_units} />
        <MetricCard label="QC Inspections" value={summary.qc.total_inspections} />
        <MetricCard label="QA Samplings" value={summary.qa.total_samplings} />
      </section>

      <section className={styles.panels}>
        <article className="panel">
          <h2>Lot Status</h2>
          <BarList rows={lotStatus.map((row) => ({ status: row.status, count: row.count }))} labelKey="status" />
        </article>
        <article className="panel">
          <h2>QC Result</h2>
          <BarList rows={qc.by_result} labelKey="overall_result" />
        </article>
        <article className="panel">
          <h2>QA Result</h2>
          <BarList rows={qa.by_result} labelKey="overall_result" />
        </article>
      </section>

      <section className={styles.panels}>
        <article className="panel wide">
          <h2>QC by Model</h2>
          <BarList rows={qc.by_model} labelKey="model_code" />
        </article>
        <article className="panel wide">
          <h2>QA by Model</h2>
          <BarList rows={qa.by_model} labelKey="model_code" />
        </article>
      </section>
    </div>
  );
}
