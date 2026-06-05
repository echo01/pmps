const { withTransaction } = require('../../db/transaction');
const { conflict, notFound, unprocessable, validationError } = require('../../shared/http-error');
const { calculateItemResult, calculateOverallResult } = require('./qc-result-calculator');
const { validateQcEquipment } = require('./qc-equipment-validator');
const repository = require('./qc-inspections.repository');

function uniqueNumbers(values) {
  return [...new Set(values)];
}

function groupTemplateItems(items) {
  const sections = new Map();

  for (const item of items) {
    const sectionId = item.section_id || 0;

    if (!sections.has(sectionId)) {
      sections.set(sectionId, {
        section_id: item.section_id,
        section_code: item.section_code,
        section_name: item.section_name || 'General',
        seq_no: item.section_seq_no || 999999,
        items: [],
      });
    }

    sections.get(sectionId).items.push({
      id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      check_type: item.check_type,
      spec_min: item.spec_min,
      spec_max: item.spec_max,
      unit: item.unit,
      mandatory: item.mandatory,
      seq_no: item.seq_no,
    });
  }

  return [...sections.values()].sort((a, b) => a.seq_no - b.seq_no);
}

function normalizeItems(payloadItems, templateItems) {
  const templateById = new Map(templateItems.map((item) => [item.id, item]));
  const payloadById = new Map(payloadItems.map((item) => [item.template_item_id, item]));
  const missingItems = payloadItems.filter((item) => !templateById.has(item.template_item_id));

  if (missingItems.length) {
    throw validationError('Validation failed', [
      {
        field: 'items',
        message: `Template items not found in template: ${missingItems.map((item) => item.template_item_id).join(', ')}`,
      },
    ]);
  }

  const missingMandatory = templateItems
    .filter((item) => item.mandatory)
    .filter((item) => !payloadById.has(item.id));

  if (missingMandatory.length) {
    throw validationError('Validation failed', [
      {
        field: 'items',
        message: `Mandatory template items are missing: ${missingMandatory.map((item) => item.id).join(', ')}`,
      },
    ]);
  }

  return payloadItems.map((payloadItem) => {
    const templateItem = templateById.get(payloadItem.template_item_id);
    const result = calculateItemResult(templateItem, payloadItem);

    return {
      template_item_id: payloadItem.template_item_id,
      measured_value: payloadItem.measured_value ?? null,
      measured_text: payloadItem.measured_text || null,
      result,
      remark: payloadItem.remark || null,
      mandatory: templateItem.mandatory,
    };
  });
}

async function assertTemplateUsable(templateId, modelId) {
  const template = await repository.findTemplateById(templateId);

  if (!template) {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template not found',
      },
    ]);
  }

  if (template.template_type !== 'INSPECTION') {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template must be INSPECTION type',
      },
    ]);
  }

  if (!template.active) {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template must be active',
      },
    ]);
  }

  if (template.model_id !== modelId) {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template model does not match product unit model',
      },
    ]);
  }

  return template;
}

async function buildEquipmentValidation({ modelId, equipmentIds, requestId }) {
  const uniqueEquipmentIds = uniqueNumbers(equipmentIds);
  const [equipment, requiredEquipment] = await Promise.all([
    repository.findEquipmentByIds(uniqueEquipmentIds),
    repository.findModelRequiredEquipment(modelId),
  ]);

  const validation = validateQcEquipment({
    equipmentIds: uniqueEquipmentIds,
    equipment,
    requiredEquipment,
  });

  console.info('[QC][EQUIPMENT_VALIDATE][RESULT]', {
    requestId,
    valid: validation.valid,
    missingCount: validation.summary.missing_count,
    expiredCount: validation.summary.expired_count,
  });

  return {
    equipment,
    requiredEquipment,
    equipmentIds: uniqueEquipmentIds,
    validation,
  };
}

