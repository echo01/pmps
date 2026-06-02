const { withTransaction } = require('../../db/transaction');
const { conflict, notFound, unprocessable, validationError } = require('../../shared/http-error');
const {
  calculateItemResult,
  calculateUnitResult,
  calculateSamplingOverallResult,
} = require('./qa-sampling-calculator');
const { validateQaEquipment } = require('./qa-sampling-equipment-validator');
const repository = require('./qa-sampling.repository');

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

  if (template.template_type !== 'QA') {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template must be QA type',
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
        message: 'Template model does not match lot model',
      },
    ]);
  }

  return template;
}

function normalizeSampleUnits(payloadUnits, templateItems, lotUnits) {
  const templateById = new Map(templateItems.map((item) => [item.id, item]));
  const lotUnitById = new Map(lotUnits.map((unit) => [unit.id, unit]));

  return payloadUnits.map((payloadUnit, unitIndex) => {
    const lotUnit = lotUnitById.get(payloadUnit.product_unit_id);

    if (!lotUnit) {
      throw validationError('Validation failed', [
        {
          field: 'sample_units',
          message: `Product unit ${payloadUnit.product_unit_id} is not in the selected lot`,
        },
      ]);
    }

    const payloadByItemId = new Map(payloadUnit.items.map((item) => [item.template_item_id, item]));
    const missingItems = payloadUnit.items.filter((item) => !templateById.has(item.template_item_id));

    if (missingItems.length) {
      throw validationError('Validation failed', [
        {
          field: 'sample_units.items',
          message: `Template items not found in template: ${missingItems.map((item) => item.template_item_id).join(', ')}`,
        },
      ]);
    }

    const missingMandatory = templateItems
      .filter((item) => item.mandatory)
      .filter((item) => !payloadByItemId.has(item.id));

    if (missingMandatory.length) {
      throw validationError('Validation failed', [
        {
          field: 'sample_units.items',
          message: `Mandatory template items are missing for product_unit_id ${payloadUnit.product_unit_id}: ${missingMandatory.map((item) => item.id).join(', ')}`,
        },
      ]);
    }

    const details = payloadUnit.items.map((payloadItem) => {
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
    const unitResult = calculateUnitResult(details);

    return {
      product_unit_id: payloadUnit.product_unit_id,
      sample_no: unitIndex + 1,
      serial_number: lotUnit.serial_number,
      unit_result: unitResult,
      remark: payloadUnit.remark || null,
      details,
    };
  });
}

async function buildEquipmentValidation({ modelId, equipmentIds, requestId }) {
  const uniqueEquipmentIds = uniqueNumbers(equipmentIds);
  const [equipment, requiredEquipment] = await Promise.all([
    repository.findEquipmentByIds(uniqueEquipmentIds),
    repository.findModelRequiredEquipment(modelId),
  ]);

  const validation = validateQaEquipment({
    equipmentIds: uniqueEquipmentIds,
    equipment,
    requiredEquipment,
  });

  console.info('[QA][EQUIPMENT_VALIDATE][RESULT]', {
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
    throw unprocessable('QA equipment validation failed', [
      {
        field: 'equipment_ids',
        message: 'Equipment is missing, inactive, expired, or does not satisfy required equipment',
      },
    ]);
  }
}

async function listQaLots({ search, requestId }) {
  console.info('[QA][LOTS][LIST]', { requestId, search });
  return repository.findQaLots({ search });
}

async function listQaLotUnits({ lotId, requestId }) {
  console.info('[QA][LOTS][UNITS]', { requestId, lotId });

  const lot = await repository.findLotById(lotId);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  return repository.findLotUnits(lotId);
}

async function listQaTemplatesByModel({ modelId, requestId }) {
  console.info('[QA][TEMPLATES][LIST]', { requestId, modelId });
  return repository.findQaTemplatesByModelId(modelId);
}

async function getQaTemplateItems({ templateId, requestId }) {
  console.info('[QA][TEMPLATES][ITEMS]', { requestId, templateId });

  const template = await repository.findTemplateById(templateId);

  if (!template) {
    throw notFound('Template not found');
  }

  if (template.template_type !== 'QA' || !template.active) {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template must be an active QA template',
      },
    ]);
  }

  return groupTemplateItems(await repository.findQaTemplateItems(templateId));
}

