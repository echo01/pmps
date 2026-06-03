import { apiDownload } from './httpClient';
import { QueryValue, toQueryString } from '../utils/queryString';

type ExportParams = Record<string, QueryValue>;

export const exportsApi = {
  qcCsv: (params: ExportParams) => apiDownload(`/exports/qc-inspections.csv${toQueryString(params)}`),
  qcXlsx: (params: ExportParams) => apiDownload(`/exports/qc-inspections.xlsx${toQueryString(params)}`),
  qcPdf: (params: ExportParams) => apiDownload(`/exports/qc-inspections.pdf${toQueryString(params)}`),
  qcDetailPdf: (id: string | number) => apiDownload(`/exports/qc-inspections/${id}/pdf`),
  qaCsv: (params: ExportParams) => apiDownload(`/exports/qa-samplings.csv${toQueryString(params)}`),
  qaXlsx: (params: ExportParams) => apiDownload(`/exports/qa-samplings.xlsx${toQueryString(params)}`),
  qaPdf: (params: ExportParams) => apiDownload(`/exports/qa-samplings.pdf${toQueryString(params)}`),
  qaDetailPdf: (id: string | number) => apiDownload(`/exports/qa-samplings/${id}/pdf`),
  lotsCsv: (params: ExportParams) => apiDownload(`/exports/lots.csv${toQueryString(params)}`),
  lotsXlsx: (params: ExportParams) => apiDownload(`/exports/lots.xlsx${toQueryString(params)}`),
  lotDetailPdf: (lotId: string | number) => apiDownload(`/exports/lots/${lotId}/pdf`),
  auditCsv: (params: ExportParams) => apiDownload(`/exports/audit-trails.csv${toQueryString(params)}`),
  auditXlsx: (params: ExportParams) => apiDownload(`/exports/audit-trails.xlsx${toQueryString(params)}`),
};
