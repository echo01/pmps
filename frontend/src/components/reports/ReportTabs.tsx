import type { ReportTab } from '../../pages/reports/ReportsPage';

const tabs: Array<{ key: ReportTab; label: string }> = [
  { key: 'lots', label: 'Lots' },
  { key: 'serials', label: 'Serials' },
  { key: 'qc', label: 'QC Inspections' },
  { key: 'qa', label: 'QA Samplings' },
];

export function ReportTabs({ activeTab, onChange }: { activeTab: ReportTab; onChange: (tab: ReportTab) => void }) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
