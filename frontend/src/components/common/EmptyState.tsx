export function EmptyState({ message = 'No data found' }: { message?: string }) {
  return <div className="statePanel muted">{message}</div>;
}
