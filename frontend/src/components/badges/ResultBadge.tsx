export function ResultBadge({ value }: { value?: string | null }) {
  const normalized = (value || 'N/A').replace('/', '').toLowerCase();
  return <span className={`badge result ${normalized}`}>{value || 'N/A'}</span>;
}
