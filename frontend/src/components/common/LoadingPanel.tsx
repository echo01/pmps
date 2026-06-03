export function LoadingPanel({ label = 'Loading data...' }: { label?: string }) {
  return <div className="statePanel">{label}</div>;
}
