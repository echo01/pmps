import { authApi } from './authApi.js';
import { clearToken, getToken } from './httpClient.js';
import { reportsApi } from './reportsApi.js';
import { exportCsv } from './exportCsv.js';
import { formatDate } from './formatDate.js';

const app = document.querySelector('#app');
const state = {
  route: parseRoute(),
  activeTab: 'lots',
  filters: {
    search: '',
    model_code: '',
    lot_number: '',
    serial_number: '',
    status: '',
    result: '',
    date_from: '',
    date_to: '',
    page: 1,
    page_size: 20,
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/dashboard';
  const [path] = hash.split('?');
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'reports' && parts[1] && parts[2]) {
    return {
      name: `${parts[1]}Detail`,
      id: parts[2],
      path,
    };
  }

  if (parts[0] === 'reports') {
    return { name: 'reports', path };
  }

  if (parts[0] === 'dashboard' || path === '/') {
    return { name: 'dashboard', path };
  }

  return { name: 'notFound', path };
}

function navigate(path) {
  window.location.hash = path;
}

function shell(content) {
  const hasToken = Boolean(getToken());

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">PM</span>
          <div>
            <strong>PMPS</strong>
            <span>Reports Console</span>
          </div>
        </div>
        <nav class="nav">
          <button class="${state.route.name === 'dashboard' ? 'active' : ''}" data-route="/dashboard">Dashboard</button>
          <button class="${state.route.name === 'reports' ? 'active' : ''}" data-route="/reports">Reports</button>
        </nav>
        <div class="token-state ${hasToken ? 'ok' : 'warn'}">
          ${hasToken ? 'Token ready' : 'No token'}
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <form id="login-form" class="login-form">
            <input id="login-username" value="admin" aria-label="Username" />
            <input id="login-password" value="Admin@123" type="password" aria-label="Password" />
            <button type="submit">Login</button>
            <button type="button" id="logout-button">Clear Token</button>
          </form>
        </header>
        ${content}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.route));
  });

  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.querySelector('#login-username').value;
    const password = document.querySelector('#login-password').value;

    try {
      console.log('[AUTH][LOGIN][START]', { username });
      await authApi.login({ username, password });
      console.log('[AUTH][LOGIN][SUCCESS]');
      render();
    } catch (error) {
      console.error('[AUTH][LOGIN][ERROR]', error);
      showToast(error.message || 'Login failed');
    }
  });

  document.querySelector('#logout-button').addEventListener('click', () => {
    clearToken();
    render();
  });
}

function stateView(message) {
  return `<main class="page"><div class="state-box">${escapeHtml(message)}</div></main>`;
}

