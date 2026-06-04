import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { exportsApi } from '../../api/exports.api';
import { reportsApi } from '../../api/reports.api';
import { ResultBadge } from '../../components/badges/ResultBadge';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { downloadBlob } from '../../utils/downloadFile';
import { formatDate } from '../../utils/dateFormat';
import { BackToReports, KeyValueGrid } from './detailHelpers';

export function LotDetailPage() {
  const { lotId = '' } = useParams();
  const query = useQuery({ queryKey: ['lot-detail', lotId], queryFn: () => reportsApi.getLotDetail(lotId) });

  async function downloadPdf() {
    downloadBlob(await exportsApi.lotDetailPdf(lotId), `lot-${lotId}.pdf`);
  }

  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data?.lot) return <EmptyState message="Lot not found" />;

  const data = query.data;
  const lot = data.lot!;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <BackToReports />
          <h1>{lot.lot_number}</h1>
        </div>
        <button className="textButton" type="button" onClick={downloadPdf}><Download size={16} /> Detail PDF</button>
      </div>
      <section className="panel">
        <KeyValueGrid items={[
          ['Model', `${lot.model_code} - ${lot.product_name}`],
          ['Status', <StatusBadge value={lot.lot_status} />],
          ['Lot Qty', lot.lot_qty],
          ['Production Date', formatDate(lot.production_date)],
        ]} />
      </section>
      <section className="summaryGrid">
        <article className="metricCard"><span>QC Total</span><strong>{data.qc_summary.total || 0}</strong></article>
        <article className="metricCard"><span>QC PASS</span><strong>{data.qc_summary.pass || 0}</strong></article>
        <article className="metricCard"><span>QA Total</span><strong>{data.qa_summary.total || 0}</strong></article>
        <article className="metricCard"><span>QA PASS</span><strong>{data.qa_summary.pass || 0}</strong></article>
      </section>
      <section className="panel">
        <h2>Serials</h2>
        <table>
          <thead><tr><th>Serial</th><th>Unit</th><th>QC</th><th>QA</th></tr></thead>
          <tbody>
            {data.serials.map((row) => (
              <tr key={row.product_unit_id}>
                <td><Link to={`/reports/serials/${row.product_unit_id}`}>{row.serial_number}</Link></td>
                <td><StatusBadge value={row.unit_status} /></td>
                <td><ResultBadge value={row.latest_qc_result} /></td>
                <td><ResultBadge value={row.latest_qa_result} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
