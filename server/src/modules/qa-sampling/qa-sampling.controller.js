const { createdResponse, successResponse } = require('../../shared/response');
const { parsePayload, parsePositiveInt } = require('../../shared/query');
const {
  saveQaSamplingSchema,
  updateQaSamplingSchema,
  workflowRemarkSchema,
  rejectWorkflowSchema,
  editRequestSchema,
  applyApprovedResultEditSchema,
} = require('./qa-sampling.schema');
const {
  listQaLots,
  listQaLotUnits,
  listQaTemplatesByModel,
  getQaTemplateItems: getQaTemplateItemsService,
  createQaSampling,
  updateQaSampling,
  getQaSampling,
  checkQaSamplingEquipment,
  submitQaSampling,
  reviewQaSampling,
  approveQaSampling,
  rejectQaSampling,
  requestQaSamplingEdit,
  applyQaSamplingEdit,
  getQaSamplingEditHistory: getQaSamplingEditHistoryService,
} = require('./qa-sampling.service');

async function getQaLots(req, res, next) {
  try {
    const lots = await listQaLots({
      search: req.query.search,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA lots retrieved successfully',
      data: lots,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaLotUnits(req, res, next) {
  try {
    const units = await listQaLotUnits({
      lotId: parsePositiveInt(req.params.lotId, 'lotId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA lot units retrieved successfully',
      data: units,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaTemplates(req, res, next) {
  try {
    const templates = await listQaTemplatesByModel({
      modelId: parsePositiveInt(req.params.modelId, 'modelId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA templates retrieved successfully',
      data: templates,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaTemplateItems(req, res, next) {
  try {
    const items = await getQaTemplateItemsService({
      templateId: parsePositiveInt(req.params.templateId, 'templateId'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA template items retrieved successfully',
      data: items,
    });
  } catch (error) {
    return next(error);
  }
}

async function postQaSampling(req, res, next) {
  try {
    const sampling = await createQaSampling({
      payload: parsePayload(saveQaSamplingSchema, req.body),
      userId: req.user.id,
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'QA sampling created successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaSamplingById(req, res, next) {
  try {
    const sampling = await getQaSampling({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling retrieved successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function putQaSampling(req, res, next) {
  try {
    const sampling = await updateQaSampling({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateQaSamplingSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling updated successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaEquipmentCheck(req, res, next) {
  try {
    const result = await checkQaSamplingEquipment({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA equipment check completed successfully',
      data: result.validation,
    });
  } catch (error) {
    return next(error);
  }
}

async function postSubmitQaSampling(req, res, next) {
  try {
    const sampling = await submitQaSampling({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(workflowRemarkSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling submitted successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function postReviewQaSampling(req, res, next) {
  try {
    const sampling = await reviewQaSampling({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(workflowRemarkSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling reviewed successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function postApproveQaSampling(req, res, next) {
  try {
    const sampling = await approveQaSampling({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(workflowRemarkSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling approved successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function postRejectQaSampling(req, res, next) {
  try {
    const sampling = await rejectQaSampling({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      remark: parsePayload(rejectWorkflowSchema, req.body).remark,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling rejected successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function postQaSamplingEditRequest(req, res, next) {
  try {
    const sampling = await requestQaSamplingEdit({
      id: parsePositiveInt(req.params.id, 'id'),
      userId: req.user.id,
      reason: parsePayload(editRequestSchema, req.body).reason,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling edit requested successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function postApplyQaSamplingEdit(req, res, next) {
  try {
    const sampling = await applyQaSamplingEdit({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(applyApprovedResultEditSchema, req.body),
      userId: req.user.id,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling edit applied successfully',
      data: sampling,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQaSamplingEditHistory(req, res, next) {
  try {
    const history = await getQaSamplingEditHistoryService({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'QA sampling edit history retrieved successfully',
      data: history,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getQaLots,
  getQaLotUnits,
  getQaTemplates,
  getQaTemplateItems,
  postQaSampling,
  getQaSamplingById,
  putQaSampling,
  getQaEquipmentCheck,
  postSubmitQaSampling,
  postReviewQaSampling,
  postApproveQaSampling,
  postRejectQaSampling,
  postQaSamplingEditRequest,
  postApplyQaSamplingEdit,
  getQaSamplingEditHistory,
};
