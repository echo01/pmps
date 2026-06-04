export function BooleanBadge({ value, trueLabel = 'Active', falseLabel = 'Inactive' }: { value?: boolean; trueLabel?: string; falseLabel?: string }) {
  return <span className={`badge ${value ? 'active' : 'hold'}`}>{value ? trueLabel : falseLabel}</span>;
}

export function CalibrationStatusBadge({ value }: { value?: string | null }) {
  const key = (value || 'UNKNOWN').toLowerCase();
  return <span className={`badge ${key === 'valid' ? 'good' : key === 'expired' ? 'fail' : 'draft'}`}>{value || 'UNKNOWN'}</span>;
}

export function TemplateTypeBadge({ value }: { value?: string | null }) {
  return <span className={`badge ${value === 'QA' ? 'submitted' : 'good'}`}>{value || '-'}</span>;
}

export function CheckTypeBadge({ value }: { value?: string | null }) {
  return <span className={`badge ${value === 'NUMERIC' ? 'good' : value === 'BOOLEAN' ? 'submitted' : 'draft'}`}>{value || '-'}</span>;
}
