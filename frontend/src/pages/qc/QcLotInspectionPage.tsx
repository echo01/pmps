import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, ChevronLeft, ChevronRight, RefreshCw, Save } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { qcApi, QcBulkWorkflowAction, QcInspectionPayload, QcSerialStatus, TemplateItem } from '../../api/qc.api';
import { useAuth } from '../../auth/useAuth';
import { can } from '../../auth/permission';
import { StatusBadge } from '../../components/badges/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { ApplyEditPanel } from '../../components/edit-result/ApplyEditPanel';
import { EditHistoryPanel, latestEditReason } from '../../components/edit-result/EditHistoryPanel';
import { EditRequestModal } from '../../components/edit-result/EditRequestModal';
import { EditStatusBanner } from '../../components/edit-result/EditStatusBanner';
import { EditResultDetail } from '../../components/edit-result/editResultTypes';
import { ApprovalActions } from '../../components/transaction/ApprovalActions';
import { EquipmentCheckPanel } from '../../components/transaction/EquipmentCheckPanel';
import { EquipmentSelector } from '../../components/transaction/EquipmentSelector';
import { ResultDraft } from '../../components/transaction/ResultInputCell';
import { ResultGrid } from '../../components/transaction/ResultGrid';
import { formatDateTime } from '../../utils/dateFormat';
import { logger } from '../../utils/logger';
import { calculateOverallResult, calculatePreviewResult, normalizeMeasuredText, normalizeMeasuredValue } from '../../utils/resultPreview';

function emptyDraft(): ResultDraft {
  return { measured_value: '', measured_text: '', remark: '' };
}

function toDrafts(items: TemplateItem[], details?: Array<Record<string, unknown>>) {
  const byItem = new Map((details || []).map((detail) => [Number(detail.template_item_id), detail]));
  return Object.fromEntries(items.map((item) => {
    const detail = byItem.get(item.id);
    return [item.id, {
      measured_value: detail?.measured_value === null || detail?.measured_value === undefined ? '' : String(detail.measured_value),
      measured_text: detail?.measured_text ? String(detail.measured_text) : '',
      remark: detail?.remark ? String(detail.remark) : '',
    }];
  }));
}

function buildItemsPayload(items: TemplateItem[], drafts: Record<number, ResultDraft>) {
  return items.map((item) => {
    const draft = drafts[item.id] || emptyDraft();
    return {
      template_item_id: item.id,
      measured_value: (item.check_type || '').toUpperCase() === 'NUMERIC' ? normalizeMeasuredValue(draft.measured_value) : null,
      measured_text: (item.check_type || '').toUpperCase() === 'NUMERIC' ? null : normalizeMeasuredText(draft.measured_text),
      remark: normalizeMeasuredText(draft.remark),
    };
  });
}

function actionLabel(status: string) {
  if (status === 'NOT_STARTED') return 'Start Inspect';
  if (status === 'DRAFT') return 'Continue Draft';
  if (status === 'SUBMITTED') return 'Review';
  if (status === 'REVIEWED') return 'Approve / Reject';
  if (status === 'APPROVED') return 'View / Request Edit';
  if (status === 'EDIT_REQUESTED') return 'View Edit / Apply Edit';
  return 'View';
}

const SERIAL_PAGE_SIZE = 10;
const bulkSourceStatus: Record<QcBulkWorkflowAction, QcSerialStatus['qc_status']> = {
  SUBMIT: 'DRAFT',
  REVIEW: 'SUBMITTED',
  APPROVE: 'REVIEWED',
};

type SerialFilters = {
  no: string;
  serial: string;
  status: string;
  result: string;
  template: string;
  updated: string;
  action: string;
};

const emptySerialFilters: SerialFilters = {
  no: '',
  serial: '',
  status: '',
  result: '',
  template: '',
  updated: '',
  action: '',
};

function includesText(value: unknown, filter: string) {
  return String(value || '').toLowerCase().includes(filter.trim().toLowerCase());
}

