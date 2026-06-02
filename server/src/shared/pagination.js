function parsePagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page || '1', 10), 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(query.page_size || '50', 10), 1),
    200
  );

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

function paginationMeta({ page, pageSize, total }) {
  return {
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
}

module.exports = {
  parsePagination,
  paginationMeta,
};