function errorView(message, retryAction) {
  return `
    <main class="page">
      <div class="state-box error">
        <strong>${escapeHtml(message)}</strong>
        ${retryAction ? '<button id="retry-button">Retry</button>' : ''}
      </div>
    </main>
  `;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function metricCard(label, value, accent = '') {
  return `
    <article class="metric ${accent}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? 0)}</strong>
    </article>
  `;
}

function barList(rows, labelKey, valueKey) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  if (!rows.length) {
    return '<div class="empty-inline">No chart data</div>';
  }

  return `
    <div class="bar-list">
      ${rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const width = Math.max((value / max) * 100, 4);
        return `
          <div class="bar-row">
            <span>${escapeHtml(row[labelKey] || 'N/A')}</span>
            <div class="bar-track"><div style="width:${width}%"></div></div>
            <strong>${value}</strong>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderDashboard() {
  shell(stateView('Loading dashboard...'));
  console.log('[DASHBOARD][LOAD][START]');

  try {
    const [summaryRes, qcRes, qaRes, lotStatusRes] = await Promise.all([
      reportsApi.getDashboardSummary(),
      reportsApi.getQcSummary({ date_from: '2026-06-01', date_to: '2026-12-31' }),
      reportsApi.getQaSummary({ date_from: '2026-06-01', date_to: '2026-12-31' }),
      reportsApi.getLotStatus(),
    ]);
    const summary = summaryRes.data;
    const qc = qcRes.data;
    const qa = qaRes.data;
    const lotStatus = lotStatusRes.data;

    console.log('[DASHBOARD][LOAD][SUCCESS]', { summary, qc, qa, lotStatus });

    shell(`
      <main class="page">
        <div class="page-header">
          <div>
            <p class="eyebrow">Live overview</p>
            <h1>Production Dashboard</h1>
          </div>
          <button id="refresh-dashboard">Refresh</button>
        </div>

        <section class="metrics-grid">
          ${metricCard('Total Lots', summary.production.total_lots, 'blue')}
          ${metricCard('Open Lots', summary.production.open_lots, 'green')}
          ${metricCard('Total Units', summary.production.total_units, 'violet')}
          ${metricCard('QC Inspections', summary.qc.total_inspections, 'amber')}
          ${metricCard('QA Samplings', summary.qa.total_samplings, 'rose')}
        </section>

        <section class="panel-grid">
          <article class="panel">
            <div class="panel-heading">
              <h2>Lot Status</h2>
              <span>${lotStatus.length} groups</span>
            </div>
            ${barList(lotStatus, 'status', 'count')}
          </article>
          <article class="panel">
            <div class="panel-heading">
              <h2>QC Results</h2>
              <span>${qc.by_result.length} groups</span>
            </div>
            ${barList(qc.by_result, 'overall_result', 'count')}
          </article>
          <article class="panel">
            <div class="panel-heading">
              <h2>QA Results</h2>
              <span>${qa.by_result.length} groups</span>
            </div>
            ${barList(qa.by_result, 'overall_result', 'count')}
          </article>
          <article class="panel wide">
            <div class="panel-heading">
              <h2>QC By Model</h2>
              <span>${qc.by_model.length} models</span>
            </div>
            ${barList(qc.by_model, 'model_code', 'total')}
          </article>
          <article class="panel wide">
            <div class="panel-heading">
              <h2>QA By Model</h2>
              <span>${qa.by_model.length} models</span>
            </div>
            ${barList(qa.by_model, 'model_code', 'total')}
          </article>
        </section>
      </main>
    `);

    document.querySelector('#refresh-dashboard').addEventListener('click', renderDashboard);
  } catch (error) {
    console.error('[DASHBOARD][LOAD][ERROR]', error);
    shell(errorView(formatApiError(error), true));
    document.querySelector('#retry-button')?.addEventListener('click', renderDashboard);
  }
}

function formatApiError(error) {
  if (error.status === 401) {
    return 'Unauthorized. Please login again.';
  }

  if (error.status === 403) {
    return 'Permission denied. SearchReport permission is required.';
  }

  return error.message || 'Request failed';
}

function filtersMarkup() {
  const f = state.filters;

  return `
    <section class="filters">
      <input id="filter-search" placeholder="Search" value="${escapeHtml(f.search)}" />
      <input id="filter-model-code" placeholder="Model code" value="${escapeHtml(f.model_code)}" />
      <input id="filter-lot-number" placeholder="Lot number" value="${escapeHtml(f.lot_number)}" />
      <input id="filter-serial-number" placeholder="Serial number" value="${escapeHtml(f.serial_number)}" />
      <select id="filter-status">
        ${['', 'OPEN', 'DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED', 'CLOSED', 'HOLD'].map((value) => (
          `<option value="${value}" ${f.status === value ? 'selected' : ''}>${value || 'All status'}</option>`
        )).join('')}
      </select>
      <select id="filter-result">
        ${['', 'PASS', 'FAIL', 'N/A'].map((value) => (
          `<option value="${value}" ${f.result === value ? 'selected' : ''}>${value || 'All result'}</option>`
        )).join('')}
      </select>
      <input id="filter-date-from" type="date" value="${escapeHtml(f.date_from)}" />
      <input id="filter-date-to" type="date" value="${escapeHtml(f.date_to)}" />
      <button id="search-button">Search</button>
    </section>
  `;
}

function bindFilters() {
  const map = {
    search: '#filter-search',
    model_code: '#filter-model-code',
    lot_number: '#filter-lot-number',
    serial_number: '#filter-serial-number',
    status: '#filter-status',
    result: '#filter-result',
    date_from: '#filter-date-from',
    date_to: '#filter-date-to',
  };

  Object.entries(map).forEach(([key, selector]) => {
    document.querySelector(selector).addEventListener('input', (event) => {
      state.filters[key] = event.target.value;
      state.filters.page = 1;
    });
  });

  document.querySelector('#search-button').addEventListener('click', () => {
    state.filters.page = 1;
    renderReports();
  });
}

function rowLink(path, label) {
  return `<button class="link-button" data-route="${path}">${escapeHtml(label)}</button>`;
}

function tableForRows(tab, rows) {
  if (!rows.length) {
    return '<div class="state-box">No data found</div>';
  }

  if (tab === 'lots') {
    return `
      <table>
        <thead><tr><th>Lot</th><th>Model</th><th>Qty</th><th>Serials</th><th>QC</th><th>QA</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${rowLink(`/reports/lots/${row.lot_id}`, row.lot_number)}</td>
              <td>${escapeHtml(row.model_code)}</td>
              <td>${escapeHtml(row.lot_qty)}</td>
              <td>${escapeHtml(row.serial_count)}</td>
              <td>${escapeHtml(row.qc_count)}</td>
              <td>${escapeHtml(row.qa_sampling_count)}</td>
              <td><span class="pill">${escapeHtml(row.lot_status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (tab === 'serials') {
    return `
      <table>
        <thead><tr><th>Serial</th><th>Lot</th><th>Model</th><th>QC Status</th><th>QC Result</th><th>QA Status</th><th>QA Result</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${rowLink(`/reports/serials/${row.product_unit_id}`, row.serial_number)}</td>
              <td>${escapeHtml(row.lot_number)}</td>
              <td>${escapeHtml(row.model_code)}</td>
              <td>${escapeHtml(row.latest_qc_status || '-')}</td>
              <td>${escapeHtml(row.latest_qc_result || '-')}</td>
              <td>${escapeHtml(row.latest_qa_status || '-')}</td>
              <td>${escapeHtml(row.latest_qa_result || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (tab === 'qc') {
    return `
      <table>
        <thead><tr><th>ID</th><th>Serial</th><th>Lot</th><th>Model</th><th>Status</th><th>Result</th><th>Template</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${rowLink(`/reports/qc-inspections/${row.inspection_id}`, row.inspection_id)}</td>
              <td>${escapeHtml(row.serial_number)}</td>
              <td>${escapeHtml(row.lot_number)}</td>
              <td>${escapeHtml(row.model_code)}</td>
              <td><span class="pill">${escapeHtml(row.status)}</span></td>
              <td>${escapeHtml(row.overall_result)}</td>
              <td>${escapeHtml(row.template_name)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <table>
      <thead><tr><th>ID</th><th>Lot</th><th>Model</th><th>Status</th><th>Result</th><th>Sample Qty</th><th>Template</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${rowLink(`/reports/qa-samplings/${row.qa_sampling_id}`, row.qa_sampling_id)}</td>
            <td>${escapeHtml(row.lot_number)}</td>
            <td>${escapeHtml(row.model_code)}</td>
            <td><span class="pill">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.overall_result)}</td>
            <td>${escapeHtml(row.sample_qty)}</td>
            <td>${escapeHtml(row.template_name)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function fetchReports() {
  if (state.activeTab === 'lots') {
    return reportsApi.searchLots(state.filters);
  }

  if (state.activeTab === 'serials') {
    return reportsApi.searchSerials(state.filters);
  }

  if (state.activeTab === 'qc') {
    return reportsApi.searchQcInspections(state.filters);
  }

  return reportsApi.searchQaSamplings(state.filters);
}

async function renderReports() {
  shell(`
    <main class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Search layer</p>
          <h1>Reports</h1>
        </div>
      </div>
      ${filtersMarkup()}
      <div class="state-box">Loading reports...</div>
    </main>
  `);
  bindFilters();
  console.log('[REPORTS][SEARCH][START]', { activeTab: state.activeTab, filters: state.filters });

  try {
    const response = await fetchReports();
    const rows = response.data || [];
    const pagination = response.meta?.pagination || {
      page: 1,
      total_pages: 1,
      total: rows.length,
      page_size: state.filters.page_size,
    };

    console.log('[REPORTS][SEARCH][SUCCESS]', {
      activeTab: state.activeTab,
      count: rows.length,
      pagination,
    });

    shell(`
      <main class="page">
        <div class="page-header">
          <div>
            <p class="eyebrow">Search layer</p>
            <h1>Reports</h1>
          </div>
          <div class="actions">
            <button id="export-qc-button">Export QC CSV</button>
            <button id="export-qa-button">Export QA CSV</button>
          </div>
        </div>
        <div class="tabs">
          ${[
            ['lots', 'Lots'],
            ['serials', 'Serials'],
            ['qc', 'QC Inspections'],
            ['qa', 'QA Samplings'],
          ].map(([key, label]) => `
            <button class="${state.activeTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>
          `).join('')}
        </div>
        ${filtersMarkup()}
        <section class="table-card">
          ${tableForRows(state.activeTab, rows)}
        </section>
        <div class="pagination">
          <button id="prev-page" ${pagination.page <= 1 ? 'disabled' : ''}>Previous</button>
          <span>Page ${pagination.page} / ${Math.max(pagination.total_pages, 1)} (${pagination.total} rows)</span>
          <button id="next-page" ${pagination.page >= pagination.total_pages ? 'disabled' : ''}>Next</button>
        </div>
      </main>
    `);
    bindReportActions(pagination);
  } catch (error) {
    console.error('[REPORTS][SEARCH][ERROR]', error);
    shell(`
      <main class="page">
        <div class="page-header">
          <div>
            <p class="eyebrow">Search layer</p>
            <h1>Reports</h1>
          </div>
        </div>
        ${filtersMarkup()}
        <div class="state-box error">${escapeHtml(formatApiError(error))}</div>
      </main>
    `);
    bindFilters();
  }
}

function bindReportActions(pagination) {
  bindFilters();

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab;
      state.filters.page = 1;
      renderReports();
    });
  });

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.route));
  });

  document.querySelector('#prev-page').addEventListener('click', () => {
    state.filters.page = Math.max(Number(pagination.page) - 1, 1);
    renderReports();
  });

  document.querySelector('#next-page').addEventListener('click', () => {
    state.filters.page = Number(pagination.page) + 1;
    renderReports();
  });

  document.querySelector('#export-qc-button').addEventListener('click', async () => {
    const response = await reportsApi.exportQcInspections(state.filters);
    console.log('[REPORTS][EXPORT][QC]', response.data);
    exportCsv('qc-inspections.csv', response.data || []);
  });

  document.querySelector('#export-qa-button').addEventListener('click', async () => {
    const response = await reportsApi.exportQaSamplings(state.filters);
    console.log('[REPORTS][EXPORT][QA]', response.data);
    exportCsv('qa-samplings.csv', response.data || []);
  });
}

function detailHeader(title, subtitle) {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">${escapeHtml(subtitle)}</p>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <button data-route="/reports">Back to Reports</button>
    </div>
  `;
}

function simpleTable(rows, columns) {
  if (!rows.length) {
    return '<div class="state-box">No data found</div>';
  }

  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${columns.map((column) => `<td>${escapeHtml(column.format ? column.format(row[column.key], row) : row[column.key])}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderDetail(kind, id) {
  shell(stateView('Loading detail...'));

  try {
    let response;
    if (kind === 'lotsDetail') response = await reportsApi.getLotDetail(id);
    if (kind === 'serialsDetail') response = await reportsApi.getSerialDetail(id);
    if (kind === 'qc-inspectionsDetail') response = await reportsApi.getQcInspectionDetail(id);
    if (kind === 'qa-samplingsDetail') response = await reportsApi.getQaSamplingDetail(id);

    const data = response.data;
    let content = '';

    if (kind === 'lotsDetail') {
      content = renderLotDetail(data);
    } else if (kind === 'serialsDetail') {
      content = renderSerialDetail(data);
    } else if (kind === 'qc-inspectionsDetail') {
      content = renderQcDetail(data);
    } else {
      content = renderQaDetail(data);
    }

    shell(content);
    document.querySelectorAll('[data-route]').forEach((button) => {
      button.addEventListener('click', () => navigate(button.dataset.route));
    });
  } catch (error) {
    shell(errorView(formatApiError(error), false));
  }
}

function keyValueGrid(items) {
  return `
    <div class="kv-grid">
      ${items.map(([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value ?? '-')}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLotDetail(data) {
  const lot = data.lot;
  return `
    <main class="page">
      ${detailHeader(lot.lot_number, 'Lot detail report')}
      <section class="panel">${keyValueGrid([
        ['Model', lot.model_code],
        ['Product', lot.product_name],
        ['Quantity', lot.lot_qty],
        ['Status', lot.lot_status],
        ['Production Date', formatDate(lot.production_date)],
      ])}</section>
      <section class="panel-grid">
        <article class="panel">${keyValueGrid([
          ['QC Total', data.qc_summary.total],
          ['QC PASS', data.qc_summary.pass],
          ['QC FAIL', data.qc_summary.fail],
          ['QC Approved', data.qc_summary.approved],
        ])}</article>
        <article class="panel">${keyValueGrid([
          ['QA Total', data.qa_summary.total],
          ['QA PASS', data.qa_summary.pass],
          ['QA FAIL', data.qa_summary.fail],
          ['QA Approved', data.qa_summary.approved],
        ])}</article>
      </section>
      <section class="table-card">
        <h2>Serials</h2>
        ${simpleTable(data.serials, [
          { key: 'serial_number', label: 'Serial' },
          { key: 'unit_status', label: 'Status' },
          { key: 'latest_qc_result', label: 'QC Result' },
          { key: 'latest_qa_result', label: 'QA Result' },
        ])}
      </section>
    </main>
  `;
}

function renderSerialDetail(data) {
  return `
    <main class="page">
      ${detailHeader(data.serial_number, 'Serial detail report')}
      <section class="panel">${keyValueGrid([
        ['Lot', data.lot_number],
        ['Model', data.model_code],
        ['Product', data.product_name],
        ['Unit Status', data.unit_status],
      ])}</section>
      <section class="table-card">
        <h2>QC Inspection History</h2>
        ${simpleTable(data.qc_inspections, [
          { key: 'inspection_id', label: 'ID' },
          { key: 'inspection_no', label: 'No' },
          { key: 'status', label: 'Status' },
          { key: 'overall_result', label: 'Result' },
          { key: 'inspection_datetime', label: 'Date', format: formatDate },
        ])}
      </section>
      <section class="table-card">
        <h2>QA Sampling History</h2>
        ${simpleTable(data.qa_samplings, [
          { key: 'qa_sampling_id', label: 'ID' },
          { key: 'sampling_no', label: 'No' },
          { key: 'status', label: 'Status' },
          { key: 'overall_result', label: 'Result' },
          { key: 'unit_result', label: 'Unit Result' },
        ])}
      </section>
    </main>
  `;
}

function renderQcDetail(data) {
  return `
    <main class="page">
      ${detailHeader(`QC Inspection #${data.inspection_id}`, 'QC detail report')}
      <section class="panel">${keyValueGrid([
        ['Serial', data.serial_number],
        ['Lot', data.lot_number],
        ['Model', data.model_code],
        ['Status', data.status],
        ['Result', data.overall_result],
        ['Template', data.template_name],
      ])}</section>
      <section class="table-card">
        <h2>Details</h2>
        ${simpleTable(data.details, [
          { key: 'item_code', label: 'Item' },
          { key: 'item_name', label: 'Name' },
          { key: 'measured_value', label: 'Measured Value' },
          { key: 'measured_text', label: 'Measured Text' },
          { key: 'result', label: 'Result' },
        ])}
      </section>
      <section class="table-card">
        <h2>Equipment</h2>
        ${simpleTable(data.equipment, [
          { key: 'equipment_code', label: 'Code' },
          { key: 'equipment_name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'calibration_due_date', label: 'Calibration Due', format: formatDate },
        ])}
      </section>
      <section class="table-card">
        <h2>Approval Logs</h2>
        ${simpleTable(data.approval_logs, [
          { key: 'action', label: 'Action' },
          { key: 'old_status', label: 'Old' },
          { key: 'new_status', label: 'New' },
          { key: 'action_by_username', label: 'By' },
          { key: 'action_datetime', label: 'Date', format: formatDate },
        ])}
      </section>
    </main>
  `;
}

function renderQaDetail(data) {
  const detailRows = data.sample_units.flatMap((unit) => (
    (unit.details || []).map((detail) => ({
      serial_number: unit.serial_number,
      item_code: detail.item_code,
      item_name: detail.item_name,
      measured_value: detail.measured_value,
      measured_text: detail.measured_text,
      result: detail.result,
    }))
  ));

  return `
    <main class="page">
      ${detailHeader(`QA Sampling #${data.qa_sampling_id}`, 'QA detail report')}
      <section class="panel">${keyValueGrid([
        ['Lot', data.lot_number],
        ['Model', data.model_code],
        ['Status', data.status],
        ['Result', data.overall_result],
        ['Sample Qty', data.sample_qty],
        ['Template', data.template_name],
      ])}</section>
      <section class="table-card">
        <h2>Sample Units</h2>
        ${simpleTable(data.sample_units, [
          { key: 'sample_no', label: 'No' },
          { key: 'serial_number', label: 'Serial' },
          { key: 'unit_result', label: 'Result' },
          { key: 'remark', label: 'Remark' },
        ])}
      </section>
      <section class="table-card">
        <h2>Item Details</h2>
        ${simpleTable(detailRows, [
          { key: 'serial_number', label: 'Serial' },
          { key: 'item_code', label: 'Item' },
          { key: 'item_name', label: 'Name' },
          { key: 'measured_value', label: 'Measured Value' },
          { key: 'measured_text', label: 'Measured Text' },
          { key: 'result', label: 'Result' },
        ])}
      </section>
      <section class="table-card">
        <h2>Equipment</h2>
        ${simpleTable(data.equipment, [
          { key: 'equipment_code', label: 'Code' },
          { key: 'equipment_name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'calibration_due_date', label: 'Calibration Due', format: formatDate },
        ])}
      </section>
      <section class="table-card">
        <h2>Approval Logs</h2>
        ${simpleTable(data.approval_logs, [
          { key: 'action', label: 'Action' },
          { key: 'old_status', label: 'Old' },
          { key: 'new_status', label: 'New' },
          { key: 'action_by_username', label: 'By' },
          { key: 'action_datetime', label: 'Date', format: formatDate },
        ])}
      </section>
    </main>
  `;
}

function renderNotFound() {
  shell(`
    <main class="page">
      <div class="state-box error">
        <strong>Page not found</strong>
        <button data-route="/dashboard">Go to Dashboard</button>
      </div>
    </main>
  `);

  document.querySelector('[data-route]').addEventListener('click', () => navigate('/dashboard'));
}

function render() {
  state.route = parseRoute();

  if (state.route.name === 'dashboard') {
    renderDashboard();
    return;
  }

  if (state.route.name === 'reports') {
    renderReports();
    return;
  }

  if (state.route.name.endsWith('Detail')) {
    renderDetail(state.route.name, state.route.id);
    return;
  }

  renderNotFound();
}

window.addEventListener('hashchange', render);
render();
