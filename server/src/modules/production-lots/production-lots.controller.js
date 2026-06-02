const { createdResponse, successResponse } = require('../../shared/response');
const { parsePayload, parsePositiveInt } = require('../../shared/query');
const { parsePagination, paginationMeta } = require('../../shared/pagination');
const {
  serialGenerationSchema,
  createProductionLotSchema,
  updateProductionLotSchema,
  updateLotEcnSchema,
} = require('./production-lots.schema');
const {
  listProductionLots,
  getProductionLot,
  generateSerialPreview,
  createProductionLot,
  updateProductionLot,
  getProductionLotSerials: getProductionLotSerialsService,
  replaceLotEcnRefs,
  listCurrentLots,
} = require('./production-lots.service');

function lotFilters(query) {
  return {
    search: query.search,
    model_code: query.model_code,
    date_from: query.date_from,
    date_to: query.date_to,
    production_date: query.production_date,
    status: query.status,
    lot_number: query.lot_number,
  };
}

async function getProductionLots(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const result = await listProductionLots({
      filters: lotFilters(req.query),
      pagination,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Production lots retrieved successfully',
      data: result.rows,
      meta: paginationMeta({
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function postProductionLot(req, res, next) {
  try {
    const result = await createProductionLot({
      payload: parsePayload(createProductionLotSchema, req.body),
      requestId: req.requestId,
    });

    return createdResponse(res, {
      message: 'Production lot created successfully',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getProductionLotById(req, res, next) {
  try {
    const lot = await getProductionLot({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Production lot retrieved successfully',
      data: lot,
    });
  } catch (error) {
    return next(error);
  }
}

async function putProductionLot(req, res, next) {
  try {
    const lot = await updateProductionLot({
      id: parsePositiveInt(req.params.id, 'id'),
      payload: parsePayload(updateProductionLotSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Production lot updated successfully',
      data: lot,
    });
  } catch (error) {
    return next(error);
  }
}

async function getProductionLotSerials(req, res, next) {
  try {
    const serials = await getProductionLotSerialsService({
      id: parsePositiveInt(req.params.id, 'id'),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Production lot serials retrieved successfully',
      data: serials,
    });
  } catch (error) {
    return next(error);
  }
}

async function postGenerateSerials(req, res, next) {
  try {
    const serials = await generateSerialPreview({
      payload: parsePayload(serialGenerationSchema, req.body),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Serials generated successfully',
      data: serials,
    });
  } catch (error) {
    return next(error);
  }
}

async function postLotEcnRefs(req, res, next) {
  try {
    const refs = await replaceLotEcnRefs({
      id: parsePositiveInt(req.params.id, 'id'),
      ecnIds: parsePayload(updateLotEcnSchema, req.body).ecn_ids,
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Production lot ECN references updated successfully',
      data: refs,
    });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentLots(req, res, next) {
  try {
    const lots = await listCurrentLots({
      filters: lotFilters(req.query),
      requestId: req.requestId,
    });

    return successResponse(res, {
      message: 'Current lots retrieved successfully',
      data: lots,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProductionLots,
  postProductionLot,
  getProductionLotById,
  putProductionLot,
  getProductionLotSerials,
  postGenerateSerials,
  postLotEcnRefs,
  getCurrentLots,
};
