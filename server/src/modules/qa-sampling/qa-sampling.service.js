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

function minimumSampleQty(lotQty) {
  return Math.max(1, Math.ceil(Number(lotQty || 0) * 0.1));
}

function samplingProgress(lotQty, selectedQty) {
  const total = Number(lotQty || 0);
  const selected = Number(selectedQty || 0);

  return {
    minimum_sample_qty: minimumSampleQty(total),
    selected_sample_qty: selected,
    sampling_percent: total ? Math.round((selected / total) * 10000) / 100 : 0,
  };
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

  const assigned = await repository.isTemplateAssignedToModel(templateId, modelId);

  if (!assigned) {
    throw validationError('Validation failed', [
      {
        field: 'template_id',
        message: 'Template is not assigned to lot model',
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

function resolveBySerialItems(payloadItems, templateItems) {
  const codeToItems = new Map();

  for (const item of templateItems) {
    const code = String(item.item_code || '').trim().toUpperCase();
    if (!code) continue;
    if (!codeToItems.has(code)) codeToItems.set(code, []);
    codeToItems.get(code).push(item);
  }

  const resolved = payloadItems.map((payloadItem) => {
    if (payloadItem.template_item_id) {
      if (payloadItem.item_code) {
        const matchingItem = templateItems.find((item) => item.id === payloadItem.template_item_id);
        if (matchingItem && String(matchingItem.item_code || '').trim().toUpperCase() !== String(payloadItem.item_code).trim().toUpperCase()) {
          throw validationError('Validation failed', [
            {
              field: 'items',
              message: `item_code ${payloadItem.item_code} does not match template_item_id ${payloadItem.template_item_id}`,
            },
          ]);
        }
      }
      return payloadItem;
    }

    const matches = codeToItems.get(String(payloadItem.item_code || '').trim().toUpperCase()) || [];
    if (!matches.length) {
      throw validationError('Validation failed', [
        {
          field: 'items',
          message: `Template item code not found in template: ${payloadItem.item_code}`,
        },
      ]);
    }
    if (matches.length > 1) {
      throw validationError('Validation failed', [
        {
          field: 'items',
          message: `Template item code is duplicated in template: ${payloadItem.item_code}`,
        },
      ]);
    }

    return {
      template_item_id: matches[0].id,
      measured_value: payloadItem.measured_value ?? null,
      measured_text: payloadItem.measured_text || null,
      remark: payloadItem.remark || null,
    };
  });

  const ids = resolved.map((item) => item.template_item_id);
  if (new Set(ids).size !== ids.length) {
    throw validationError('Validation failed', [
      {
        field: 'items',
        message: 'template_item_id or item_code must not resolve to duplicated template item',
      },
    ]);
  }

  return resolved;
}

function samplingUnitToPayload(unit) {
  return {
    product_unit_id: unit.product_unit_id,
    remark: unit.remark || null,
    items: unit.details.map((detail) => ({
      template_item_id: detail.template_item_id,
      measured_value: detail.measured_value === null ? null : Number(detail.measured_value),
      measured_text: detail.measured_text,
      remark: detail.remark,
    })),
  };
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

async function listQaLots({ filters = {}, requestId }) {
  console.info('[QA][LOTS][LIST]', { requestId, filters });
  return repository.findQaLots(filters);
}

function buildQaSummary(samples) {
  const summary = {
    not_started: 0,
    draft: 0,
    submitted: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
    edit_requested: 0,
  };

  for (const sample of samples) {
    const key = String(sample.qa_status || 'NOT_STARTED').toLowerCase();

    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      summary[key] += 1;
    }
  }

  return summary;
}

async function getQaLotSamplingStatus({ lotId, requestId }) {
  console.info('[QA][LOTS][SAMPLING_STATUS]', { requestId, lotId });

  const lot = await repository.findLotById(lotId);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  const samples = await repository.findLotSamplingStatus(lotId);
  const latestSample = samples
    .filter((sample) => sample.qa_sampling_id)
    .sort((left, right) => {
      const timeDifference = new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
      return timeDifference || Number(right.qa_sampling_id) - Number(left.qa_sampling_id);
    })[0];
  const selectedSampleQty = latestSample
    ? samples.filter((sample) => sample.qa_sampling_id === latestSample.qa_sampling_id).length
    : 0;

  return {
    lot: {
      ...lot,
      serial_count: samples.length,
      qa_sampling_id: latestSample?.qa_sampling_id || null,
      sampling_status: latestSample?.qa_status || 'NOT_STARTED',
      ...samplingProgress(lot.lot_qty, selectedSampleQty),
    },
    summary: buildQaSummary(samples),
    samples,
  };
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

async function createQaSamplingBySerial({ payload, userId, requestId }) {
  console.info('[QA][SAVE_BY_SERIAL][START]', {
    requestId,
    lot_number: payload.lot_number,
    serial_number: payload.serial_number,
    template_id: payload.template_id || null,
    sampling_no: payload.sampling_no || null,
  });

  const unit = await repository.findProductUnitContextByLotAndSerial(
    payload.lot_number,
    payload.serial_number
  );

  if (!unit) {
    throw validationError('Validation failed', [
      {
        field: 'serial_number',
        message: 'Serial number was not found in the specified lot',
      },
    ]);
  }

  let templateId = payload.template_id || null;
  if (!templateId) {
    const templates = await repository.findQaTemplatesByModelId(unit.model_id);
    templateId = templates[0]?.id || null;
    if (!templateId) {
      throw validationError('Validation failed', [
        {
          field: 'template_id',
          message: 'No active QA template is assigned to this model',
        },
      ]);
    }
  }

  await assertTemplateUsable(templateId, unit.model_id);
  const templateItems = await repository.findQaTemplateItems(templateId);
  const resolvedItems = resolveBySerialItems(payload.items, templateItems);

  let existing = null;
  if (payload.sampling_no) {
    existing = await repository.findQaSamplingByLotTemplateNo(
      unit.lot_id,
      templateId,
      payload.sampling_no
    );
  } else {
    existing = await repository.findLatestDraftSampling(unit.lot_id, templateId);
  }

  if (existing && existing.status !== 'DRAFT') {
    throw conflict('QA sampling round already exists and is not DRAFT');
  }

  if (existing) {
    const current = await getQaSampling({ id: existing.id, requestId });
    const sampleUnits = current.sample_units
      .filter((sampleUnit) => sampleUnit.product_unit_id !== unit.id)
      .map(samplingUnitToPayload);
    sampleUnits.push({
      product_unit_id: unit.id,
      remark: payload.sample_remark || null,
      items: resolvedItems,
    });

    const updated = await updateQaSampling({
      id: existing.id,
      payload: {
        sampling_method: payload.sampling_method || current.sampling_method || 'MANUAL',
        station_name: payload.station_name,
        equipment_ids: payload.equipment_ids ?? current.equipment.map((row) => row.equipment_id),
        sample_units: sampleUnits,
        remark: Object.prototype.hasOwnProperty.call(payload, 'remark')
          ? payload.remark
          : current.remark,
      },
      requestId,
    });

    console.info('[QA][SAVE_BY_SERIAL][UPDATED]', {
      requestId,
      qaSamplingId: updated.id,
      product_unit_id: unit.id,
      selected_sample_qty: updated.selected_sample_qty,
    });
    return updated;
  }

  const samplingNo = payload.sampling_no
    || await repository.findNextSamplingNo(unit.lot_id, templateId);
  const created = await createQaSampling({
    payload: {
      lot_id: unit.lot_id,
      template_id: templateId,
      sampling_no: samplingNo,
      sampling_method: payload.sampling_method || 'MANUAL',
      station_name: payload.station_name,
      equipment_ids: payload.equipment_ids || [],
      sample_units: [
        {
          product_unit_id: unit.id,
          remark: payload.sample_remark || null,
          items: resolvedItems,
        },
      ],
      remark: payload.remark,
    },
    userId,
    requestId,
  });

  console.info('[QA][SAVE_BY_SERIAL][CREATED]', {
    requestId,
    qaSamplingId: created.id,
    product_unit_id: unit.id,
    sampling_no: samplingNo,
  });
  return created;
}

async function getQaSampling({ id, requestId }) {
  console.info('[QA][GET]', { requestId, id });

  const header = await repository.findQaSamplingById(id);

  if (!header) {
    throw notFound('QA sampling not found');
  }

  const [sampleUnits, details, equipment, approvalLogs, editHistory] = await Promise.all([
    repository.findQaSampleUnits(id),
    repository.findQaSampleDetails(id),
    repository.findQaSamplingEquipment(id),
    repository.findApprovalLogs(id),
    repository.findResultEditAuditLogs(id),
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
    ...samplingProgress(header.lot_qty, sampleUnits.length),
    sample_units: sampleUnits.map((unit) => ({
      ...unit,
      details: detailsByUnitId.get(unit.id) || [],
    })),
    equipment,
    approval_logs: approvalLogs,
    edit_history: editHistory,
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

  if (action === 'SUBMIT' && sampling.overall_result === 'N/A') {
    throw unprocessable('QA sampling cannot be submitted until every test item has a result', [
      {
        field: 'overall_result',
        message: 'Complete every test item before submitting QA sampling',
      },
    ]);
  }

  const requiredSampleQty = minimumSampleQty(sampling.lot_qty);

  if (action === 'SUBMIT' && Number(sampling.sample_qty || 0) < requiredSampleQty) {
    throw unprocessable(`QA sampling requires at least ${requiredSampleQty} sample(s), equal to 10% of the lot rounded up`, [
      {
        field: 'sample_qty',
        message: `Select at least ${requiredSampleQty} sample(s) from lot size ${sampling.lot_qty}`,
      },
    ]);
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

function groupDetailsByUnit(details) {
  return details.reduce((map, detail) => {
    if (!map.has(detail.qa_sample_unit_id)) {
      map.set(detail.qa_sample_unit_id, []);
    }

    map.get(detail.qa_sample_unit_id).push(detail);
    return map;
  }, new Map());
}

async function requestQaSamplingEdit({ id, userId, reason, requestId }) {
  console.info('[QA][EDIT_REQUEST][START]', { requestId, id, userId });

  const sampling = await repository.findQaSamplingById(id);

  if (!sampling) {
    throw notFound('QA sampling not found');
  }

  if (sampling.status !== 'APPROVED') {
    throw conflict('Only APPROVED QA sampling can request result edit');
  }

  await withTransaction(
    async (client) => {
      await repository.updateQaSamplingAfterApprovedEdit(
        id,
        {
          status: 'EDIT_REQUESTED',
          overall_result: sampling.overall_result,
          accept_qty: sampling.accept_qty,
          reject_qty: sampling.reject_qty,
        },
        client
      );

      await repository.insertResultEditAuditLog(
        {
          source_id: id,
          old_overall_result: sampling.overall_result,
          new_overall_result: sampling.overall_result,
          edit_reason: reason,
          edit_by: userId,
          approval_status: 'REQUESTED',
        },
        client
      );
    },
    {
      requestId,
      name: 'qa-edit-request',
    }
  );

  return getQaSampling({ id, requestId });
}

async function applyQaSamplingEdit({ id, payload, userId, requestId }) {
  console.info('[QA][EDIT_APPLY][START]', { requestId, id, userId });

  const sampling = await repository.findQaSamplingById(id);

  if (!sampling) {
    throw notFound('QA sampling not found');
  }

  if (sampling.status !== 'EDIT_REQUESTED') {
    throw conflict('QA sampling must be EDIT_REQUESTED before applying edit');
  }

  const detailIds = payload.items.map((item) => item.detail_id);
  const existingDetails = await repository.findQaSampleDetailsForEdit(id, detailIds);

  if (existingDetails.length !== detailIds.length) {
    throw validationError('Validation failed', [
      {
        field: 'items',
        message: 'Some detail_id values were not found in this QA sampling',
      },
    ]);
  }

  const detailById = new Map(existingDetails.map((detail) => [detail.id, detail]));
  let newOverallResult = sampling.overall_result;

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

        await repository.updateQaSampleDetailResult(
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

      const recalculatedDetails = await repository.findAllQaSampleDetailsForOverall(id, client);
      const detailsByUnit = groupDetailsByUnit(recalculatedDetails);
      const sampleUnits = [];

      for (const [unitId, unitDetails] of detailsByUnit.entries()) {
        const unitResult = calculateUnitResult(unitDetails);
        sampleUnits.push({
          id: unitId,
          unit_result: unitResult,
        });
        await repository.updateQaSampleUnitResult(unitId, unitResult, client);
      }

      newOverallResult = calculateSamplingOverallResult(sampleUnits);
      const acceptQty = sampleUnits.filter((unit) => unit.unit_result === 'PASS').length;
      const rejectQty = sampleUnits.filter((unit) => unit.unit_result === 'FAIL').length;

      await repository.updateQaSamplingAfterApprovedEdit(
        id,
        {
          status: 'SUBMITTED',
          overall_result: newOverallResult,
          accept_qty: acceptQty,
          reject_qty: rejectQty,
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
            old_overall_result: sampling.overall_result,
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
      name: 'qa-apply-edit',
    }
  );

  console.info('[QA][EDIT_APPLY][SUCCESS]', {
    requestId,
    id,
    oldOverallResult: sampling.overall_result,
    newOverallResult,
  });

  return getQaSampling({ id, requestId });
}

async function getQaSamplingEditHistory({ id, requestId }) {
  console.info('[QA][EDIT_HISTORY]', { requestId, id });

  const sampling = await repository.findQaSamplingById(id);

  if (!sampling) {
    throw notFound('QA sampling not found');
  }

  return repository.findResultEditAuditLogs(id);
}

module.exports = {
  listQaLots,
  getQaLotSamplingStatus,
  listQaLotUnits,
  listQaTemplatesByModel,
  getQaTemplateItems,
  createQaSampling,
  createQaSamplingBySerial,
  updateQaSampling,
  getQaSampling,
  checkQaSamplingEquipment,
  submitQaSampling,
  reviewQaSampling,
  approveQaSampling,
  rejectQaSampling,
  requestQaSamplingEdit,
  applyQaSamplingEdit,
  getQaSamplingEditHistory,
};