export function QcLotInspectionPage() {
  const { lotId = '' } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const canEditResult = can('EditTestResult', permissions);
  const canViewEditHistory = can('SearchReport', permissions);
  const serialPanelRef = useRef<HTMLElement | null>(null);
  const inspectionFormRef = useRef<HTMLElement | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<QcSerialStatus | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [inspectionNo, setInspectionNo] = useState('1');
  const [stationName, setStationName] = useState('QC-STATION-01');
  const [remark, setRemark] = useState('');
  const [equipmentIds, setEquipmentIds] = useState<number[]>([]);
  const [equipmentRequired, setEquipmentRequired] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, ResultDraft>>({});
  const [serialPage, setSerialPage] = useState(1);
  const [serialFilters, setSerialFilters] = useState<SerialFilters>(emptySerialFilters);
  const [bulkAction, setBulkAction] = useState<QcBulkWorkflowAction>('SUBMIT');
  const [bulkRemark, setBulkRemark] = useState('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<number[]>([]);
  const [editRequestOpen, setEditRequestOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['qc-lot-inspection-status', lotId],
    queryFn: () => {
      logger.info('[QC_LOT_INSPECTION][LOAD][START]', { lotId });
      return qcApi.getLotInspectionStatus(lotId);
    },
  });

  const detail = useQuery({
    queryKey: ['qc-lot-selected-inspection', selectedInspectionId],
    queryFn: () => qcApi.getInspection(selectedInspectionId || 0),
    enabled: Boolean(selectedInspectionId),
  });

  const templates = useQuery({
    queryKey: ['qc-lot-templates', statusQuery.data?.lot.model_id],
    queryFn: () => qcApi.getTemplatesByModel(statusQuery.data?.lot.model_id || 0),
    enabled: Boolean(statusQuery.data?.lot.model_id),
  });

  const items = useQuery({
    queryKey: ['qc-lot-template-items', templateId],
    queryFn: () => qcApi.getTemplateItems(templateId),
    enabled: Boolean(templateId),
  });

  const equipmentCheck = useQuery({
    queryKey: ['qc-lot-equipment-check', selectedInspectionId],
    queryFn: () => qcApi.checkEquipment(selectedInspectionId || 0),
    enabled: false,
  });

  const editHistory = useQuery({
    queryKey: ['qc-lot-edit-history', selectedInspectionId],
    queryFn: () => qcApi.getInspectionEditHistory(selectedInspectionId || 0),
    enabled: Boolean(selectedInspectionId) && canViewEditHistory,
  });

  useEffect(() => {
    if (!detail.data) return;
    setTemplateId(String(detail.data.template_id));
    setStationName(detail.data.station_name || 'QC-STATION-01');
    setRemark(detail.data.remark || '');
    setEquipmentIds((detail.data.equipment || []).map((row) => row.equipment_id));
  }, [detail.data]);

  useEffect(() => {
    if (templateId || !templates.data?.length) return;
    setTemplateId(String(templates.data[0].id));
  }, [templateId, templates.data]);

  useEffect(() => {
    if (items.data) setDrafts(toDrafts(items.data, detail.data?.details as Array<Record<string, unknown>> | undefined));
  }, [items.data, detail.data?.details]);

  useEffect(() => {
    setSerialPage(1);
  }, [serialFilters]);

  useEffect(() => {
    setSelectedBulkIds([]);
  }, [bulkAction, lotId]);

  const overallPreview = useMemo(() => {
    const results = (items.data || []).map((item) => calculatePreviewResult({ ...item, ...(drafts[item.id] || emptyDraft()) }));
    return calculateOverallResult(results);
  }, [drafts, items.data]);

  const readOnly = selectedSerial ? !['NOT_STARTED', 'DRAFT'].includes(selectedSerial.qc_status) : true;

  function selectSerial(row: QcSerialStatus, rowNo: number) {
    logger.info('[QC_LOT_INSPECTION][SERIAL_SELECT]', { product_unit_id: row.product_unit_id, inspection_id: row.inspection_id, status: row.qc_status, inspection_no: rowNo });
    setSelectedSerial(row);
    setSelectedInspectionId(row.inspection_id || null);
    setInspectionNo(String(rowNo));
    if (row.inspection_id) {
      setTemplateId(row.template_id ? String(row.template_id) : templateId);
    }
    setDrafts({});
    window.setTimeout(() => inspectionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSerial) throw new Error('Select serial first');
      const payload: QcInspectionPayload = {
        product_unit_id: selectedSerial.product_unit_id,
        template_id: Number(templateId),
        inspection_no: Number(inspectionNo),
        station_name: stationName,
        equipment_ids: equipmentIds,
        items: buildItemsPayload(items.data || [], drafts),
        remark,
      };
      logger.info('[QC_LOT_INSPECTION][SAVE_DRAFT][START]', { product_unit_id: payload.product_unit_id, template_id: payload.template_id, itemCount: payload.items.length });
      return selectedInspectionId ? qcApi.updateInspection(selectedInspectionId, payload) : qcApi.createInspection(payload);
    },
    onSuccess: (data) => {
      logger.info('[QC_LOT_INSPECTION][SAVE_DRAFT][API_SUCCESS]', { inspection_id: data.id, status: data.status, overall_result: data.overall_result });
      setSelectedInspectionId(data.id);
      queryClient.invalidateQueries({ queryKey: ['qc-lot-inspection-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-selected-inspection', data.id] });
    },
  });

  const workflowMutation = useMutation({
    mutationFn: ({ action, workflowRemark }: { action: 'submit' | 'review' | 'approve' | 'reject'; workflowRemark?: string }) => qcApi[action](selectedInspectionId || 0, workflowRemark || ''),
    onSuccess: (data) => {
      logger.info('[QC_LOT_INSPECTION][WORKFLOW][API_SUCCESS]', { inspection_id: data.id, status: data.status });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-inspection-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-selected-inspection', selectedInspectionId] });
      window.setTimeout(() => serialPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    },
  });

  const bulkWorkflowMutation = useMutation({
    mutationFn: (scope: 'selected' | 'lot') => qcApi.bulkWorkflow({
      action: bulkAction,
      ...(scope === 'selected' ? { inspection_ids: selectedBulkIds } : { lot_id: Number(lotId) }),
      remark: bulkRemark,
    }),
    onSuccess: (data) => {
      logger.info('[QC_LOT_INSPECTION][BULK_WORKFLOW][API_SUCCESS]', data);
      setSelectedBulkIds([]);
      queryClient.invalidateQueries({ queryKey: ['qc-lot-inspection-status', lotId] });
      if (selectedInspectionId && data.inspection_ids.includes(selectedInspectionId)) {
        queryClient.invalidateQueries({ queryKey: ['qc-lot-selected-inspection', selectedInspectionId] });
      }
    },
  });

  const requestEditMutation = useMutation({
    mutationFn: (reason: string) => qcApi.requestEditInspection(selectedInspectionId || 0, { reason }),
    onSuccess: (data) => {
      logger.info('[EDIT_RESULT][REQUEST][API_SUCCESS]', { source: 'QC', inspection_id: data.id, status: data.status });
      setEditRequestOpen(false);
      queryClient.invalidateQueries({ queryKey: ['qc-lot-inspection-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-selected-inspection', selectedInspectionId] });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-edit-history', selectedInspectionId] });
    },
  });

  const applyEditMutation = useMutation({
    mutationFn: (payload: Parameters<typeof qcApi.applyEditInspection>[1]) => qcApi.applyEditInspection(selectedInspectionId || 0, payload),
    onSuccess: (data) => {
      logger.info('[EDIT_RESULT][APPLY][API_SUCCESS]', { source: 'QC', inspection_id: data.id, status: data.status, overall_result: data.overall_result });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-inspection-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-selected-inspection', selectedInspectionId] });
      queryClient.invalidateQueries({ queryKey: ['qc-lot-edit-history', selectedInspectionId] });
      window.setTimeout(() => serialPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  if (statusQuery.isLoading) return <LoadingPanel />;
  if (statusQuery.error) return <ErrorAlert error={statusQuery.error} />;
  if (!statusQuery.data) return <EmptyState message="QC lot not found" />;

  const { lot, summary, serials } = statusQuery.data;
  const totalSerials = serials.length;
  const inspectedSerials = totalSerials - summary.not_started;
  const serialScore = totalSerials ? Math.round((inspectedSerials / totalSerials) * 100) : 0;
  const numberedSerials = serials.map((row, index) => ({ ...row, rowNo: index + 1 }));
  const filteredSerials = numberedSerials.filter((row) => {
    const result = row.overall_result || 'N/A';
    const updated = formatDateTime(row.updated_at);
    const action = actionLabel(row.qc_status);
    return includesText(row.rowNo, serialFilters.no)
      && includesText(row.serial_number, serialFilters.serial)
      && (!serialFilters.status || row.qc_status === serialFilters.status)
      && (!serialFilters.result || result === serialFilters.result)
      && includesText(row.template_name || '-', serialFilters.template)
      && includesText(updated || '-', serialFilters.updated)
      && (!serialFilters.action || action === serialFilters.action);
  });
  const totalSerialPages = Math.max(1, Math.ceil(filteredSerials.length / SERIAL_PAGE_SIZE));
  const normalizedSerialPage = Math.min(serialPage, totalSerialPages);
  const serialStartIndex = (normalizedSerialPage - 1) * SERIAL_PAGE_SIZE;
  const pagedSerials = filteredSerials.slice(serialStartIndex, serialStartIndex + SERIAL_PAGE_SIZE);
  const statusOptions = Array.from(new Set(serials.map((row) => row.qc_status))).sort();
  const resultOptions = Array.from(new Set(serials.map((row) => row.overall_result || 'N/A'))).sort();
  const actionOptions = Array.from(new Set(serials.map((row) => actionLabel(row.qc_status)))).sort();
  const eligibleBulkIds = numberedSerials
    .filter((row) => row.inspection_id && row.qc_status === bulkSourceStatus[bulkAction])
    .map((row) => Number(row.inspection_id));
  const pagedEligibleIds = pagedSerials
    .filter((row) => row.inspection_id && row.qc_status === bulkSourceStatus[bulkAction])
    .map((row) => Number(row.inspection_id));
  const allPagedEligibleSelected = pagedEligibleIds.length > 0
    && pagedEligibleIds.every((id) => selectedBulkIds.includes(id));
  const hasSerialFilters = Object.values(serialFilters).some(Boolean);
  const qcEditDetails: EditResultDetail[] = (detail.data?.details || []).map((row) => ({
    ...row,
    template_item_id: row.template_item_id,
    sample_label: detail.data?.serial_number,
  }));
  const showRequestEdit = Boolean(selectedInspectionId && detail.data?.status === 'APPROVED' && canEditResult);
  const showApplyEdit = Boolean(selectedInspectionId && detail.data?.status === 'EDIT_REQUESTED' && canEditResult);
  const selectedEditHistory = editHistory.data || detail.data?.edit_history || [];

  function updateSerialFilter(key: keyof SerialFilters, value: string) {
    setSerialFilters({ ...serialFilters, [key]: value });
  }

  function toggleBulkInspection(id: number) {
    setSelectedBulkIds((current) => current.includes(id)
      ? current.filter((inspectionId) => inspectionId !== id)
      : [...current, id]);
  }

  function toggleCurrentPageBulk() {
    setSelectedBulkIds((current) => allPagedEligibleSelected
      ? current.filter((id) => !pagedEligibleIds.includes(id))
      : Array.from(new Set([...current, ...pagedEligibleIds])));
  }

  function runBulkWorkflow(scope: 'selected' | 'lot') {
    const count = scope === 'selected' ? selectedBulkIds.length : eligibleBulkIds.length;
    if (!count) return;
    const target = scope === 'selected' ? `${count} selected inspection(s)` : `${count} eligible inspection(s) in this lot`;
    if (window.confirm(`${bulkAction} ${target}?`)) bulkWorkflowMutation.mutate(scope);
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <Link className="backLink" to="/qc/inspection"><ArrowLeft size={16} /> Back to Lot Search</Link>
          <span className="eyebrow">QC Inspection</span>
          <h1>{lot.lot_number}</h1>
          <p className="mutedText">{lot.model_code} - {lot.product_name}</p>
          <div className="lotSamplingStatus">
            <span>Lot QC</span>
            <StatusBadge value={lot.qc_status} />
            <StatusBadge value={lot.qc_result} />
          </div>
        </div>
        <button className="textButton" onClick={() => statusQuery.refetch()}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="summaryGrid qcSummaryGrid">
        <article className="metricCard"><span>Not Started</span><strong>{summary.not_started}</strong></article>
        <article className="metricCard"><span>Draft</span><strong>{summary.draft}</strong></article>
        <article className="metricCard"><span>Submitted</span><strong>{summary.submitted}</strong></article>
        <article className="metricCard"><span>Reviewed</span><strong>{summary.reviewed}</strong></article>
        <article className="metricCard"><span>Approved</span><strong>{summary.approved}</strong></article>
        <article className="metricCard"><span>Rejected</span><strong>{summary.rejected}</strong></article>
      </div>

      {saveMutation.error ? <ErrorAlert error={saveMutation.error} title="Unable to save QC draft" /> : null}
      {workflowMutation.error ? <ErrorAlert error={workflowMutation.error} title="Unable to update workflow" /> : null}
      {bulkWorkflowMutation.error ? <ErrorAlert error={bulkWorkflowMutation.error} title="Unable to update bulk workflow" /> : null}
      {requestEditMutation.error ? <ErrorAlert error={requestEditMutation.error} title="Unable to request edit" /> : null}

      <div className="qcLotWorkspace">
        <section className="panel">
          <h2>Lot Inspection Setup</h2>
          <div className="formGrid">
            <label>Template<select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">Select QC template</option>
              {templates.data?.map((template) => <option key={template.id} value={template.id}>{template.template_name} rev {template.revision || '-'}</option>)}
            </select></label>
            <label className="span2">Station<input value={stationName} onChange={(event) => setStationName(event.target.value)} /></label>
            <label className="span2">Remark<input value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
          </div>
          <EquipmentSelector modelId={lot.model_id} selectedIds={equipmentIds} onChange={setEquipmentIds} onRequirementChange={setEquipmentRequired} />
        </section>

        <section className="panel" ref={serialPanelRef}>
          <div className="qcSerialPanelHeader">
            <div>
              <h2>Serials in Lot</h2>
              <p className="mutedText">{inspectedSerials} of {totalSerials} serials inspected</p>
            </div>
            <strong>{serialScore}%</strong>
          </div>
          <div className="qcScoreBar" aria-label={`QC inspection score ${serialScore}%`}>
            <i style={{ width: `${serialScore}%` }} />
          </div>
          <div className="qcBulkToolbar">
            <label>Bulk action
              <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as QcBulkWorkflowAction)}>
                <option value="SUBMIT">Submit drafts</option>
                <option value="REVIEW">Review submitted</option>
                <option value="APPROVE">Approve reviewed</option>
              </select>
            </label>
            <label className="qcBulkRemark">Remark
              <input value={bulkRemark} onChange={(event) => setBulkRemark(event.target.value)} placeholder="Optional workflow remark" />
            </label>
            <button className="textButton" disabled={!selectedBulkIds.length || bulkWorkflowMutation.isPending} onClick={() => runBulkWorkflow('selected')} type="button">
              <CheckCheck size={16} /> Apply to selected ({selectedBulkIds.length})
            </button>
            <button className="primaryButton" disabled={!eligibleBulkIds.length || bulkWorkflowMutation.isPending} onClick={() => runBulkWorkflow('lot')} type="button">
              <CheckCheck size={16} /> Apply to lot ({eligibleBulkIds.length})
            </button>
          </div>
          <div className="tableScroll">
            <table className="qcSerialTable">
              <colgroup><col className="qcSelectColumn" /><col className="qcNoColumn" /></colgroup>
              <thead>
                <tr>
                  <th><input aria-label="Select eligible inspections on current page" checked={allPagedEligibleSelected} disabled={!pagedEligibleIds.length} onChange={toggleCurrentPageBulk} type="checkbox" /></th>
                  <th>No.</th><th>Serial</th><th>QC Status</th><th>Result</th><th>Template</th><th>Updated</th><th>Action</th>
                </tr>
                <tr className="tableFilterRow">
                  <th />
                  <th><input className="qcNoFilter" maxLength={4} aria-label="Filter by row number" value={serialFilters.no} onChange={(event) => updateSerialFilter('no', event.target.value)} placeholder="No." /></th>
                  <th><input aria-label="Filter by serial" value={serialFilters.serial} onChange={(event) => updateSerialFilter('serial', event.target.value)} placeholder="Serial" /></th>
                  <th><select aria-label="Filter by QC status" value={serialFilters.status} onChange={(event) => updateSerialFilter('status', event.target.value)}><option value="">All</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></th>
                  <th><select aria-label="Filter by result" value={serialFilters.result} onChange={(event) => updateSerialFilter('result', event.target.value)}><option value="">All</option>{resultOptions.map((result) => <option key={result} value={result}>{result}</option>)}</select></th>
                  <th><input aria-label="Filter by template" value={serialFilters.template} onChange={(event) => updateSerialFilter('template', event.target.value)} placeholder="Template" /></th>
                  <th><input aria-label="Filter by updated date" value={serialFilters.updated} onChange={(event) => updateSerialFilter('updated', event.target.value)} placeholder="Updated" /></th>
                  <th><select aria-label="Filter by action" value={serialFilters.action} onChange={(event) => updateSerialFilter('action', event.target.value)}><option value="">All</option>{actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}</select></th>
                </tr>
              </thead>
              <tbody>
                {pagedSerials.map((row, index) => (
                  <tr key={row.product_unit_id} className={selectedSerial?.product_unit_id === row.product_unit_id ? 'selectedRow' : ''}>
                    <td><input aria-label={`Select inspection for serial ${row.serial_number}`} checked={Boolean(row.inspection_id && selectedBulkIds.includes(row.inspection_id))} disabled={!row.inspection_id || row.qc_status !== bulkSourceStatus[bulkAction]} onChange={() => row.inspection_id && toggleBulkInspection(row.inspection_id)} type="checkbox" /></td>
                    <td>{row.rowNo}</td>
                    <td>{row.serial_number}</td>
                    <td><StatusBadge value={row.qc_status} /></td>
                    <td><StatusBadge value={row.overall_result || 'N/A'} /></td>
                    <td>{row.template_name || '-'}</td>
                    <td>{formatDateTime(row.updated_at)}</td>
                    <td><button className="textButton" onClick={() => selectSerial(row, row.rowNo)}>{actionLabel(row.qc_status)}</button></td>
                  </tr>
                ))}
                {!pagedSerials.length ? <tr><td colSpan={8}><EmptyState message="No serials match the current filters" /></td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="qcSerialFooter">
            <span className="mutedText">Showing {filteredSerials.length ? serialStartIndex + 1 : 0}-{Math.min(serialStartIndex + SERIAL_PAGE_SIZE, filteredSerials.length)} of {filteredSerials.length}{hasSerialFilters ? ` filtered from ${totalSerials}` : ''}</span>
            <div className="pagination">
              {hasSerialFilters ? <button onClick={() => setSerialFilters(emptySerialFilters)} type="button">Clear Filters</button> : null}
              <button disabled={normalizedSerialPage <= 1} onClick={() => setSerialPage(normalizedSerialPage - 1)} type="button"><ChevronLeft size={16} /> Prev</button>
              <span>Page {normalizedSerialPage} / {totalSerialPages}</span>
              <button disabled={normalizedSerialPage >= totalSerialPages} onClick={() => setSerialPage(normalizedSerialPage + 1)} type="button">Next <ChevronRight size={16} /></button>
            </div>
          </div>
        </section>

        <section className="panel" ref={inspectionFormRef}>
          <h2>Inspection Form</h2>
          {!selectedSerial ? <EmptyState message="Select a serial to start or continue inspection" /> : (
            <div className="pageStack">
              <form className="pageStack" onSubmit={submit}>
                <div className="kvGrid">
                  <div><dt>Serial</dt><dd>{selectedSerial.serial_number}</dd></div>
                  <div><dt>Status</dt><dd><StatusBadge value={selectedSerial.qc_status} /></dd></div>
                  <div><dt>Result</dt><dd><StatusBadge value={selectedSerial.overall_result || overallPreview} /></dd></div>
                  <div><dt>Inspection ID</dt><dd>{selectedInspectionId || '-'}</dd></div>
                </div>

                <div className="formGrid">
                  <label>Inspection No<input disabled readOnly value={inspectionNo} /></label>
                </div>

                <EquipmentCheckPanel check={equipmentCheck.data || null} />
                <EditStatusBanner status={detail.data?.status || selectedSerial.qc_status} latestReason={latestEditReason(selectedEditHistory)} />
                {items.data?.length ? <ResultGrid readOnly={readOnly} items={items.data} values={drafts} onChange={(itemId, value) => setDrafts({ ...drafts, [itemId]: value })} /> : <EmptyState message="Select a template to enter QC results" />}

                <div className="formActions">
                  {!readOnly ? <button className="primaryButton" disabled={saveMutation.isPending || !templateId || (equipmentRequired && !equipmentIds.length) || !items.data?.length} type="submit"><Save size={16} /> Save Draft</button> : null}
                  {selectedInspectionId ? <button className="textButton" type="button" onClick={() => equipmentCheck.refetch()}>Run Equipment Check</button> : null}
                  {showRequestEdit ? <button className="primaryButton" type="button" onClick={() => { logger.info('[EDIT_RESULT][REQUEST][OPEN]', { source: 'QC', inspection_id: selectedInspectionId }); setEditRequestOpen(true); }}>Request Edit</button> : null}
                </div>
              </form>
              {selectedInspectionId ? <ApprovalActions status={detail.data?.status || selectedSerial?.qc_status} busy={workflowMutation.isPending} onSubmit={(workflowRemark) => workflowMutation.mutate({ action: 'submit', workflowRemark })} onReview={(workflowRemark) => workflowMutation.mutate({ action: 'review', workflowRemark })} onApprove={(workflowRemark) => workflowMutation.mutate({ action: 'approve', workflowRemark })} onReject={(workflowRemark) => workflowMutation.mutate({ action: 'reject', workflowRemark })} /> : null}
            </div>
          )}
        </section>

        {showApplyEdit ? <ApplyEditPanel sourceLabel="QC inspection" details={qcEditDetails} templates={items.data || []} busy={applyEditMutation.isPending} error={applyEditMutation.error} onApply={(payload) => applyEditMutation.mutate(payload)} /> : null}

        {selectedInspectionId && canViewEditHistory ? <EditHistoryPanel rows={selectedEditHistory} /> : null}
      </div>
      <EditRequestModal open={editRequestOpen} busy={requestEditMutation.isPending} error={requestEditMutation.error} onClose={() => setEditRequestOpen(false)} onSubmit={(reason) => requestEditMutation.mutate(reason)} />
    </div>
  );
}
