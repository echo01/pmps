import { httpClient } from './httpClient.js';

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const reportsApi = {
  getDashboardSummary() {
    return httpClient.get('/dashboard/summary');
  },
  getQcSummary(params) {
    return httpClient.get(`/dashboard/qc-summary${buildQuery(params)}`);
  },
  getQaSummary(params) {
    return httpClient.get(`/dashboard/qa-summary${buildQuery(params)}`);
  },
  getLotStatus() {
    return httpClient.get('/dashboard/lot-status');
  },
  searchLots(params) {
    return httpClient.get(`/reports/lots${buildQuery(params)}`);
  },
  searchSerials(params) {
    return httpClient.get(`/reports/serials${buildQuery(params)}`);
  },
  searchQcInspections(params) {
    return httpClient.get(`/reports/qc-inspections${buildQuery(params)}`);
  },
  searchQaSamplings(params) {
    return httpClient.get(`/reports/qa-samplings${buildQuery(params)}`);
  },
  getLotDetail(lotId) {
    return httpClient.get(`/reports/lots/${lotId}`);
  },
  getSerialDetail(productUnitId) {
    return httpClient.get(`/reports/serials/${productUnitId}`);
  },
  getQcInspectionDetail(id) {
    return httpClient.get(`/reports/qc-inspections/${id}`);
  },
  getQaSamplingDetail(id) {
    return httpClient.get(`/reports/qa-samplings/${id}`);
  },
  exportQcInspections(params) {
    return httpClient.get(`/reports/qc-inspections/export${buildQuery(params)}`);
  },
  exportQaSamplings(params) {
    return httpClient.get(`/reports/qa-samplings/export${buildQuery(params)}`);
  },
};
