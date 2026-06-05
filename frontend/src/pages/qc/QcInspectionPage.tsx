import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { qcApi, QcInspectionPayload, TemplateItem, TransactionLot, TransactionUnit } from '../../api/qc.api';
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
import { calculateOverallResult, calculatePreviewResult, normalizeMeasuredText, normalizeMeasuredValue } from '../../utils/resultPreview';
import { logger } from '../../utils/logger';

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

export function QcInspectionPage() {
  const { inspectionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const canEditResult = can('EditTestResult', permissions);
  const canViewEditHistory = can('SearchReport', permissions);
  const [search, setSearch] = useState('');
  const [selectedLot, setSelectedLot] = useState<TransactionLot | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<TransactionUnit | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [equipmentIds, setEquipmentIds] = useState<number[]>([]);
  const [equipmentRequired, setEquipmentRequired] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, ResultDraft>>({});
  const [inspectionNo, setInspectionNo] = useState('1');
  const [stationName, setStationName] = useState('QC-STATION-01');
  const [remark, setRemark] = useState('');
  const [editRequestOpen, setEditRequestOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['qc-inspection', inspectionId],
    queryFn: () => qcApi.getInspection(inspectionId || ''),
    enabled: Boolean(inspectionId),
  });

  const lots = useQuery({
    queryKey: ['qc-lots', search],
    queryFn: () => {
      logger.info('[QC][LOTS_LOAD][START]', { search });
      return qcApi.getLots({ search });
    },
  });

  const units = useQuery({
    queryKey: ['qc-lot-units', selectedLot?.id],
    queryFn: () => qcApi.getLotUnits(selectedLot?.id || 0),
    enabled: Boolean(selectedLot?.id) && !inspectionId,
  });

  const templates = useQuery({
    queryKey: ['qc-templates', selectedLot?.model_id || detail.data?.model_id],
    queryFn: () => qcApi.getTemplatesByModel(selectedLot?.model_id || detail.data?.model_id || 0),
    enabled: Boolean(selectedLot?.model_id || detail.data?.model_id),
  });

  const items = useQuery({
    queryKey: ['qc-template-items', templateId || detail.data?.template_id],
    queryFn: () => qcApi.getTemplateItems(templateId || detail.data?.template_id || 0),
    enabled: Boolean(templateId || detail.data?.template_id),
  });

  const equipmentCheck = useQuery({
    queryKey: ['qc-equipment-check', inspectionId],
    queryFn: () => qcApi.checkEquipment(inspectionId || ''),
    enabled: false,
  });

  const editHistory = useQuery({
    queryKey: ['qc-inspection-edit-history', inspectionId],
    queryFn: () => qcApi.getInspectionEditHistory(inspectionId || ''),
    enabled: Boolean(inspectionId) && canViewEditHistory,
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
    setSelectedUnit({ id: detail.data.product_unit_id, lot_id: detail.data.lot_id, model_id: detail.data.model_id, serial_number: detail.data.serial_number, unit_status: '' });
    setTemplateId(String(detail.data.template_id));
    setInspectionNo(String(detail.data.inspection_no));
    setStationName(detail.data.station_name || 'QC-STATION-01');
    setRemark(detail.data.remark || '');
    setEquipmentIds((detail.data.equipment || []).map((row) => row.equipment_id));
  }, [detail.data]);

  useEffect(() => {
    if (items.data) setDrafts(toDrafts(items.data, detail.data?.details as Array<Record<string, unknown>> | undefined));
  }, [items.data, detail.data?.details]);

  const overallPreview = useMemo(() => {
    const results = (items.data || []).map((item) => calculatePreviewResult({ ...item, ...(drafts[item.id] || emptyDraft()) }));
    return calculateOverallResult(results);
  }, [drafts, items.data]);
  const status = detail.data?.status || 'NEW';
  const readOnly = Boolean(inspectionId) && !['DRAFT'].includes(status);
  const selectedEditHistory = editHistory.data || detail.data?.edit_history || [];
  const editDetails: EditResultDetail[] = (detail.data?.details || []).map((row) => ({ ...row, sample_label: detail.data?.serial_number }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: QcInspectionPayload = {
        product_unit_id: selectedUnit?.id || 0,
        template_id: Number(templateId),
        inspection_no: Number(inspectionNo),
        station_name: stationName,
        equipment_ids: equipmentIds,
        items: buildItemsPayload(items.data || [], drafts),
        remark,
      };
      logger.info('[QC][SAVE_DRAFT][START]', { product_unit_id: payload.product_unit_id, template_id: payload.template_id, itemCount: payload.items.length });
      return inspectionId ? qcApi.updateInspection(inspectionId, payload) : qcApi.createInspection(payload);
    },
    onSuccess: (data) => {
      logger.info('[QC][SAVE_DRAFT][API_SUCCESS]', { inspection_id: data.id, overall_result: data.overall_result });
      queryClient.invalidateQueries({ queryKey: ['qc-inspection'] });
      if (!inspectionId) navigate(`/qc/inspection/${data.id}`);
    },
  });

  const workflowMutation = useMutation({
    mutationFn: ({ action, workflowRemark }: { action: 'submit' | 'review' | 'approve' | 'reject'; workflowRemark?: string }) => qcApi[action](inspectionId || '', workflowRemark || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-inspection', inspectionId] });
      equipmentCheck.refetch();
    },
  });

  const requestEditMutation = useMutation({
    mutationFn: (reason: string) => qcApi.requestEditInspection(inspectionId || '', { reason }),
    onSuccess: () => {
      setEditRequestOpen(false);
      queryClient.invalidateQueries({ queryKey: ['qc-inspection', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['qc-inspection-edit-history', inspectionId] });
    },
  });

  const applyEditMutation = useMutation({
    mutationFn: (payload: Parameters<typeof qcApi.applyEditInspection>[1]) => qcApi.applyEditInspection(inspectionId || '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-inspection', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['qc-inspection-edit-history', inspectionId] });
    },
  });

  function selectLot(lot: TransactionLot) {
    logger.info('[QC][LOT_SELECT]', { lotId: lot.id });
    setSelectedLot(lot);
    setSelectedUnit(null);
    setTemplateId('');
    setDrafts({});
    setEquipmentIds([]);
  }

  function selectUnit(unit: TransactionUnit) {
    logger.info('[QC][SERIAL_SELECT]', { product_unit_id: unit.id, serial_number: unit.serial_number });
    setSelectedUnit(unit);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  if (detail.isLoading) return <LoadingPanel />;

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div><span className="eyebrow">Transaction</span><h1>QC Inspection</h1></div>
        <div className="summaryGrid transactionSummary">
          <article className="metricCard"><span>Status</span><strong><StatusBadge value={detail.data?.status || 'NEW'} /></strong></article>
          <article className="metricCard"><span>Preview</span><strong><StatusBadge value={overallPreview} /></strong></article>
        </div>
      </div>

      {detail.error ? <ErrorAlert error={detail.error} /> : null}
      {saveMutation.error ? <ErrorAlert error={saveMutation.error} title="Unable to save QC draft" /> : null}
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
        <h2>Serial and Template</h2>
        <div className="formGrid">
          <label>Serial<select disabled={Boolean(inspectionId)} value={selectedUnit?.id || ''} onChange={(event) => selectUnit((units.data || []).find((unit) => unit.id === Number(event.target.value))!)}>
            <option value="">Select serial</option>{units.data?.map((unit) => <option key={unit.id} value={unit.id}>{unit.serial_number} ({unit.unit_status})</option>)}
          </select></label>
          <label>Template<select disabled={readOnly} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Select QC template</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.template_name} rev {template.revision || '-'}</option>)}
          </select></label>
          <label>Inspection No<input disabled={readOnly} value={inspectionNo} onChange={(event) => setInspectionNo(event.target.value)} /></label>
          <label>Station<input disabled={readOnly} value={stationName} onChange={(event) => setStationName(event.target.value)} /></label>
          <label className="span2">Remark<input disabled={readOnly} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
        </div>
      </section>

      <section className="panel"><h2>Equipment</h2><EquipmentSelector modelId={selectedLot?.model_id} selectedIds={equipmentIds} onChange={readOnly ? () => undefined : setEquipmentIds} onRequirementChange={setEquipmentRequired} /></section>
      <section className="panel"><h2>Equipment Check</h2><EquipmentCheckPanel check={equipmentCheck.data || null} /></section>
      <EditStatusBanner status={status} latestReason={latestEditReason(selectedEditHistory)} />

      <form className="pageStack" onSubmit={submit}>
        <section className="panel">
          <h2>Result Grid</h2>
          {items.isLoading ? <LoadingPanel /> : null}
          {items.data?.length ? <ResultGrid readOnly={readOnly} items={items.data} values={drafts} onChange={(itemId, value) => setDrafts({ ...drafts, [itemId]: value })} /> : <EmptyState message="Select a template to enter results" />}
        </section>
        <div className="formActions">
          {!readOnly ? <button className="primaryButton" disabled={saveMutation.isPending || !selectedUnit || !templateId || (equipmentRequired && !equipmentIds.length) || !items.data?.length} type="submit"><Save size={16} /> Save Draft</button> : null}
          {inspectionId ? <button className="textButton" type="button" onClick={() => equipmentCheck.refetch()}>Run Equipment Check</button> : null}
          {inspectionId && status === 'APPROVED' && canEditResult ? <button className="primaryButton" type="button" onClick={() => setEditRequestOpen(true)}>Request Edit</button> : null}
        </div>
      </form>

      {inspectionId ? <section className="panel"><ApprovalActions status={detail.data?.status} busy={workflowMutation.isPending} onSubmit={(workflowRemark) => workflowMutation.mutate({ action: 'submit', workflowRemark })} onReview={(workflowRemark) => workflowMutation.mutate({ action: 'review', workflowRemark })} onApprove={(workflowRemark) => workflowMutation.mutate({ action: 'approve', workflowRemark })} onReject={(workflowRemark) => workflowMutation.mutate({ action: 'reject', workflowRemark })} /></section> : null}
      {inspectionId && status === 'EDIT_REQUESTED' && canEditResult ? <ApplyEditPanel sourceLabel="QC inspection" details={editDetails} templates={items.data || []} busy={applyEditMutation.isPending} error={applyEditMutation.error} onApply={(payload) => applyEditMutation.mutate(payload)} /> : null}
      {inspectionId && canViewEditHistory ? <EditHistoryPanel rows={selectedEditHistory} /> : null}
      <EditRequestModal open={editRequestOpen} busy={requestEditMutation.isPending} error={requestEditMutation.error} onClose={() => setEditRequestOpen(false)} onSubmit={(reason) => requestEditMutation.mutate(reason)} />
    </div>
  );
}
