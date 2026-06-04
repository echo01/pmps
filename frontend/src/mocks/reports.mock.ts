import type {
  DashboardSummary,
  LotReportRow,
  QaSamplingReportDetail,
  QaSamplingReportRow,
  QcInspectionReportDetail,
  QcInspectionReportRow,
  ReportPage,
  SerialReportDetail,
  SerialReportRow,
} from '../api/reports.api';
import { logger } from '../utils/logger';

const lotRows: LotReportRow[] = [
  {
    lot_id: 12,
    lot_number: 'S11-LOT-001',
    model_code: 'CMA-003',
    product_name: 'Air Control CMA-003',
    lot_qty: 120,
    serial_count: 120,
    qc_count: 18,
    qa_sampling_count: 3,
    lot_status: 'OPEN',
    production_date: '2026-06-03',
  },
];

const serialRows: SerialReportRow[] = [
  {
    product_unit_id: 1192,
    serial_number: 'S11-0001192',
    lot_id: 12,
    lot_number: 'S11-LOT-001',
    model_code: 'CMA-003',
    product_name: 'Air Control CMA-003',
    unit_status: 'GOOD',
    latest_qc_status: 'APPROVED',
    latest_qc_result: 'PASS',
    latest_qa_status: 'APPROVED',
    latest_qa_result: 'PASS',
  },
];

const qcRows: QcInspectionReportRow[] = [
  {
    inspection_id: 85,
    inspection_no: 1,
    status: 'APPROVED',
    overall_result: 'PASS',
    station_name: 'QC-01',
    product_unit_id: 1192,
    serial_number: 'S11-0001192',
    lot_id: 12,
    lot_number: 'S11-LOT-001',
    model_code: 'CMA-003',
    product_name: 'Air Control CMA-003',
    template_name: 'CMA QC Template',
    operator_username: 'admin',
    reviewer_username: 'admin',
    approver_username: 'admin',
    inspection_datetime: '2026-06-03T09:00:00.000Z',
  },
];

const qaRows: QaSamplingReportRow[] = [
  {
    qa_sampling_id: 1,
    sampling_no: 1,
    sampling_method: 'MANUAL',
    status: 'APPROVED',
    overall_result: 'PASS',
    lot_id: 12,
    lot_number: 'S11-LOT-001',
    model_code: 'CMA-003',
    product_name: 'Air Control CMA-003',
    template_name: 'CMA QA Template',
    sample_qty: 3,
    accept_qty: 3,
    reject_qty: 0,
    operator_username: 'admin',
    reviewer_username: 'admin',
    approver_username: 'admin',
    sampling_datetime: '2026-06-03T10:00:00.000Z',
  },
];

function page<T>(rows: T[]): ReportPage<T> {
  return {
    rows,
    pagination: {
      page: 1,
      page_size: 20,
      total: rows.length,
      total_pages: 1,
    },
  };
}

export async function mockDashboardSummary(): Promise<DashboardSummary> {
  logger.info('[DASHBOARD][LOAD][MOCK]', { mockMode: true });
  return {
    production: { total_lots: 1, open_lots: 1, hold_lots: 0, closed_lots: 0, total_units: 120 },
    qc: { total_inspections: 18, approved: 16, pending: 2, pass: 15, fail: 2, na: 1 },
    qa: { total_samplings: 3, approved: 3, pending: 0, pass: 3, fail: 0, na: 0 },
  };
}

export async function mockQcSummary() {
  return {
    by_status: [{ status: 'APPROVED', count: 16 }, { status: 'SUBMITTED', count: 2 }],
    by_result: [{ overall_result: 'PASS', count: 15 }, { overall_result: 'FAIL', count: 2 }, { overall_result: 'N/A', count: 1 }],
    by_model: [{ model_code: 'CMA-003', total: 18, pass: 15, fail: 2, na: 1 }],
  };
}

export async function mockQaSummary() {
  return {
    by_status: [{ status: 'APPROVED', count: 3 }],
    by_result: [{ overall_result: 'PASS', count: 3 }],
    by_model: [{ model_code: 'CMA-003', total: 3, pass: 3, fail: 0, na: 0 }],
  };
}

export async function mockLotStatus() {
  return [{ status: 'OPEN', count: 1 }];
}

export async function mockLots() {
  return page(lotRows);
}

export async function mockSerials() {
  return page(serialRows);
}

export async function mockQcRows() {
  return page(qcRows);
}

export async function mockQaRows() {
  return page(qaRows);
}

export async function mockLotDetail() {
  return {
    lot: lotRows[0],
    serials: serialRows,
    qc_summary: { total: 18, pass: 15, fail: 2, na: 1, approved: 16 },
    qa_summary: { total: 3, pass: 3, fail: 0, na: 0, approved: 3 },
    approval_status: [],
  };
}

export async function mockSerialDetail(): Promise<SerialReportDetail> {
  return {
    ...serialRows[0],
    qc_inspections: qcRows,
    qa_samplings: qaRows,
  };
}

export async function mockQcDetail(): Promise<QcInspectionReportDetail> {
  return {
    ...qcRows[0],
    details: [
      { id: 1, item_code: 'VOLT', item_name: 'Voltage', measured_value: 230, measured_text: null, result: 'PASS', remark: null },
      { id: 2, item_code: 'LED', item_name: 'LED Indicator', measured_value: null, measured_text: 'OK', result: 'PASS', remark: null },
    ],
    equipment: [{ id: 1, equipment_code: 'EQ-001', equipment_name: 'Multimeter', status: 'ACTIVE', calibration_due_date: '2027-01-01' }],
    approval_logs: [{ id: 1, action: 'APPROVE', old_status: 'REVIEWED', new_status: 'APPROVED', action_by_username: 'admin', action_datetime: '2026-06-03T11:00:00.000Z', remark: 'Mock approve' }],
    edit_history: [{ id: 1, approval_status: 'APPLIED', item_code: 'VOLT', old_measured_value: 229, new_measured_value: 230, edit_reason: 'Mock retest', edit_by_username: 'admin', edit_at: '2026-06-03T11:30:00.000Z' }],
  };
}

export async function mockQaDetail(): Promise<QaSamplingReportDetail> {
  return {
    ...qaRows[0],
    sample_units: [{ id: 1, sample_no: 1, serial_number: 'S11-0001192', unit_result: 'PASS', details: [] }],
    equipment: [{ id: 1, equipment_code: 'EQ-001', equipment_name: 'Multimeter', status: 'ACTIVE', calibration_due_date: '2027-01-01' }],
    approval_logs: [{ id: 1, action: 'APPROVE', old_status: 'REVIEWED', new_status: 'APPROVED', action_by_username: 'admin', action_datetime: '2026-06-03T11:00:00.000Z', remark: 'Mock approve' }],
    edit_history: [{ id: 1, approval_status: 'APPLIED', item_code: 'VOLT', old_measured_value: 229, new_measured_value: 230, edit_reason: 'Mock retest', edit_by_username: 'admin', edit_at: '2026-06-03T11:30:00.000Z' }],
  };
}
