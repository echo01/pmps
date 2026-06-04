import { Download } from 'lucide-react';
import { useState } from 'react';
import { exportsApi } from '../../api/exports.api';
import type { ReportFiltersState, ReportTab } from '../../pages/reports/ReportsPage';
import { downloadBlob } from '../../utils/downloadFile';
import { logger } from '../../utils/logger';

type ExportButtonsProps = {
  activeTab: ReportTab;
  filters: ReportFiltersState;
};

type ExportAction = {
  label: string;
  filename: string;
  run: () => Promise<Blob>;
};

export function ExportButtons({ activeTab, filters }: ExportButtonsProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const commonParams = { ...filters };
  const actions: ExportAction[] = [];

  if (activeTab === 'lots') {
    actions.push(
      { label: 'Lots CSV', filename: 'lots.csv', run: () => exportsApi.lotsCsv(commonParams) },
      { label: 'Lots XLSX', filename: 'lots.xlsx', run: () => exportsApi.lotsXlsx(commonParams) }
    );
  }

  if (activeTab === 'qc') {
    actions.push(
      { label: 'QC CSV', filename: 'qc-inspections.csv', run: () => exportsApi.qcCsv(commonParams) },
      { label: 'QC XLSX', filename: 'qc-inspections.xlsx', run: () => exportsApi.qcXlsx(commonParams) },
      { label: 'QC PDF', filename: 'qc-inspections.pdf', run: () => exportsApi.qcPdf(commonParams) }
    );
  }

  if (activeTab === 'qa') {
    actions.push(
      { label: 'QA CSV', filename: 'qa-samplings.csv', run: () => exportsApi.qaCsv(commonParams) },
      { label: 'QA XLSX', filename: 'qa-samplings.xlsx', run: () => exportsApi.qaXlsx(commonParams) },
      { label: 'QA PDF', filename: 'qa-samplings.pdf', run: () => exportsApi.qaPdf(commonParams) }
    );
  }

  actions.push(
    { label: 'Audit CSV', filename: 'audit-trails.csv', run: () => exportsApi.auditCsv({}) },
    { label: 'Audit XLSX', filename: 'audit-trails.xlsx', run: () => exportsApi.auditXlsx({}) }
  );

  async function runExport(action: ExportAction) {
    setBusy(action.label);
    try {
      logger.info('[REPORT][EXPORT][START]', { activeTab, label: action.label });
      const blob = await action.run();
      downloadBlob(blob, action.filename);
      logger.info('[REPORT][EXPORT][API_SUCCESS]', { activeTab, label: action.label });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="exportButtons">
      {actions.map((action) => (
        <button key={action.label} type="button" className="textButton" onClick={() => runExport(action)} disabled={busy !== null}>
          <Download size={16} />
          {busy === action.label ? 'Exporting...' : action.label}
        </button>
      ))}
    </div>
  );
}
