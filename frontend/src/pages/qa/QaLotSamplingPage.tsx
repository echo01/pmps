import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Save } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError } from '../../api/apiResponse';
import { Link, useParams } from 'react-router-dom';
import { qaApi, QaLotSamplingStatus, QaSampleStatus, QaSampling, QaSamplingPayload } from '../../api/qa.api';
import { TemplateItem, TransactionUnit } from '../../api/qc.api';
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

type SampleDrafts = Record<number, Record<number, ResultDraft>>;
type SampleFilters = {
  no: string;
  serial: string;
  status: string;
  result: string;
  template: string;
  updated: string;
  action: string;
};

const SAMPLE_PAGE_SIZE = 10;
const emptySampleFilters: SampleFilters = {
  no: '',
  serial: '',
  status: '',
  result: '',
  template: '',
  updated: '',
  action: '',
};

function emptyDraft(): ResultDraft {
  return { measured_value: '', measured_text: '', remark: '' };
}

function includesText(value: unknown, filter: string) {
  return String(value || '').toLowerCase().includes(filter.trim().toLowerCase());
}

function toUnit(row: QaSampleStatus): TransactionUnit {
  return {
    id: row.product_unit_id,
    lot_id: row.lot_id,
    model_id: row.model_id,
    serial_number: row.serial_number,
    unit_status: row.unit_status,
  };
}

function defaultDrafts(units: TransactionUnit[], items: TemplateItem[]) {
  return Object.fromEntries(units.map((unit) => [unit.id, Object.fromEntries(items.map((item) => [item.id, emptyDraft()]))]));
}

function buildUnitPayload(unit: TransactionUnit, items: TemplateItem[], drafts: Record<number, ResultDraft>) {
  return {
    product_unit_id: unit.id,
    items: items.map((item) => {
      const draft = drafts[item.id] || emptyDraft();
      return {
        template_item_id: item.id,
        measured_value: (item.check_type || '').toUpperCase() === 'NUMERIC' ? normalizeMeasuredValue(draft.measured_value) : null,
        measured_text: (item.check_type || '').toUpperCase() === 'NUMERIC' ? null : normalizeMeasuredText(draft.measured_text),
        remark: normalizeMeasuredText(draft.remark),
      };
    }),
  };
}

function actionLabel(status: string) {
  if (status === 'NOT_STARTED') return 'Add Sample';
  if (status === 'DRAFT') return 'Continue Draft';
  if (status === 'SUBMITTED') return 'Review';
  if (status === 'REVIEWED') return 'Approve / Reject';
  if (status === 'APPROVED') return 'View / Request Edit';
  if (status === 'EDIT_REQUESTED') return 'View Edit / Apply Edit';
  return 'View';
}

function buildQaSummary(samples: QaSampleStatus[]) {
  const summary = {
    not_started: 0,
    draft: 0,
    submitted: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
    edit_requested: 0,
  };

  samples.forEach((sample) => {
    const key = String(sample.qa_status || 'NOT_STARTED').toLowerCase() as keyof typeof summary;
    if (Object.prototype.hasOwnProperty.call(summary, key)) summary[key] += 1;
  });

  return summary;
}

