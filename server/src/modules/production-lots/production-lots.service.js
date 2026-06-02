const { withTransaction } = require('../../db/transaction');
const { conflict, notFound, validationError } = require('../../shared/http-error');
const { findModelById } = require('../products/products.repository');
const { generateSerials } = require('./serial-generator');
const repository = require('./production-lots.repository');

function uniqueNumbers(values) {
  return [...new Set(values)];
}

function assertNoDuplicatedSerials(serials) {
  const seen = new Set();
  const duplicated = serials.find((serial) => {
    if (seen.has(serial)) {
      return true;
    }

    seen.add(serial);
    return false;
  });

  if (duplicated) {
    throw conflict('Serial number is duplicated in payload', [
      {
        field: 'serial_generation',
        message: `Serial number ${duplicated} is duplicated`,
      },
    ]);
  }
}

async function assertEcnIdsExist(ecnIds) {
  const uniqueEcnIds = uniqueNumbers(ecnIds);
  const foundEcns = await repository.findEcnByIds(uniqueEcnIds);

  if (foundEcns.length !== uniqueEcnIds.length) {
    const foundIds = new Set(foundEcns.map((ecn) => ecn.id));
    const missing = uniqueEcnIds.filter((ecnId) => !foundIds.has(ecnId));

    throw validationError('Validation failed', [
      {
        field: 'ecn_ids',
        message: `ECN ids not found: ${missing.join(', ')}`,
      },
    ]);
  }

  return uniqueEcnIds;
}

async function listProductionLots({ filters, pagination, requestId }) {
  console.info('[PRODUCTION_LOTS][LIST]', { requestId, filters });

  const [rows, total] = await Promise.all([
    repository.findLots({
      filters,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    repository.countLots(filters),
  ]);

  return {
    rows,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

async function getProductionLot({ id, requestId }) {
  console.info('[PRODUCTION_LOTS][GET]', { requestId, id });

  const lot = await repository.findLotById(id);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  return {
    ...lot,
    ecn_refs: await repository.findLotEcnRefs(id),
  };
}

async function generateSerialPreview({ payload, requestId }) {
  console.info('[PRODUCTION_LOTS][GENERATE_SERIALS]', {
    requestId,
    prefix: payload.prefix,
    count: payload.count,
  });

  return generateSerials(payload);
}

async function createProductionLot({ payload, requestId }) {
  console.info('[PRODUCTION_LOTS][CREATE][START]', {
    requestId,
    modelId: payload.model_id,
    lotNumber: payload.lot_number,
    lotQty: payload.lot_qty,
  });

  const model = await findModelById(payload.model_id);

  if (!model) {
    throw validationError('Validation failed', [
      {
        field: 'model_id',
        message: 'Product model not found',
      },
    ]);
  }

  const duplicatedLot = await repository.findLotByModelAndLotNumber(
    payload.model_id,
    payload.lot_number
  );

  if (duplicatedLot) {
    throw conflict('Production lot already exists', [
      {
        field: 'lot_number',
        message: 'Lot number already exists for this model',
      },
    ]);
  }

  const serials = generateSerials(payload.serial_generation);

  if (serials.length !== payload.lot_qty) {
    throw validationError('Validation failed', [
      {
        field: 'lot_qty',
        message: 'Generated serial count must equal lot_qty',
      },
    ]);
  }

  assertNoDuplicatedSerials(serials);

  const existingSerials = await repository.findExistingSerialsByModelId(
    payload.model_id,
    serials
  );

  if (existingSerials.length) {
    throw conflict('Serial number already exists', [
      {
        field: 'serial_generation',
        message: `Serial numbers already exist: ${existingSerials.join(', ')}`,
      },
    ]);
  }

  const ecnIds = await assertEcnIdsExist(payload.ecn_ids || []);

  let result;

  try {
    result = await withTransaction(
      async (client) => {
        const lot = await repository.createLot(
          {
            ...payload,
            status: 'OPEN',
          },
          client
        );

        const insertedSerials = await repository.insertProductUnits(
          {
            lotId: lot.id,
            modelId: payload.model_id,
            serialNumbers: serials,
          },
          client
        );

        await repository.insertLotEcnRefs(lot.id, ecnIds, client);

        return {
          lot: {
            ...lot,
            serial_count: insertedSerials.length,
            ecn_refs: await repository.findLotEcnRefs(lot.id, client),
          },
          serials: insertedSerials,
        };
      },
      {
        requestId,
        name: 'create-production-lot',
      }
    );
  } catch (error) {
    if (error.code === '23505') {
      throw conflict('Production lot or serial number already exists');
    }

    throw error;
  }

  console.info('[PRODUCTION_LOTS][CREATE][SUCCESS]', {
    requestId,
    lotId: result.lot.id,
    serialCount: result.serials.length,
  });

  return result;
}

async function updateProductionLot({ id, payload, requestId }) {
  console.info('[PRODUCTION_LOTS][UPDATE]', { requestId, id });

  const existing = await repository.findLotById(id);

  if (!existing) {
    throw notFound('Production lot not found');
  }

  const lot = await repository.updateLot(id, payload);

  return {
    ...lot,
    ecn_refs: await repository.findLotEcnRefs(id),
  };
}

async function getProductionLotSerials({ id, requestId }) {
  console.info('[PRODUCTION_LOTS][SERIALS]', { requestId, id });

  const lot = await repository.findLotById(id);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  return repository.findSerialsByLotId(id);
}

async function replaceLotEcnRefs({ id, ecnIds, requestId }) {
  console.info('[PRODUCTION_LOTS][ECN][REPLACE]', { requestId, id });

  const lot = await repository.findLotById(id);

  if (!lot) {
    throw notFound('Production lot not found');
  }

  const uniqueEcnIds = await assertEcnIdsExist(ecnIds);

  await withTransaction(
    async (client) => {
      await repository.deleteLotEcnRefs(id, client);
      await repository.insertLotEcnRefs(id, uniqueEcnIds, client);
    },
    {
      requestId,
      name: 'replace-lot-ecn',
    }
  );

  return repository.findLotEcnRefs(id);
}

async function listCurrentLots({ filters, requestId }) {
  console.info('[PRODUCTION_LOTS][CURRENT_LOTS]', { requestId, filters });

  return repository.findCurrentLots(filters);
}

module.exports = {
  listProductionLots,
  getProductionLot,
  generateSerialPreview,
  createProductionLot,
  updateProductionLot,
  getProductionLotSerials,
  replaceLotEcnRefs,
  listCurrentLots,
};