function assertEquipmentValid(validation) {
  if (!validation.valid) {
    throw unprocessable('QC equipment validation failed', [
      {
        field: 'equipment_ids',
        message: 'Equipment is missing, inactive, expired, or does not satisfy required equipment',
      },
    ]);
  }
}

function buildQcSummary(serials) {
  const initial = {
    not_started: 0,
    draft: 0,
    submitted: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
    edit_requested: 0,
  };

  return serials.reduce((summary, row) => {
    const key = String(row.qc_status || 'NOT_STARTED').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      summary[key] += 1;
    }
    return summary;
  }, initial);
}

async function listQcLots({ filters = {}, requestId }) {
  console.info('[QC][LOTS][LIST]', { requestId, filters });
  return repository.findQcLots(filters);
}

async function listQcLotUnits({ lotId, requestId }) {
  console.info('[QC][LOTS][UNITS]', { requestId, lotId });

  const lot = await repository.findLotById(lotId);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  return repository.findLotUnits(lotId);
}

async function getQcLotInspectionStatus({ lotId, requestId }) {
  console.info('[QC][LOTS][INSPECTION_STATUS]', { requestId, lotId });

  const lot = await repository.findLotById(lotId);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  const serials = await repository.findLotInspectionStatus(lotId);

  return {
    lot: {
      ...lot,
      serial_count: serials.length,
    },
    summary: buildQcSummary(serials),
    serials,
  };
}

async function listQcTemplatesByModel({ modelId, requestId }) {
  console.info('[QC][TEMPLATES][LIST]', { requestId, modelId });
  return repository.findInspectionTemplatesByModelId(modelId);
}

async function getQcTemplateItems({ templateId, requestId }) {
  console.info('[QC][TEMPLATES][ITEMS]', { requestId, templateId });

  const template = await repository.findTemplateById(templateId);

  if (!template) {
    throw notFound('Template not found');
  }

  if (template.template_type !== 'INSPECTION' || !template.active) {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template must be an active INSPECTION template',
      },
    ]);
  }

  return groupTemplateItems(await repository.findInspectionTemplateItems(templateId));
}

async function createQcInspection({ payload, userId, requestId }) {
  console.info('[QC][SAVE][START]', {
    requestId,
    product_unit_id: payload.product_unit_id,
    template_id: payload.template_id,
    itemCount: payload.items.length,
  });

  const unit = await repository.findProductUnitContext(payload.product_unit_id);

  if (!unit) {
    throw validationError('Validation failed', [
      {
        field: 'product_unit_id',
        message: 'Product unit not found',
      },
    ]);
  }

  await assertTemplateUsable(payload.template_id, unit.model_id);

  const duplicate = await repository.findInspectionByUnitTemplateNo(
    payload.product_unit_id,
    payload.template_id,
    payload.inspection_no
  );

  if (duplicate) {
    throw conflict('QC inspection already exists');
  }

  const templateItems = await repository.findInspectionTemplateItems(payload.template_id);
  const calculatedItems = normalizeItems(payload.items, templateItems);
  const overallResult = calculateOverallResult(calculatedItems);

  console.info('[QC][CALCULATE][OVERALL]', {
    requestId,
    overall_result: overallResult,
  });

  const equipmentContext = await buildEquipmentValidation({
    modelId: unit.model_id,
    equipmentIds: payload.equipment_ids,
    requestId,
  });

  assertEquipmentValid(equipmentContext.validation);

  let result;

  try {
    result = await withTransaction(
      async (client) => {
        const header = await repository.createInspectionHeader(
          {
            ...payload,
            operator_user_id: userId,
            overall_result: overallResult,
          },
          client
        );

        const details = await repository.insertInspectionDetails(header.id, calculatedItems, client);
        const equipment = await repository.insertInspectionEquipment(
          header.id,
          equipmentContext.equipmentIds,
          client
        );

        return {
          ...header,
          details,
          equipment,
        };
      },
      {
        requestId,
        name: 'create-qc-inspection',
      }
    );
  } catch (error) {
    if (error.code === '23505') {
      throw conflict('QC inspection already exists');
    }

    throw error;
  }

  console.info('[QC][SAVE][SUCCESS]', {
    requestId,
    inspectionId: result.id,
    overall_result: result.overall_result,
  });

  return getQcInspection({ id: result.id, requestId });
}

