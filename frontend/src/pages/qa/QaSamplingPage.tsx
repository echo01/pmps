import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { qaApi, QaSamplingPayload } from '../../api/qa.api';
import { TemplateItem, TransactionLot, TransactionUnit } from '../../api/qc.api';
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
import { calculateCompleteOverallResult, calculatePreviewResult, normalizeMeasuredText, normalizeMeasuredValue } from '../../utils/resultPreview';
import { logger } from '../../utils/logger';

type SampleDrafts = Record<number, Record<number, ResultDraft>>;

function emptyDraft(): ResultDraft {
  return { measured_value: '', measured_text: '', remark: '' };
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

export function QaSamplingPage() {
  const { qaSamplingId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const canEditResult = can('EditTestResult', permissions);
  const canViewEditHistory = can('SearchReport', permissions);
  const [search, setSearch] = useState('');
  const [selectedLot, setSelectedLot] = useState<TransactionLot | null>(null);
  const [sampleUnits, setSampleUnits] = useState<TransactionUnit[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [equipmentIds, setEquipmentIds] = useState<number[]>([]);
  const [equipmentRequired, setEquipmentRequired] = useState(true);
  const [drafts, setDrafts] = useState<SampleDrafts>({});
  const [samplingNo, setSamplingNo] = useState('1');
  const [samplingMethod, setSamplingMethod] = useState('MANUAL');
  const [stationName, setStationName] = useState('QA-STATION-01');
  const [remark, setRemark] = useState('');
  const [editRequestOpen, setEditRequestOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['qa-sampling', qaSamplingId],
    queryFn: () => qaApi.getSampling(qaSamplingId || ''),
    enabled: Boolean(qaSamplingId),
  });

  const lots = useQuery({
    queryKey: ['qa-lots', search],
    queryFn: () => {
      logger.info('[QA][LOTS_LOAD][START]', { search });
      return qaApi.getLots({ search });
    },
  });

  const units = useQuery({
    queryKey: ['qa-lot-units', selectedLot?.id],
    queryFn: () => qaApi.getLotUnits(selectedLot?.id || 0),
    enabled: Boolean(selectedLot?.id) && !qaSamplingId,
  });

  const templates = useQuery({
    queryKey: ['qa-templates', selectedLot?.model_id || detail.data?.model_id],
    queryFn: () => qaApi.getTemplatesByModel(selectedLot?.model_id || detail.data?.model_id || 0),
    enabled: Boolean(selectedLot?.model_id || detail.data?.model_id),
  });

  const items = useQuery({
    queryKey: ['qa-template-items', templateId || detail.data?.template_id],
    queryFn: () => qaApi.getTemplateItems(templateId || detail.data?.template_id || 0),
    enabled: Boolean(templateId || detail.data?.template_id),
  });

  const equipmentCheck = useQuery({
    queryKey: ['qa-equipment-check', qaSamplingId],
    queryFn: () => qaApi.checkEquipment(qaSamplingId || ''),
    enabled: false,
  });

  const editHistory = useQuery({
    queryKey: ['qa-sampling-edit-history', qaSamplingId],
    queryFn: () => qaApi.getSamplingEditHistory(qaSamplingId || ''),
    enabled: Boolean(qaSamplingId) && canViewEditHistory,
  });

  useEffect(() => {
    if (!detail.data) return;
    setSelectedLot({
      id: detail.data.lot_id,
      lot_number: detail.data.lot_number,
      model_id: detail.data.model_id,
      model_code: detail.data.model_code,
      product_name: detail.data.product_name,
      lot_qty: 0,
      serial_count: 0,
      status: '',
    });
    setTemplateId(String(detail.data.template_id));
    setSamplingNo(String(detail.data.sampling_no));
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
    if (detail.data?.sample_units) {
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
  }, [items.data, detail.data?.sample_units, sampleUnits]);

  const overallPreview = useMemo(() => {
    const unitResults = sampleUnits.map((unit) => {
      const rowResults = (items.data || []).map((item) => calculatePreviewResult({ ...item, ...(drafts[unit.id]?.[item.id] || emptyDraft()) }));
      return calculateCompleteOverallResult(rowResults);
    });
    return calculateCompleteOverallResult(unitResults);
  }, [drafts, items.data, sampleUnits]);
  const status = detail.data?.status || 'NEW';
  const readOnly = Boolean(qaSamplingId) && !['DRAFT'].includes(status);
  const selectedEditHistory = editHistory.data || detail.data?.edit_history || [];
  const editDetails: EditResultDetail[] = (detail.data?.sample_units || []).flatMap((unit) => unit.details.map((row) => ({
    ...row,
    sample_label: `${unit.sample_no}. ${unit.serial_number}`,
    serial_number: unit.serial_number,
  })));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: QaSamplingPayload = {
        lot_id: selectedLot?.id || 0,
        template_id: Number(templateId),
        sampling_no: Number(samplingNo),
        sampling_method: samplingMethod,
        station_name: stationName,
        equipment_ids: equipmentIds,
        sample_units: sampleUnits.map((unit) => buildUnitPayload(unit, items.data || [], drafts[unit.id] || {})),
        remark,
      };
      logger.info('[QA][SAVE_DRAFT][START]', { lot_id: payload.lot_id, template_id: payload.template_id, sampleCount: payload.sample_units.length });
      return qaSamplingId ? qaApi.updateSampling(qaSamplingId, payload) : qaApi.createSampling(payload);
    },
    onSuccess: (data) => {
      logger.info('[QA][SAVE_DRAFT][API_SUCCESS]', { qa_sampling_id: data.id, overall_result: data.overall_result });
      queryClient.invalidateQueries({ queryKey: ['qa-sampling'] });
      if (!qaSamplingId) navigate(`/qa/sampling/${data.id}`);
    },
  });

  const workflowMutation = useMutation({
    mutationFn: ({ action, workflowRemark }: { action: 'submit' | 'review' | 'approve' | 'reject'; workflowRemark?: string }) => qaApi[action](qaSamplingId || '', workflowRemark || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-sampling', qaSamplingId] });
      equipmentCheck.refetch();
    },
  });

  const requestEditMutation = useMutation({
    mutationFn: (reason: string) => qaApi.requestEditSampling(qaSamplingId || '', { reason }),
    onSuccess: () => {
      setEditRequestOpen(false);
      queryClient.invalidateQueries({ queryKey: ['qa-sampling', qaSamplingId] });
      queryClient.invalidateQueries({ queryKey: ['qa-sampling-edit-history', qaSamplingId] });
    },
  });

  const applyEditMutation = useMutation({
    mutationFn: (payload: Parameters<typeof qaApi.applyEditSampling>[1]) => qaApi.applyEditSampling(qaSamplingId || '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-sampling', qaSamplingId] });
      queryClient.invalidateQueries({ queryKey: ['qa-sampling-edit-history', qaSamplingId] });
    },
  });

  function selectLot(lot: TransactionLot) {
    logger.info('[QA][LOT_SELECT]', { lotId: lot.id });
    setSelectedLot(lot);
    setSampleUnits([]);
    setTemplateId('');
    setDrafts({});
    setEquipmentIds([]);
  }

  function toggleSample(unit: TransactionUnit) {
    const exists = sampleUnits.some((row) => row.id === unit.id);
    logger.info('[QA][ADD_SAMPLE]', { product_unit_id: unit.id, serial_number: unit.serial_number });
    setSampleUnits(exists ? sampleUnits.filter((row) => row.id !== unit.id) : [...sampleUnits, unit]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  if (detail.isLoading) return <LoadingPanel />;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div><span className="eyebrow">Transaction</span><h1>QA Sampling</h1></div>
        <div className="summaryGrid transactionSummary">
          <article className="metricCard"><span>Status</span><strong><StatusBadge value={detail.data?.status || 'NEW'} /></strong></article>
          <article className="metricCard"><span>Preview</span><strong><StatusBadge value={overallPreview} /></strong></article>
        </div>
      </div>

      {detail.error ? <ErrorAlert error={detail.error} /> : null}
      {saveMutation.error ? <ErrorAlert error={saveMutation.error} title="Unable to save QA draft" /> : null}
      {workflowMutation.error ? <ErrorAlert error={workflowMutation.error} title="Unable to update workflow" /> : null}
      {requestEditMutation.error ? <ErrorAlert error={requestEditMutation.error} title="Unable to request edit" /> : null}

      <section className="panel">
        <h2>Select Lot</h2>
        <form className="filters transactionFilters" onSubmit={(event) => event.preventDefault()}>
          <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="lot, model" /></label>
          <button className="primaryButton"><Search size={16} /> Search</button>
        </form>
        <div className="tableScroll">
          <table>
            <thead><tr><th>Lot</th><th>Model</th><th>Qty</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{lots.data?.map((lot) => <tr key={lot.id}><td>{lot.lot_number}</td><td>{lot.model_code}</td><td>{lot.lot_qty}</td><td><StatusBadge value={lot.status} /></td><td><button className="textButton" onClick={() => selectLot(lot)}>Select</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Samples and Template</h2>
        <div className="formGrid">
          <label>Template<select disabled={readOnly} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Select QA template</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.template_name} rev {template.revision || '-'}</option>)}
          </select></label>
          <label>Sampling No<input disabled={readOnly} value={samplingNo} onChange={(event) => setSamplingNo(event.target.value)} /></label>
          <label>Method<input disabled={readOnly} value={samplingMethod} onChange={(event) => setSamplingMethod(event.target.value)} /></label>
          <label>Station<input disabled={readOnly} value={stationName} onChange={(event) => setStationName(event.target.value)} /></label>
          <label className="span2">Remark<input disabled={readOnly} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
        </div>
        <div className="tableScroll subPanel">
          <table>
            <thead><tr><th>Select</th><th>Serial</th><th>Status</th><th>Latest QA</th></tr></thead>
            <tbody>{units.data?.map((unit) => <tr key={unit.id}><td><input type="checkbox" checked={sampleUnits.some((row) => row.id === unit.id)} onChange={() => toggleSample(unit)} /></td><td>{unit.serial_number}</td><td>{unit.unit_status}</td><td>{unit.latest_qa_status || '-'} / {unit.latest_qa_result || '-'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel"><h2>Equipment</h2><EquipmentSelector modelId={selectedLot?.model_id} selectedIds={equipmentIds} onChange={readOnly ? () => undefined : setEquipmentIds} onRequirementChange={setEquipmentRequired} /></section>
      <section className="panel"><h2>Equipment Check</h2><EquipmentCheckPanel check={equipmentCheck.data || null} /></section>
      <EditStatusBanner status={status} latestReason={latestEditReason(selectedEditHistory)} />

      <form className="pageStack" onSubmit={submit}>
        <section className="panel">
          <h2>Sample Result Grid</h2>
          {items.isLoading ? <LoadingPanel /> : null}
          {!sampleUnits.length || !items.data?.length ? <EmptyState message="Select samples and a template to enter results" /> : null}
          {sampleUnits.map((unit) => (
            <div className="sampleGrid" key={unit.id}>
              <h2>{unit.serial_number} <StatusBadge value={calculateCompleteOverallResult((items.data || []).map((item) => calculatePreviewResult({ ...item, ...(drafts[unit.id]?.[item.id] || emptyDraft()) })))} /></h2>
              <ResultGrid readOnly={readOnly} items={items.data || []} values={drafts[unit.id] || {}} onChange={(itemId, value) => setDrafts({ ...drafts, [unit.id]: { ...(drafts[unit.id] || {}), [itemId]: value } })} />
            </div>
          ))}
        </section>
        <div className="formActions">
          {!readOnly ? <button className="primaryButton" disabled={saveMutation.isPending || !selectedLot || !templateId || (equipmentRequired && !equipmentIds.length) || !sampleUnits.length || !items.data?.length} type="submit"><Save size={16} /> Save Draft</button> : null}
          {qaSamplingId ? <button className="textButton" type="button" onClick={() => equipmentCheck.refetch()}>Run Equipment Check</button> : null}
          {qaSamplingId && status === 'APPROVED' && canEditResult ? <button className="primaryButton" type="button" onClick={() => setEditRequestOpen(true)}>Request Edit</button> : null}
        </div>
      </form>

      {qaSamplingId ? <section className="panel"><ApprovalActions status={detail.data?.status} busy={workflowMutation.isPending} onSubmit={(workflowRemark) => workflowMutation.mutate({ action: 'submit', workflowRemark })} onReview={(workflowRemark) => workflowMutation.mutate({ action: 'review', workflowRemark })} onApprove={(workflowRemark) => workflowMutation.mutate({ action: 'approve', workflowRemark })} onReject={(workflowRemark) => workflowMutation.mutate({ action: 'reject', workflowRemark })} /></section> : null}
      {qaSamplingId && status === 'EDIT_REQUESTED' && canEditResult ? <ApplyEditPanel sourceLabel="QA sampling" details={editDetails} templates={items.data || []} busy={applyEditMutation.isPending} error={applyEditMutation.error} onApply={(payload) => applyEditMutation.mutate(payload)} /> : null}
      {qaSamplingId && canViewEditHistory ? <EditHistoryPanel rows={selectedEditHistory} /> : null}
      <EditRequestModal open={editRequestOpen} busy={requestEditMutation.isPending} error={requestEditMutation.error} onClose={() => setEditRequestOpen(false)} onSubmit={(reason) => requestEditMutation.mutate(reason)} />
    </div>
  );
}
