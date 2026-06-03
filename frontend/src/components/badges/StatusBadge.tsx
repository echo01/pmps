export function StatusBadge({ value }: { value?: string | null }) {
  const normalized = (value || 'N/A').toLowerCase();
  return <span className={`badge status ${normalized}`}>{value || 'N/A'}</span>;
}
