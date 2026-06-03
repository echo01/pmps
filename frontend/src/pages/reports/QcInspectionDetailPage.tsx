import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { exportsApi } from '../../api/exports.api';
import { reportsApi } from '../../api/reports.api';
import { ResultBadge } from '../../components/badges/ResultBadge';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { downloadBlob } from '../../utils/downloadFile';
import { formatDateTime } from '../../utils/dateFormat';
import { ApprovalLogTable, BackToReports, DetailsTable, EditHistoryTable, EquipmentTable, KeyValueGrid } from './detailHelpers';

export function QcInspectionDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['qc-detail', id], queryFn: () => reportsApi.getQcInspectionDetail(id) });

  async function downloadPdf() {
    downloadBlob(await exportsApi.qcDetailPdf(id), `qc-inspection-${id}.pdf`);
  }

  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data) return <EmptyState message="QC inspection not found" />;

  const data = query.data;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <BackToReports />
          <h1>QC Inspection #{data.inspection_id}</h1>
        </div>
        <button className="textButton" type="button" onClick={downloadPdf}><Download size={16} /> Detail PDF</button>
      </div>
      <section className="panel">
        <KeyValueGrid items={[
          ['Serial', data.serial_number],
          ['Lot', data.lot_number],
          ['Model', data.model_code],
          ['Status', <StatusBadge value={data.status} />],
          ['Result', <ResultBadge value={data.overall_result} />],
          ['Datetime', formatDateTime(data.inspection_datetime)],
        ]} />
      </section>
      <section className="panel"><h2>Details</h2><DetailsTable rows={data.details} /></section>
      <section className="panel"><h2>Equipment</h2><EquipmentTable rows={data.equipment} /></section>
      <section className="panel"><h2>Approval Logs</h2><ApprovalLogTable rows={data.approval_logs} /></section>
      <section className="panel"><h2>Edit History</h2><EditHistoryTable rows={data.edit_history} /></section>
    </div>
  );
}
