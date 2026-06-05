import { EditHistoryRow } from '../../api/qc.api';
import { StatusBadge } from '../badges/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { formatDateTime } from '../../utils/dateFormat';

function valueText(value?: number | string | null) {
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

export function latestEditReason(rows: EditHistoryRow[] = []) {
  return [...rows].reverse().find((row) => row.edit_reason)?.edit_reason || null;
}

export function EditHistoryPanel({ rows = [] }: { rows?: EditHistoryRow[] }) {
  return (
    <section className="panel">
      <div className="sectionHeader">
        <h2>Edit History</h2>
        <span className="mutedText">{rows.length} entries</span>
      </div>
      {!rows.length ? <EmptyState message="No edit history" /> : null}
      {rows.length ? (
        <div className="tableScroll">
          <table className="editHistoryTable">
            <thead>
              <tr><th>Status</th><th>Item</th><th>Old</th><th>New</th><th>Result</th><th>Overall</th><th>Reason</th><th>By</th><th>At</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><StatusBadge value={row.approval_status} /></td>
                  <td>{row.item_code ? `${row.item_code} - ${row.item_name || ''}` : '-'}</td>
                  <td>{valueText(row.old_measured_value ?? row.old_measured_text)}</td>
                  <td>{valueText(row.new_measured_value ?? row.new_measured_text)}</td>
                  <td>{row.old_result || '-'} {'->'} {row.new_result || '-'}</td>
                  <td>{row.old_overall_result || '-'} {'->'} {row.new_overall_result || '-'}</td>
                  <td>{row.edit_reason || '-'}</td>
                  <td>{row.edit_by_username || row.edit_by || '-'}</td>
                  <td>{formatDateTime(row.edit_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