export function QaLotSamplingPage() {
  const { lotId = '' } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const canEditResult = can('EditTestResult', permissions);
  const canViewEditHistory = can('SearchReport', permissions);
  const samplePanelRef = useRef<HTMLElement | null>(null);
  const samplingFormRef = useRef<HTMLElement | null>(null);
  const [activeQaSamplingId, setActiveQaSamplingId] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<QaSampleStatus | null>(null);
  const [sampleUnits, setSampleUnits] = useState<TransactionUnit[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [samplingNo, setSamplingNo] = useState('1');
  const [samplingMethod, setSamplingMethod] = useState('MANUAL');
  const [stationName, setStationName] = useState('QA-STATION-01');
  const [remark, setRemark] = useState('');
  const [equipmentIds, setEquipmentIds] = useState<number[]>([]);
  const [equipmentRequired, setEquipmentRequired] = useState(true);
  const [drafts, setDrafts] = useState<SampleDrafts>({});
  const [samplePage, setSamplePage] = useState(1);
  const [sampleFilters, setSampleFilters] = useState<SampleFilters>(emptySampleFilters);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [handledSaveError, setHandledSaveError] = useState(false);
  const [editRequestOpen, setEditRequestOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['qa-lot-sampling-status', lotId],
    queryFn: () => {
      logger.info('[QA_LOT_SAMPLING][LOAD][START]', { lotId });
      return qaApi.getLotSamplingStatus(lotId);
    },
  });

  const detail = useQuery({
    queryKey: ['qa-lot-selected-sampling', activeQaSamplingId],
    queryFn: () => qaApi.getSampling(activeQaSamplingId || 0),
    enabled: Boolean(activeQaSamplingId),
  });

  const templates = useQuery({
    queryKey: ['qa-lot-templates', statusQuery.data?.lot.model_id],
    queryFn: () => qaApi.getTemplatesByModel(statusQuery.data?.lot.model_id || 0),
    enabled: Boolean(statusQuery.data?.lot.model_id),
  });

  const items = useQuery({
    queryKey: ['qa-lot-template-items', templateId],
    queryFn: () => qaApi.getTemplateItems(templateId),
    enabled: Boolean(templateId),
  });

  const equipmentCheck = useQuery({
    queryKey: ['qa-lot-equipment-check', activeQaSamplingId],
    queryFn: () => qaApi.checkEquipment(activeQaSamplingId || 0),
    enabled: false,
  });

  const editHistory = useQuery({
    queryKey: ['qa-lot-edit-history', activeQaSamplingId],
    queryFn: () => qaApi.getSamplingEditHistory(activeQaSamplingId || 0),
    enabled: Boolean(activeQaSamplingId) && canViewEditHistory,
  });

  useEffect(() => {
    if (!detail.data) return;
    setTemplateId(String(detail.data.template_id));
    setSamplingMethod(detail.data.sampling_method || 'MANUAL');
    setStationName(detail.data.station_name || 'QA-STATION-01');
    setRemark(detail.data.remark || '');
    setEquipmentIds((detail.data.equipment || []).map((row) => row.equipment_id));
    setSampleUnits(detail.data.sample_units.map((unit) => ({
      id: unit.product_unit_id,
      lot_id: detail.data.lot_id,
      model_id: detail.data.model_id,
      serial_number: unit.serial_number,
      unit_status: '',
    })));
  }, [detail.data]);

  useEffect(() => {
    if (!items.data) return;

    if (detail.data?.sample_units && activeQaSamplingId) {
      const next: SampleDrafts = {};
      detail.data.sample_units.forEach((unit) => {
        next[unit.product_unit_id] = Object.fromEntries(items.data.map((item) => {
          const found = unit.details.find((detailItem) => detailItem.template_item_id === item.id);
          return [item.id, {
            measured_value: found?.measured_value === null || found?.measured_value === undefined ? '' : String(found.measured_value),
            measured_text: found?.measured_text || '',
            remark: found?.remark || '',
          }];
        }));
      });
      setDrafts(next);
    } else {
      setDrafts(defaultDrafts(sampleUnits, items.data));
    }
  }, [items.data, detail.data?.sample_units, sampleUnits, activeQaSamplingId]);

  useEffect(() => {
    setSamplePage(1);
  }, [sampleFilters]);

  const overallPreview = useMemo(() => {
    const unitResults = sampleUnits.map((unit) => {
      const rowResults = (items.data || []).map((item) => calculatePreviewResult({ ...item, ...(drafts[unit.id]?.[item.id] || emptyDraft()) }));
      return calculateOverallResult(rowResults);
    });
    return calculateOverallResult(unitResults);
  }, [drafts, items.data, sampleUnits]);

  const currentStatus = detail.data?.status || selectedRow?.qa_status || 'NEW';
  const readOnly = !['NEW', 'NOT_STARTED', 'DRAFT'].includes(currentStatus);

  function resetNewSampling() {
    setActiveQaSamplingId(null);
    setSampleUnits([]);
    setDrafts({});
  }

  function selectSample(row: QaSampleStatus & { rowNo: number }) {
    logger.info('[QA_LOT_SAMPLING][SAMPLE_SELECT]', { product_unit_id: row.product_unit_id, qa_sampling_id: row.qa_sampling_id, status: row.qa_status, sampling_no: row.rowNo });
    setSelectedRow(row);
    setSamplingNo(String(row.rowNo));

    if (row.qa_sampling_id) {
      setActiveQaSamplingId(row.qa_sampling_id);
    } else {
      const canAddToCurrentDraft = activeQaSamplingId && (detail.data?.status || selectedRow?.qa_status) === 'DRAFT';

      if (!canAddToCurrentDraft && readOnly) {
        resetNewSampling();
      }

      setSampleUnits((current) => current.some((unit) => unit.id === row.product_unit_id) ? current : [...current, toUnit(row)]);
    }

    window.setTimeout(() => samplingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function removeSample(unitId: number) {
    if (readOnly) return;
    setSampleUnits(sampleUnits.filter((unit) => unit.id !== unitId));
  }

  async function openExistingSampling(qaSamplingId: number, message?: string) {
    setActiveQaSamplingId(qaSamplingId);
    setSaveMessage(message || null);
    await queryClient.invalidateQueries({ queryKey: ['qa-lot-sampling-status', lotId] });
    await queryClient.invalidateQueries({ queryKey: ['qa-lot-selected-sampling', qaSamplingId] });
    window.setTimeout(() => samplingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function findExistingSamplingRows(rows: QaSampleStatus[]) {
    return rows.filter((row) => row.qa_sampling_id
      && String(row.template_id || '') === String(templateId)
      && String(row.sampling_no || '') === String(samplingNo));
  }

  function describeExistingSampling(rows: QaSampleStatus[]) {
    const first = rows[0];
    const serials = rows.map((row) => row.serial_number).join(', ');
    return `Sampling No ${samplingNo} for this template already exists with status ${first?.qa_status || 'UNKNOWN'}${serials ? ` (${serials})` : ''}. Use a new Sampling No for a new QA round.`;
  }

  function syncSamplingStatusCache(sampling: QaSampling) {
    queryClient.setQueryData<QaLotSamplingStatus>(['qa-lot-sampling-status', lotId], (current) => {
      if (!current) return current;

      const unitByProductUnitId = new Map(sampling.sample_units.map((unit) => [unit.product_unit_id, unit]));
      const nextSamples = current.samples.map((sample) => {
        const unit = unitByProductUnitId.get(sample.product_unit_id);

        if (!unit) return sample;

        return {
          ...sample,
          qa_sampling_id: sampling.id,
          sampling_no: sampling.sampling_no,
          template_id: sampling.template_id,
          template_name: sampling.template_name,
          revision: sampling.revision,
          qa_status: sampling.status,
          unit_result: unit.unit_result,
          overall_result: sampling.overall_result,
          updated_at: unit.updated_at || sample.updated_at,
        };
      });

      return {
        ...current,
        summary: buildQaSummary(nextSamples),
        samples: nextSamples,
      };
    });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveMessage(null);
      setHandledSaveError(false);
      const payload: QaSamplingPayload = {
        lot_id: Number(lotId),
        template_id: Number(templateId),
        sampling_no: Number(samplingNo),
        sampling_method: samplingMethod,
        station_name: stationName,
        equipment_ids: equipmentIds,
        sample_units: sampleUnits.map((unit) => buildUnitPayload(unit, items.data || [], drafts[unit.id] || {})),
        remark,
      };
      logger.info('[QA_LOT_SAMPLING][SAVE_DRAFT][START]', { lot_id: payload.lot_id, template_id: payload.template_id, sampleCount: payload.sample_units.length });

      if (activeQaSamplingId) {
        return qaApi.updateSampling(activeQaSamplingId, payload);
      }

      const existingRows = findExistingSamplingRows(statusQuery.data?.samples || []);
      const existingDraft = existingRows.find((row) => row.qa_status === 'DRAFT' && row.qa_sampling_id);

      if (existingDraft?.qa_sampling_id) {
        logger.warn('[QA_LOT_SAMPLING][SAVE_DRAFT][EXISTING_DRAFT_UPDATE]', {
          lotId,
          qaSamplingId: existingDraft.qa_sampling_id,
          templateId,
          samplingNo,
        });
        setHandledSaveError(true);
        await openExistingSampling(existingDraft.qa_sampling_id, 'Existing DRAFT was found and loaded. Continue editing with Save Draft.');
        throw new Error('Existing DRAFT was found and loaded.');
      }

      if (existingRows.length) {
        const message = describeExistingSampling(existingRows);
        setHandledSaveError(true);
        setSaveMessage(message);
        throw new Error(message);
      }

      return qaApi.createSampling(payload);
    },
    onSuccess: async (data) => {
      logger.info('[QA_LOT_SAMPLING][SAVE_DRAFT][API_SUCCESS]', { qa_sampling_id: data.id, status: data.status, overall_result: data.overall_result });
      setActiveQaSamplingId(data.id);
      setSaveMessage(null);
      setHandledSaveError(false);
      syncSamplingStatusCache(data);
      const statusResult = await statusQuery.refetch();
      const updatedRow = statusResult.data?.samples.find((row) => row.qa_sampling_id === data.id);
      if (updatedRow) setSelectedRow(updatedRow);
      await queryClient.invalidateQueries({ queryKey: ['qa-lot-selected-sampling', data.id] });
    },
    onError: async (error) => {
      if (!(error instanceof ApiClientError) || error.status !== 409 || !error.message.includes('already exists')) return;

      logger.warn('[QA_LOT_SAMPLING][SAVE_DRAFT][DUPLICATE_FOUND_RELOAD_STATUS]', {
        lotId,
        templateId,
        samplingNo,
        selectedProductUnitIds: sampleUnits.map((unit) => unit.id),
      });

      const statusResult = await statusQuery.refetch();
      const existingRows = findExistingSamplingRows(statusResult.data?.samples || []);
      const existingDraft = existingRows.find((row) => row.qa_status === 'DRAFT' && row.qa_sampling_id);

      if (existingDraft?.qa_sampling_id) {
        setHandledSaveError(true);
        await openExistingSampling(existingDraft.qa_sampling_id, 'Existing DRAFT was found and loaded. Continue editing with Save Draft.');
        return;
      }

      if (existingRows.length) {
        setHandledSaveError(true);
        setSaveMessage(describeExistingSampling(existingRows));
      }
    },
  });

  const workflowMutation = useMutation({
    mutationFn: ({ action, workflowRemark }: { action: 'submit' | 'review' | 'approve' | 'reject'; workflowRemark?: string }) => qaApi[action](activeQaSamplingId || 0, workflowRemark || ''),
    onSuccess: (data) => {
      logger.info('[QA_LOT_SAMPLING][WORKFLOW][API_SUCCESS]', { qa_sampling_id: data.id, status: data.status });
      syncSamplingStatusCache(data);
      queryClient.invalidateQueries({ queryKey: ['qa-lot-sampling-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qa-lot-selected-sampling', activeQaSamplingId] });
      window.setTimeout(() => samplePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    },
  });

  const requestEditMutation = useMutation({
    mutationFn: (reason: string) => qaApi.requestEditSampling(activeQaSamplingId || 0, { reason }),
    onSuccess: (data) => {
      logger.info('[EDIT_RESULT][REQUEST][API_SUCCESS]', { source: 'QA', qa_sampling_id: data.id, status: data.status });
      setEditRequestOpen(false);
      syncSamplingStatusCache(data);
      queryClient.invalidateQueries({ queryKey: ['qa-lot-sampling-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qa-lot-selected-sampling', activeQaSamplingId] });
      queryClient.invalidateQueries({ queryKey: ['qa-lot-edit-history', activeQaSamplingId] });
    },
  });

  const applyEditMutation = useMutation({
    mutationFn: (payload: Parameters<typeof qaApi.applyEditSampling>[1]) => qaApi.applyEditSampling(activeQaSamplingId || 0, payload),
    onSuccess: (data) => {
      logger.info('[EDIT_RESULT][APPLY][API_SUCCESS]', { source: 'QA', qa_sampling_id: data.id, status: data.status, overall_result: data.overall_result });
      syncSamplingStatusCache(data);
      queryClient.invalidateQueries({ queryKey: ['qa-lot-sampling-status', lotId] });
      queryClient.invalidateQueries({ queryKey: ['qa-lot-selected-sampling', activeQaSamplingId] });
      queryClient.invalidateQueries({ queryKey: ['qa-lot-edit-history', activeQaSamplingId] });
      window.setTimeout(() => samplePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  if (statusQuery.isLoading) return <LoadingPanel />;
  if (statusQuery.error) return <ErrorAlert error={statusQuery.error} />;
  if (!statusQuery.data) return <EmptyState message="QA lot not found" />;

  const { lot, summary, samples } = statusQuery.data;
  const totalSamples = samples.length;
  const startedSamples = totalSamples - summary.not_started;
  const sampleScore = totalSamples ? Math.round((startedSamples / totalSamples) * 100) : 0;
  const numberedSamples = samples.map((row, index) => ({ ...row, rowNo: index + 1 }));
  const filteredSamples = numberedSamples.filter((row) => {
    const result = row.unit_result || row.overall_result || 'N/A';
    const updated = formatDateTime(row.updated_at);
    const action = actionLabel(row.qa_status);
    return includesText(row.rowNo, sampleFilters.no)
      && includesText(row.serial_number, sampleFilters.serial)
      && (!sampleFilters.status || row.qa_status === sampleFilters.status)
      && (!sampleFilters.result || result === sampleFilters.result)
      && includesText(row.template_name || '-', sampleFilters.template)
      && includesText(updated || '-', sampleFilters.updated)
      && (!sampleFilters.action || action === sampleFilters.action);
  });
  const totalSamplePages = Math.max(1, Math.ceil(filteredSamples.length / SAMPLE_PAGE_SIZE));
  const normalizedSamplePage = Math.min(samplePage, totalSamplePages);
  const sampleStartIndex = (normalizedSamplePage - 1) * SAMPLE_PAGE_SIZE;
  const pagedSamples = filteredSamples.slice(sampleStartIndex, sampleStartIndex + SAMPLE_PAGE_SIZE);
  const statusOptions = Array.from(new Set(samples.map((row) => row.qa_status))).sort();
  const resultOptions = Array.from(new Set(samples.map((row) => row.unit_result || row.overall_result || 'N/A'))).sort();
  const actionOptions = Array.from(new Set(samples.map((row) => actionLabel(row.qa_status)))).sort();
  const hasSampleFilters = Object.values(sampleFilters).some(Boolean);
  const qaEditDetails: EditResultDetail[] = (detail.data?.sample_units || []).flatMap((unit) => unit.details.map((row) => ({
    ...row,
    template_item_id: row.template_item_id,
    serial_number: unit.serial_number,
    sample_label: `${unit.sample_no}. ${unit.serial_number}`,
  })));
  const showRequestEdit = Boolean(activeQaSamplingId && detail.data?.status === 'APPROVED' && canEditResult);
  const showApplyEdit = Boolean(activeQaSamplingId && detail.data?.status === 'EDIT_REQUESTED' && canEditResult);
  const selectedEditHistory = editHistory.data || detail.data?.edit_history || [];

  function updateSampleFilter(key: keyof SampleFilters, value: string) {
    setSampleFilters({ ...sampleFilters, [key]: value });
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <Link className="backLink" to="/qa/sampling"><ArrowLeft size={16} /> Back to Lot Search</Link>
          <span className="eyebrow">QA Sampling</span>
          <h1>{lot.lot_number}</h1>
          <p className="mutedText">{lot.model_code} - {lot.product_name}</p>
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

      {saveMutation.error && !handledSaveError ? <ErrorAlert error={saveMutation.error} title="Unable to save QA draft" /> : null}
      {saveMessage ? <div className="transactionHint">{saveMessage}</div> : null}
      {workflowMutation.error ? <ErrorAlert error={workflowMutation.error} title="Unable to update workflow" /> : null}
      {requestEditMutation.error ? <ErrorAlert error={requestEditMutation.error} title="Unable to request edit" /> : null}

      <div className="qcLotWorkspace">
        <section className="panel">
          <h2>Lot Sampling Setup</h2>
          <div className="formGrid">
            <label>Template<select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">Select QA template</option>
              {templates.data?.map((template) => <option key={template.id} value={template.id}>{template.template_name} rev {template.revision || '-'}</option>)}
            </select></label>
            <label>Method<input value={samplingMethod} onChange={(event) => setSamplingMethod(event.target.value)} /></label>
            <label>Station<input value={stationName} onChange={(event) => setStationName(event.target.value)} /></label>
            <label className="span2">Remark<input value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
          </div>
          <EquipmentSelector modelId={lot.model_id} selectedIds={equipmentIds} onChange={setEquipmentIds} onRequirementChange={setEquipmentRequired} />
        </section>

        <section className="panel" ref={samplePanelRef}>
          <div className="qcSerialPanelHeader">
            <div>
              <h2>Samples in Lot</h2>
              <p className="mutedText">{startedSamples} of {totalSamples} serials have QA sampling activity</p>
            </div>
            <strong>{sampleScore}%</strong>
          </div>
          <div className="qcScoreBar" aria-label={`QA sampling score ${sampleScore}%`}><i style={{ width: `${sampleScore}%` }} /></div>
          <div className="tableScroll">
            <table>
              <thead>
                <tr><th>No.</th><th>Serial</th><th>QA Status</th><th>Result</th><th>Template</th><th>Updated</th><th>Action</th></tr>
                <tr className="tableFilterRow">
                  <th><input aria-label="Filter by row number" value={sampleFilters.no} onChange={(event) => updateSampleFilter('no', event.target.value)} placeholder="No." /></th>
                  <th><input aria-label="Filter by serial" value={sampleFilters.serial} onChange={(event) => updateSampleFilter('serial', event.target.value)} placeholder="Serial" /></th>
                  <th><select aria-label="Filter by QA status" value={sampleFilters.status} onChange={(event) => updateSampleFilter('status', event.target.value)}><option value="">All</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></th>
                  <th><select aria-label="Filter by result" value={sampleFilters.result} onChange={(event) => updateSampleFilter('result', event.target.value)}><option value="">All</option>{resultOptions.map((result) => <option key={result} value={result}>{result}</option>)}</select></th>
                  <th><input aria-label="Filter by template" value={sampleFilters.template} onChange={(event) => updateSampleFilter('template', event.target.value)} placeholder="Template" /></th>
                  <th><input aria-label="Filter by updated date" value={sampleFilters.updated} onChange={(event) => updateSampleFilter('updated', event.target.value)} placeholder="Updated" /></th>
                  <th><select aria-label="Filter by action" value={sampleFilters.action} onChange={(event) => updateSampleFilter('action', event.target.value)}><option value="">All</option>{actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}</select></th>
                </tr>
              </thead>
              <tbody>
                {pagedSamples.map((row) => {
                  const selected = sampleUnits.some((unit) => unit.id === row.product_unit_id) || activeQaSamplingId === row.qa_sampling_id;
                  return (
                    <tr key={row.product_unit_id} className={selected ? 'selectedRow' : ''}>
                      <td>{row.rowNo}</td>
                      <td>{row.serial_number}</td>
                      <td><StatusBadge value={row.qa_status} /></td>
                      <td><StatusBadge value={row.unit_result || row.overall_result || 'N/A'} /></td>
                      <td>{row.template_name || '-'}</td>
                      <td>{formatDateTime(row.updated_at)}</td>
                      <td><button className="textButton" onClick={() => selectSample(row)}>{actionLabel(row.qa_status)}</button></td>
                    </tr>
                  );
                })}
                {!pagedSamples.length ? <tr><td colSpan={7}><EmptyState message="No samples match the current filters" /></td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="qcSerialFooter">
            <span className="mutedText">Showing {filteredSamples.length ? sampleStartIndex + 1 : 0}-{Math.min(sampleStartIndex + SAMPLE_PAGE_SIZE, filteredSamples.length)} of {filteredSamples.length}{hasSampleFilters ? ` filtered from ${totalSamples}` : ''}</span>
            <div className="pagination">
              {hasSampleFilters ? <button onClick={() => setSampleFilters(emptySampleFilters)} type="button">Clear Filters</button> : null}
              <button disabled={normalizedSamplePage <= 1} onClick={() => setSamplePage(normalizedSamplePage - 1)} type="button"><ChevronLeft size={16} /> Prev</button>
              <span>Page {normalizedSamplePage} / {totalSamplePages}</span>
              <button disabled={normalizedSamplePage >= totalSamplePages} onClick={() => setSamplePage(normalizedSamplePage + 1)} type="button">Next <ChevronRight size={16} /></button>
            </div>
          </div>
        </section>

        <section className="panel" ref={samplingFormRef}>
          <h2>QA Sampling Form</h2>
          {!sampleUnits.length ? <EmptyState message="Select one or more serials to create or continue QA sampling" /> : (
            <div className="pageStack">
              <form className="pageStack" onSubmit={submit}>
                <div className="kvGrid">
                  <div><dt>Samples</dt><dd>{sampleUnits.length}</dd></div>
                  <div><dt>Status</dt><dd><StatusBadge value={currentStatus} /></dd></div>
                  <div><dt>Preview</dt><dd><StatusBadge value={detail.data?.overall_result || overallPreview} /></dd></div>
                  <div><dt>QA Sampling ID</dt><dd>{activeQaSamplingId || '-'}</dd></div>
                </div>

                <div className="formGrid">
                  <label>Sampling No<input disabled readOnly value={samplingNo} /></label>
                </div>

                <div className="serialPreview">
                  {sampleUnits.map((unit) => <span key={unit.id}>{unit.serial_number}{!readOnly ? <button aria-label={`Remove ${unit.serial_number}`} onClick={() => removeSample(unit.id)} type="button">x</button> : null}</span>)}
                </div>

                <EquipmentCheckPanel check={equipmentCheck.data || null} />
                <EditStatusBanner status={detail.data?.status || selectedRow?.qa_status} latestReason={latestEditReason(selectedEditHistory)} />

                {items.isLoading ? <LoadingPanel /> : null}
                {items.data?.length ? sampleUnits.map((unit) => (
                  <div className="sampleGrid" key={unit.id}>
                    <h2>{unit.serial_number} <StatusBadge value={calculateOverallResult((items.data || []).map((item) => calculatePreviewResult({ ...item, ...(drafts[unit.id]?.[item.id] || emptyDraft()) })))} /></h2>
                    <ResultGrid readOnly={readOnly} items={items.data || []} values={drafts[unit.id] || {}} onChange={(itemId, value) => setDrafts({ ...drafts, [unit.id]: { ...(drafts[unit.id] || {}), [itemId]: value } })} />
                  </div>
                )) : <EmptyState message="Select a template to enter QA sample results" />}

                <div className="formActions">
                  {!readOnly ? <button className="primaryButton" disabled={saveMutation.isPending || !templateId || (equipmentRequired && !equipmentIds.length) || !sampleUnits.length || !items.data?.length} type="submit"><Save size={16} /> Save Draft</button> : null}
                  {activeQaSamplingId ? <button className="textButton" type="button" onClick={() => equipmentCheck.refetch()}>Run Equipment Check</button> : null}
                  {showRequestEdit ? <button className="primaryButton" type="button" onClick={() => { logger.info('[EDIT_RESULT][REQUEST][OPEN]', { source: 'QA', qa_sampling_id: activeQaSamplingId }); setEditRequestOpen(true); }}>Request Edit</button> : null}
                </div>
              </form>
              {activeQaSamplingId ? <ApprovalActions status={detail.data?.status || selectedRow?.qa_status} busy={workflowMutation.isPending} onSubmit={(workflowRemark) => workflowMutation.mutate({ action: 'submit', workflowRemark })} onReview={(workflowRemark) => workflowMutation.mutate({ action: 'review', workflowRemark })} onApprove={(workflowRemark) => workflowMutation.mutate({ action: 'approve', workflowRemark })} onReject={(workflowRemark) => workflowMutation.mutate({ action: 'reject', workflowRemark })} /> : null}
            </div>
          )}
        </section>

        {showApplyEdit ? <ApplyEditPanel sourceLabel="QA sampling" details={qaEditDetails} templates={items.data || []} busy={applyEditMutation.isPending} error={applyEditMutation.error} onApply={(payload) => applyEditMutation.mutate(payload)} /> : null}

        {activeQaSamplingId && canViewEditHistory ? <EditHistoryPanel rows={selectedEditHistory} /> : null}
      </div>
      <EditRequestModal open={editRequestOpen} busy={requestEditMutation.isPending} error={requestEditMutation.error} onClose={() => setEditRequestOpen(false)} onSubmit={(reason) => requestEditMutation.mutate(reason)} />
    </div>
  );
}