async function getQcInspection({ id, requestId }) {
  console.info('[QC][GET]', { requestId, id });

  const header = await repository.findInspectionById(id);

  if (!header) {
    throw notFound('QC inspection not found');
  }

  const [details, equipment, approvalLogs, editHistory] = await Promise.all([
    repository.findInspectionDetails(id),
    repository.findInspectionEquipment(id),
    repository.findApprovalLogs(id),
    repository.findResultEditAuditLogs(id),
  ]);

  return {
    ...header,
    details,
    equipment,
    approval_logs: approvalLogs,
    edit_history: editHistory,
  };
}

async function updateQcInspection({ id, payload, requestId }) {
  console.info('[QC][UPDATE][START]', { requestId, id });

  const inspection = await repository.findInspectionById(id);

  if (!inspection) {
    throw notFound('QC inspection not found');
  }

  if (inspection.status !== 'DRAFT') {
    throw conflict('Only DRAFT QC inspection can be updated');
  }

  const updateItems = payload.items || (await repository.findInspectionDetails(id)).map((item) => ({
    template_item_id: item.template_item_id,
    measured_value: item.measured_value === null ? null : Number(item.measured_value),
    measured_text: item.measured_text,
    remark: item.remark,
  }));
  const updateEquipmentIds = payload.equipment_ids
    || (await repository.findInspectionEquipment(id)).map((item) => item.equipment_id);

  const templateItems = await repository.findInspectionTemplateItems(inspection.template_id);
  const calculatedItems = normalizeItems(updateItems, templateItems);
  const overallResult = calculateOverallResult(calculatedItems);

  const equipmentContext = await buildEquipmentValidation({
    modelId: inspection.model_id,
    equipmentIds: updateEquipmentIds,
    requestId,
  });

  assertEquipmentValid(equipmentContext.validation);

  await withTransaction(
    async (client) => {
      await repository.updateInspectionHeader(
        id,
        {
          station_name: payload.station_name || inspection.station_name,
          remark: Object.prototype.hasOwnProperty.call(payload, 'remark') ? payload.remark : inspection.remark,
          overall_result: overallResult,
        },
        client
      );
      await repository.deleteInspectionDetails(id, client);
      await repository.insertInspectionDetails(id, calculatedItems, client);
      await repository.deleteInspectionEquipment(id, client);
      await repository.insertInspectionEquipment(id, equipmentContext.equipmentIds, client);
    },
    {
      requestId,
      name: 'update-qc-inspection',
    }
  );

  return getQcInspection({ id, requestId });
}

async function checkQcInspectionEquipment({ id, requestId }) {
  console.info('[QC][EQUIPMENT_CHECK]', { requestId, id });

  const inspection = await repository.findInspectionById(id);

  if (!inspection) {
    throw notFound('QC inspection not found');
  }

  const equipment = await repository.findInspectionEquipment(id);

  return buildEquipmentValidation({
    modelId: inspection.model_id,
    equipmentIds: equipment.map((row) => row.equipment_id),
    requestId,
  });
}

