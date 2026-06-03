import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { reportsApi } from '../../api/reports.api';
import { ResultBadge } from '../../components/badges/ResultBadge';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { formatDateTime } from '../../utils/dateFormat';
import { BackToReports, KeyValueGrid } from './detailHelpers';

export function SerialDetailPage() {
  const { productUnitId = '' } = useParams();
  const query = useQuery({ queryKey: ['serial-detail', productUnitId], queryFn: () => reportsApi.getSerialDetail(productUnitId) });

  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data) return <EmptyState message="Serial not found" />;

  const data = query.data;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <BackToReports />
          <h1>{data.serial_number}</h1>
        </div>
      </div>
      <section className="panel">
        <KeyValueGrid items={[
          ['Lot', data.lot_number],
          ['Model', `${data.model_code} - ${data.product_name}`],
          ['Unit Status', <StatusBadge value={data.unit_status} />],
        ]} />
      </section>
      <section className="panel">
        <h2>QC History</h2>
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Result</th><th>Datetime</th></tr></thead>
          <tbody>
            {data.qc_inspections.map((row) => (
              <tr key={row.inspection_id}>
                <td><Link to={`/reports/qc-inspections/${row.inspection_id}`}>{row.inspection_id}</Link></td>
                <td><StatusBadge value={row.status} /></td>
                <td><ResultBadge value={row.overall_result} /></td>
                <td>{formatDateTime(row.inspection_datetime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>QA History</h2>
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Result</th><th>Datetime</th></tr></thead>
          <tbody>
            {data.qa_samplings.map((row) => (
              <tr key={row.qa_sampling_id}>
                <td><Link to={`/reports/qa-samplings/${row.qa_sampling_id}`}>{row.qa_sampling_id}</Link></td>
                <td><StatusBadge value={row.status} /></td>
                <td><ResultBadge value={row.overall_result} /></td>
                <td>{formatDateTime(row.sampling_datetime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
