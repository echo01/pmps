import { Link } from 'react-router-dom';
import { DetailItem, EditHistoryRow, ApprovalLog } from '../../api/reports.api';
import { ResultBadge } from '../../components/badges/ResultBadge';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { formatDate, formatDateTime } from '../../utils/dateFormat';

export function BackToReports() {
  return <Link className="backLink" to="/reports">Back to Reports</Link>;
}

export function KeyValueGrid({ items }: { items: Array<[string, string | number | null | undefined | JSX.Element]> }) {
  return (
    <dl className="kvGrid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailsTable({ rows }: { rows: DetailItem[] }) {
  return (
    <table>
      <thead><tr><th>Item</th><th>Name</th><th>Value</th><th>Text</th><th>Result</th><th>Remark</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.item_code || '-'}</td>
            <td>{row.item_name || '-'}</td>
            <td>{row.measured_value ?? '-'}</td>
            <td>{row.measured_text || '-'}</td>
            <td><ResultBadge value={row.result} /></td>
            <td>{row.remark || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ApprovalLogTable({ rows }: { rows: ApprovalLog[] }) {
  return (
    <table>
      <thead><tr><th>Action</th><th>Old</th><th>New</th><th>By</th><th>Datetime</th><th>Remark</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.action}</td>
            <td><StatusBadge value={row.old_status} /></td>
            <td><StatusBadge value={row.new_status} /></td>
            <td>{row.action_by_username || '-'}</td>
            <td>{formatDateTime(row.action_datetime)}</td>
            <td>{row.remark || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EditHistoryTable({ rows }: { rows: EditHistoryRow[] }) {
  return (
    <table>
      <thead><tr><th>Status</th><th>Item</th><th>Old</th><th>New</th><th>Reason</th><th>By</th><th>Datetime</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td><StatusBadge value={row.approval_status} /></td>
            <td>{row.item_code || row.item_name || '-'}</td>
            <td>{row.old_measured_value ?? row.old_measured_text ?? '-'}</td>
            <td>{row.new_measured_value ?? row.new_measured_text ?? '-'}</td>
            <td>{row.edit_reason || '-'}</td>
            <td>{row.edit_by_username || '-'}</td>
            <td>{formatDateTime(row.edit_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EquipmentTable({ rows }: { rows: Array<Record<string, string | number | null>> }) {
  return (
    <table>
      <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Calibration Due</th></tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.equipment_code}-${index}`}>
            <td>{row.equipment_code || '-'}</td>
            <td>{row.equipment_name || '-'}</td>
            <td><StatusBadge value={String(row.status || 'N/A')} /></td>
            <td>{formatDate(String(row.calibration_due_date || ''))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