async function workflowTransition({ id, userId, remark, action, fromStatuses, toStatus, requestId }) {
  const inspection = await repository.findInspectionById(id);

  if (!inspection) {
    throw notFound('QC inspection not found');
  }

  if (!fromStatuses.includes(inspection.status)) {
    throw conflict(`QC inspection must be ${fromStatuses.join(' or ')}`);
  }

  if (action === 'SUBMIT' || action === 'APPROVE') {
    const equipment = await repository.findInspectionEquipment(id);
    const equipmentContext = await buildEquipmentValidation({
      modelId: inspection.model_id,
      equipmentIds: equipment.map((row) => row.equipment_id),
      requestId,
    });

    assertEquipmentValid(equipmentContext.validation);
  }

  await withTransaction(
    async (client) => {
      await repository.updateInspectionStatus(
        id,
        {
          status: toStatus,
          ...(action === 'REVIEW' ? { reviewer_user_id: userId } : {}),
          ...(action === 'APPROVE' ? { approver_user_id: userId } : {}),
        },
        client
      );

      await repository.insertApprovalLog(
        {
          source_id: id,
          action,
          old_status: inspection.status,
          new_status: toStatus,
          action_by: userId,
          remark,
        },
        client
      );
    },
    {
      requestId,
      name: `qc-${action.toLowerCase()}`,
    }
  );

  console.info(`[QC][${action}][SUCCESS]`, {
    requestId,
    inspectionId: id,
    oldStatus: inspection.status,
    newStatus: toStatus,
  });

  return getQcInspection({ id, requestId });
}

async function submitQcInspection({ id, userId, remark, requestId }) {
  return workflowTransition({
    id,
    userId,
    remark,
    action: 'SUBMIT',
    fromStatuses: ['DRAFT'],
    toStatus: 'SUBMITTED',
    requestId,
  });
}

async function reviewQcInspection({ id, userId, remark, requestId }) {
  return workflowTransition({
    id,
    userId,
    remark,
    action: 'REVIEW',
    fromStatuses: ['SUBMITTED'],
    toStatus: 'REVIEWED',
    requestId,
  });
}

async function approveQcInspection({ id, userId, remark, requestId }) {
  return workflowTransition({
    id,
    userId,
    remark,
    action: 'APPROVE',
    fromStatuses: ['REVIEWED'],
    toStatus: 'APPROVED',
    requestId,
  });
}

async function rejectQcInspection({ id, userId, remark, requestId }) {
  return workflowTransition({
    id,
    userId,
    remark,
    action: 'REJECT',
    fromStatuses: ['SUBMITTED', 'REVIEWED'],
    toStatus: 'REJECTED',
    requestId,
  });
}

async function requestQcInspectionEdit({ id, userId, reason, requestId }) {
  console.info('[QC][EDIT_REQUEST][START]', { requestId, id, userId });

  const inspection = await repository.findInspectionById(id);

  if (!inspection) {
    throw notFound('QC inspection not found');
  }

  if (inspection.status !== 'APPROVED') {
    throw conflict('Only APPROVED QC inspection can request result edit');
  }

  await withTransaction(
    async (client) => {
      await repository.updateInspectionAfterApprovedEdit(
        id,
        {
          status: 'EDIT_REQUESTED',
          overall_result: inspection.overall_result,
        },
        client
      );

      await repository.insertResultEditAuditLog(
        {
          source_id: id,
          old_overall_result: inspection.overall_result,
          new_overall_result: inspection.overall_result,
          edit_reason: reason,
          edit_by: userId,
          approval_status: 'REQUESTED',
        },
        client
      );
    },
    {
      requestId,
      name: 'qc-edit-request',
    }
  );

  return getQcInspection({ id, requestId });
}

