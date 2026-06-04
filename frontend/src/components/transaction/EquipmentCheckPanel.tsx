import { EquipmentCheck } from '../../api/qc.api';
import { StatusBadge } from '../badges/StatusBadge';

export function EquipmentCheckPanel({ check }: { check?: EquipmentCheck | null }) {
  if (!check) {
    return (
      <div className="transactionHint">
        Save a draft first to run backend equipment validation.
      </div>
    );
  }

  const summary = check.summary;

  return (
    <div className="equipmentCheckGrid">
      <article>
        <span>Validation</span>
        <strong><StatusBadge value={check.valid ? 'PASS' : 'FAIL'} /></strong>
      </article>
      <article>
        <span>Missing Required</span>
        <strong>{summary.missing_required_count || 0}</strong>
      </article>
      <article>
        <span>Expired</span>
        <strong>{summary.expired_count || 0}</strong>
      </article>
      <article>
        <span>Inactive</span>
        <strong>{summary.inactive_count || 0}</strong>
      </article>
    </div>
  );
}
