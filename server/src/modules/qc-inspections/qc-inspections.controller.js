const { createdResponse, successResponse } = require('../../shared/response');
const { parsePayload, parsePositiveInt } = require('../../shared/query');
const {
  saveQcInspectionSchema,
  updateQcInspectionSchema,
  workflowRemarkSchema,
  rejectWorkflowSchema,
} = require('./qc-inspections.schema');
const {
  listQcLots,
  listQcLotUnits,
  listQcTemplatesByModel,
  getQcTemplateItems: getQcTemplateItemsService,
  createQcInspection,
  updateQcInspection,
  getQcInspection,
  checkQcInspectionEquipment,
  submitQcInspection,
  reviewQcInspection,
  approveQcInspection,
  rejectQcInspection,
} = require('./qc-inspections.service');

async function getQcLots(req, res, next) {
  try {
    const lots = await listQcLots({
      search: req.query.search,
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

module.exports = {
  getQcLots,
  getQcLotUnits,
  getQcTemplates,
  getQcTemplateItems,
  postQcInspection,
  getQcInspectionById,
  putQcInspection,
  getQcEquipmentCheck,
  postSubmitQcInspection,
  postReviewQcInspection,
  postApproveQcInspection,
  postRejectQcInspection,
};