async function applyQcInspectionEdit({ id, payload, userId, requestId }) {
  console.info('[QC][EDIT_APPLY][START]', { requestId, id, userId });

  const inspection = await repository.findInspectionById(id);

  if (!inspection) {
    throw notFound('QC inspection not found');
  }

  if (inspection.status !== 'EDIT_REQUESTED') {
    throw conflict('QC inspection must be EDIT_REQUESTED before applying edit');
  }

  const detailIds = payload.items.map((item) => item.detail_id);
  const existingDetails = await repository.findInspectionDetailsForEdit(id, detailIds);

  if (existingDetails.length !== detailIds.length) {
    throw validationError('Validation failed', [
      {
        field: 'items',
        message: 'Some detail_id values were not found in this QC inspection',
      },
    ]);
  }

  const detailById = new Map(existingDetails.map((detail) => [detail.id, detail]));
  let newOverallResult = inspection.overall_result;

  await withTransaction(
    async (client) => {
      for (const item of payload.items) {
        const oldDetail = detailById.get(item.detail_id);
        const nextMeasuredValue = Object.prototype.hasOwnProperty.call(item, 'measured_value')
          ? item.measured_value
          : oldDetail.measured_value;
        const nextMeasuredText = Object.prototype.hasOwnProperty.call(item, 'measured_text')
          ? item.measured_text
          : oldDetail.measured_text;
        const nextResult = calculateItemResult(oldDetail, {
          measured_value: nextMeasuredValue,
          measured_text: nextMeasuredText,
        });

        await repository.updateInspectionDetailResult(
          oldDetail.id,
          {
            measured_value: nextMeasuredValue,
            measured_text: nextMeasuredText,
            result: nextResult,
            remark: Object.prototype.hasOwnProperty.call(item, 'remark') ? item.remark : oldDetail.remark,
          },
          client
        );
      }

      const recalculatedDetails = await repository.findAllInspectionDetailsForOverall(id, client);
      newOverallResult = calculateOverallResult(recalculatedDetails);

      await repository.updateInspectionAfterApprovedEdit(
        id,
        {
          status: 'SUBMITTED',
          overall_result: newOverallResult,
        },
        client
      );

      for (const item of payload.items) {
        const oldDetail = detailById.get(item.detail_id);
        const nextMeasuredValue = Object.prototype.hasOwnProperty.call(item, 'measured_value')
          ? item.measured_value
          : oldDetail.measured_value;
        const nextMeasuredText = Object.prototype.hasOwnProperty.call(item, 'measured_text')
          ? item.measured_text
          : oldDetail.measured_text;
        const nextResult = calculateItemResult(oldDetail, {
          measured_value: nextMeasuredValue,
          measured_text: nextMeasuredText,
        });

        await repository.insertResultEditAuditLog(
          {
            source_id: id,
            detail_id: oldDetail.id,
            template_item_id: oldDetail.template_item_id,
            old_measured_value: oldDetail.measured_value,
            new_measured_value: nextMeasuredValue,
            old_measured_text: oldDetail.measured_text,
            new_measured_text: nextMeasuredText,
            old_result: oldDetail.result,
            new_result: nextResult,
            old_overall_result: inspection.overall_result,
            new_overall_result: newOverallResult,
            edit_reason: payload.reason,
            edit_by: userId,
            approval_status: 'APPLIED',
          },
          client
        );
      }

      await repository.insertApprovalLog(
        {
          source_id: id,
          action: 'APPLY_EDIT',
          old_status: 'EDIT_REQUESTED',
          new_status: 'SUBMITTED',
          action_by: userId,
          remark: payload.reason,
        },
        client
      );
    },
    {
      requestId,
      name: 'qc-apply-edit',
    }
  );

  console.info('[QC][EDIT_APPLY][SUCCESS]', {
    requestId,
    id,
    oldOverallResult: inspection.overall_result,
    newOverallResult,
  });

  return getQcInspection({ id, requestId });
}

async function getQcInspectionEditHistory({ id, requestId }) {
  console.info('[QC][EDIT_HISTORY]', { requestId, id });

  const inspection = await repository.findInspectionById(id);

  if (!inspection) {
    throw notFound('QC inspection not found');
  }

  return repository.findResultEditAuditLogs(id);
}

module.exports = {
  listQcLots,
  listQcLotUnits,
  getQcLotInspectionStatus,
  listQcTemplatesByModel,
  getQcTemplateItems,
  createQcInspection,
  updateQcInspection,
  getQcInspection,
  checkQcInspectionEquipment,
  submitQcInspection,
  reviewQcInspection,
  approveQcInspection,
  rejectQcInspection,
  requestQcInspectionEdit,
  applyQcInspectionEdit,
  getQcInspectionEditHistory,
};