async function buildSamplingContext({ payload, requestId, excludeSamplingId }) {
  const lot = await repository.findLotById(payload.lot_id);

  if (!lot) {
    throw validationError('Validation failed', [
      {
        field: 'lot_id',
        message: 'Production lot not found',
      },
    ]);
  }

  await assertTemplateUsable(payload.template_id, lot.model_id);

  const duplicate = await repository.findQaSamplingByLotTemplateNo(
    payload.lot_id,
    payload.template_id,
    payload.sampling_no,
    excludeSamplingId
  );

  if (duplicate) {
    throw conflict('QA sampling already exists');
  }

  const productUnitIds = payload.sample_units.map((unit) => unit.product_unit_id);
  const [lotUnits, templateItems] = await Promise.all([
    repository.findLotUnitsByIds(payload.lot_id, productUnitIds),
    repository.findQaTemplateItems(payload.template_id),
  ]);

  const sampleUnits = normalizeSampleUnits(payload.sample_units, templateItems, lotUnits);
  const overallResult = calculateSamplingOverallResult(sampleUnits);
  const acceptQty = sampleUnits.filter((unit) => unit.unit_result === 'PASS').length;
  const rejectQty = sampleUnits.filter((unit) => unit.unit_result === 'FAIL').length;

  console.info('[QA][CALCULATE][OVERALL]', {
    requestId,
    overall_result: overallResult,
    sampleQty: sampleUnits.length,
  });

  const equipmentContext = await buildEquipmentValidation({
    modelId: lot.model_id,
    equipmentIds: payload.equipment_ids,
    requestId,
  });

  assertEquipmentValid(equipmentContext.validation);

  return {
    lot,
    sampleUnits,
    overallResult,
    acceptQty,
    rejectQty,
    equipmentContext,
  };
}

async function createQaSampling({ payload, userId, requestId }) {
  console.info('[QA][SAVE][START]', {
    requestId,
    lot_id: payload.lot_id,
    template_id: payload.template_id,
    sampleUnitCount: payload.sample_units.length,
  });

  const context = await buildSamplingContext({ payload, requestId });
  let result;

  try {
    result = await withTransaction(
      async (client) => {
        const header = await repository.createQaSamplingHeader(
          {
            ...payload,
            lot_qty: context.lot.lot_qty,
            sample_qty: context.sampleUnits.length,
            accept_qty: context.acceptQty,
            reject_qty: context.rejectQty,
            overall_result: context.overallResult,
            qa_operator_user_id: userId,
          },
          client
        );

        const insertedUnits = await repository.insertQaSampleUnits(
          header.id,
          context.sampleUnits,
          client
        );
        const unitIdByProductUnitId = new Map(
          insertedUnits.map((unit) => [unit.product_unit_id, unit.id])
        );
        const details = context.sampleUnits.flatMap((unit) => unit.details.map((detail) => ({
          ...detail,
          qa_sample_unit_id: unitIdByProductUnitId.get(unit.product_unit_id),
        })));

        await repository.insertQaSampleDetails(details, client);
        await repository.insertQaSamplingEquipment(
          header.id,
          context.equipmentContext.equipmentIds,
          client
        );

        return header;
      },
      {
        requestId,
        name: 'create-qa-sampling',
      }
    );
  } catch (error) {
    if (error.code === '23505') {
      throw conflict('QA sampling already exists');
    }

    throw error;
  }

  console.info('[QA][SAVE][SUCCESS]', {
    requestId,
    qaSamplingId: result.id,
    overall_result: result.overall_result,
  });

  return getQaSampling({ id: result.id, requestId });
}

async function getQaSampling({ id, requestId }) {
  console.info('[QA][GET]', { requestId, id });

  const header = await repository.findQaSamplingById(id);

  if (!header) {
    throw notFound('QA sampling not found');
  }

  const [sampleUnits, details, equipment, approvalLogs] = await Promise.all([
    repository.findQaSampleUnits(id),
    repository.findQaSampleDetails(id),
    repository.findQaSamplingEquipment(id),
    repository.findApprovalLogs(id),
  ]);
  const detailsByUnitId = details.reduce((map, detail) => {
    if (!map.has(detail.qa_sample_unit_id)) {
      map.set(detail.qa_sample_unit_id, []);
    }

    map.get(detail.qa_sample_unit_id).push(detail);
    return map;
  }, new Map());

  return {
    ...header,
    sample_units: sampleUnits.map((unit) => ({
      ...unit,
      details: detailsByUnitId.get(unit.id) || [],
    })),
    equipment,
    approval_logs: approvalLogs,
  };
}

