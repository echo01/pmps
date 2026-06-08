const { createdResponse, successResponse } = require('../../shared/response');
const { parsePayload, parsePositiveInt } = require('../../shared/query');
const {
  saveQcInspectionSchema,
  saveQcInspectionBySerialSchema,
  updateQcInspectionSchema,
  workflowRemarkSchema,
  rejectWorkflowSchema,
  bulkWorkflowSchema,
  editRequestSchema,
  applyApprovedResultEditSchema,
} = require('./qc-inspections.schema');
const {
  listQcLots,
  listQcLotUnits,
  getQcLotInspectionStatus: getQcLotInspectionStatusService,
  listQcTemplatesByModel,
  getQcTemplateItems: getQcTemplateItemsService,
  createQcInspection,
  createQcInspectionBySerial,
  updateQcInspection,
  getQcInspection,
  checkQcInspectionEquipment,
  submitQcInspection,
  reviewQcInspection,
  approveQcInspection,
  rejectQcInspection,
  bulkQcInspectionWorkflow,
  requestQcInspectionEdit,
  applyQcInspectionEdit,
  getQcInspectionEditHistory: getQcInspectionEditHistoryService,
} = require('./qc-inspections.service');

async function getQcLots(req, res, next) {
  try {
    const lots = await listQcLots({
      filters: {
        search: req.query.search,
        model_code: req.query.model_code,
        lot_number: req.query.lot_number,
        status: req.query.status,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
      },
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC lots retrieved successfully',
      data: lots,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcLotInspectionStatus(req, res, next) {
  try {
    const result = await getQcLotInspectionStatusService({
      lotId: parsePositiveInt(req.params.lotId, 'lotId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC lot inspection status retrieved successfully',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcLotUnits(req, res, next) {
  try {
    const units = await listQcLotUnits({
      lotId: parsePositiveInt(req.params.lotId, 'lotId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC lot units retrieved successfully',
      data: units,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcTemplates(req, res, next) {
  try {
    const templates = await listQcTemplatesByModel({
      modelId: parsePositiveInt(req.params.modelId, 'modelId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC templates retrieved successfully',
      data: templates,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcTemplateItems(req, res, next) {
  try {
    const items = await getQcTemplateItemsService({
      templateId: parsePositiveInt(req.params.templateId, 'templateId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC template items retrieved successfully',
      data: items,
    });
  } catch (error) {
    return next(error);
  }
}

async function postQcInspection(req, res, next) {
  try {
    const inspection = await createQcInspection({
      payload: parsePayload(saveQcInspectionSchema, req.body),
      userId: req.user.id,
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'QC inspection created successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function postQcInspectionBySerial(req, res, next) {
  try {
    const inspection = await createQcInspectionBySerial({
      payload: parsePayload(saveQcInspectionBySerialSchema, req.body),
      userId: req.user.id,
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'QC inspection created by serial successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcInspectionById(req, res, next) {
  try {
    const inspection = await getQcInspection({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection retrieved successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function putQcInspection(req, res, next) {
  try {
    const inspection = await updateQcInspection({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateQcInspectionSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection updated successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcEquipmentCheck(req, res, next) {
  try {
    const result = await checkQcInspectionEquipment({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC equipment check completed successfully',
      data: result.validation,
    });
  } catch (error) {
    return next(error);
  }
}

async function postSubmitQcInspection(req, res, next) {
  try {
    const inspection = await submitQcInspection({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(workflowRemarkSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection submitted successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function postReviewQcInspection(req, res, next) {
  try {
    const inspection = await reviewQcInspection({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(workflowRemarkSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection reviewed successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function postApproveQcInspection(req, res, next) {
  try {
    const inspection = await approveQcInspection({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(workflowRemarkSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection approved successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function postRejectQcInspection(req, res, next) {
  try {
    const inspection = await rejectQcInspection({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(rejectWorkflowSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection rejected successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function postBulkQcInspectionWorkflow(req, res, next) {
  try {
    const result = await bulkQcInspectionWorkflow({
      payload: parsePayload(bulkWorkflowSchema, req.body),
      userId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: `QC inspections ${result.action.toLowerCase()} completed successfully`,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function postQcInspectionEditRequest(req, res, next) {
  try {
    const inspection = await requestQcInspectionEdit({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      reason: parsePayload(editRequestSchema, req.body).reason,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection edit requested successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function postApplyQcInspectionEdit(req, res, next) {
  try {
    const inspection = await applyQcInspectionEdit({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(applyApprovedResultEditSchema, req.body),
      userId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection edit applied successfully',
      data: inspection,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQcInspectionEditHistory(req, res, next) {
  try {
    const history = await getQcInspectionEditHistoryService({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QC inspection edit history retrieved successfully',
      data: history,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getQcLots,
  getQcLotInspectionStatus,
  getQcLotUnits,
  getQcTemplates,
  getQcTemplateItems,
  postQcInspection,
  postQcInspectionBySerial,
  getQcInspectionById,
  putQcInspection,
  getQcEquipmentCheck,
  postSubmitQcInspection,
  postReviewQcInspection,
  postApproveQcInspection,
  postRejectQcInspection,
  postBulkQcInspectionWorkflow,
  postQcInspectionEditRequest,
  postApplyQcInspectionEdit,
  getQcInspectionEditHistory,
};