async function updateQaSampling({ id, payload, requestId }) {
  console.info('[QA][UPDATE][START]', { requestId, id });

  const sampling = await repository.findQaSamplingById(id);

  if (!sampling) {
    throw notFound('QA sampling not found');
  }

  if (sampling.status !== 'DRAFT') {
    throw conflict('Only DRAFT QA sampling can be updated');
  }

  const existingSampling = await getQaSampling({ id, requestId });
  const updatePayload = {
    lot_id: sampling.lot_id,
    template_id: sampling.template_id,
    sampling_no: sampling.sampling_round,
    sampling_method: payload.sampling_method || sampling.sampling_method || 'MANUAL',
    station_name: payload.station_name || sampling.station_name,
    equipment_ids: payload.equipment_ids || existingSampling.equipment.map((row) => row.equipment_id),
    sample_units: payload.sample_units || existingSampling.sample_units.map((unit) => ({
      product_unit_id: unit.product_unit_id,
      remark: unit.remark,
      items: unit.details.map((detail) => ({
        template_item_id: detail.template_item_id,
        measured_value: detail.measured_value === null ? null : Number(detail.measured_value),
        measured_text: detail.measured_text,
        remark: detail.remark,
      })),
    })),
    remark: Object.prototype.hasOwnProperty.call(payload, 'remark') ? payload.remark : sampling.remark,
  };
  const duplicate = await repository.findQaSamplingByLotTemplateNo(
    updatePayload.lot_id,
    updatePayload.template_id,
    updatePayload.sampling_no,
    id
  );

  if (duplicate) {
    throw conflict('QA sampling already exists');
  }

  const context = await buildSamplingContext({
    payload: updatePayload,
    requestId,
    excludeSamplingId: id,
  });

  await withTransaction(
    async (client) => {
      await repository.updateQaSamplingHeader(
        id,
        {
          sampling_method: updatePayload.sampling_method,
          station_name: updatePayload.station_name,
          sample_qty: context.sampleUnits.length,
          accept_qty: context.acceptQty,
          reject_qty: context.rejectQty,
          overall_result: context.overallResult,
          remark: updatePayload.remark,
        },
        client
      );
      await repository.deleteQaSampleDetails(id, client);
      await repository.deleteQaSampleUnits(id, client);
      const insertedUnits = await repository.insertQaSampleUnits(id, context.sampleUnits, client);
      const unitIdByProductUnitId = new Map(
        insertedUnits.map((unit) => [unit.product_unit_id, unit.id])
      );
      const details = context.sampleUnits.flatMap((unit) => unit.details.map((detail) => ({
        ...detail,
        qa_sample_unit_id: unitIdByProductUnitId.get(unit.product_unit_id),
      })));

      await repository.insertQaSampleDetails(details, client);
      await repository.deleteQaSamplingEquipment(id, client);
      await repository.insertQaSamplingEquipment(id, context.equipmentContext.equipmentIds, client);
    },
    {
      requestId,
      name: 'update-qa-sampling',
    }
  );

  return getQaSampling({ id, requestId });
}

async function checkQaSamplingEquipment({ id, requestId }) {
  console.info('[QA][EQUIPMENT_CHECK]', { requestId, id });

  const sampling = await repository.findQaSamplingById(id);

  if (!sampling) {
    throw notFound('QA sampling not found');
  }

  const equipment = await repository.findQaSamplingEquipment(id);

  return buildEquipmentValidation({
    modelId: sampling.model_id,
    equipmentIds: equipment.map((row) => row.equipment_id),
    requestId,
  });
}

async function workflowTransition({ id, userId, remark, action, fromStatuses, toStatus, requestId }) {
  const sampling = await repository.findQaSamplingById(id);

  if (!sampling) {
    throw notFound('QA sampling not found');
  }

  if (!fromStatuses.includes(sampling.status)) {
    throw conflict(`QA sampling must be ${fromStatuses.join(' or ')}`);
  }

  if (action === 'SUBMIT' || action === 'APPROVE') {
    const equipment = await repository.findQaSamplingEquipment(id);
    const equipmentContext = await buildEquipmentValidation({
      modelId: sampling.model_id,
      equipmentIds: equipment.map((row) => row.equipment_id),
      requestId,
    });

    assertEquipmentValid(equipmentContext.validation);
  }

  await withTransaction(
    async (client) => {
      await repository.updateQaSamplingStatus(
        id,
        {
          status: toStatus,
          ...(action === 'REVIEW' ? { qa_reviewer_user_id: userId } : {}),
          ...(action === 'APPROVE' ? { qa_approver_user_id: userId } : {}),
        },
        client
      );

      await repository.insertApprovalLog(
        {
          source_id: id,
          action,
          old_status: sampling.status,
          new_status: toStatus,
          action_by: userId,
          remark,
        },
        client
      );
    },
    {
      requestId,
      name: `qa-${action.toLowerCase()}`,
    }
  );

  console.info(`[QA][${action}][SUCCESS]`, {
    requestId,
    qaSamplingId: id,
    oldStatus: sampling.status,
    newStatus: toStatus,
  });

  return getQaSampling({ id, requestId });
}

async function submitQaSampling({ id, userId, remark, requestId }) {
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

async function reviewQaSampling({ id, userId, remark, requestId }) {
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

async function approveQaSampling({ id, userId, remark, requestId }) {
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

async function rejectQaSampling({ id, userId, remark, requestId }) {
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

module.exports = {
  listQaLots,
  listQaLotUnits,
  listQaTemplatesByModel,
  getQaTemplateItems,
  createQaSampling,
  updateQaSampling,
  getQaSampling,
  checkQaSamplingEquipment,
  submitQaSampling,
  reviewQaSampling,
  approveQaSampling,
  rejectQaSampling,
};
