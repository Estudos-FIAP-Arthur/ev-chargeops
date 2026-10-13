const period = "2026-06";

const state = {
  units: [],
  users: [],
  vehicles: [],
  sessions: [],
  invoices: [],
  insights: { anomalies: [], profiles: {} },
};

const elements = {
  apiUrl: document.querySelector("#api-url"),
  seedButton: document.querySelector("#seed-button"),
  refreshButton: document.querySelector("#refresh-button"),
  metricUnits: document.querySelector("#metric-units"),
  metricSessions: document.querySelector("#metric-sessions"),
  metricEnergy: document.querySelector("#metric-energy"),
  metricAnomalies: document.querySelector("#metric-anomalies"),
  invoices: document.querySelector("#invoices"),
  profiles: document.querySelector("#profiles"),
  sessions: document.querySelector("#sessions"),
  anomalies: document.querySelector("#anomalies"),
};

elements.seedButton.addEventListener("click", async () => {
  await request("/seed", { method: "POST" });
  await loadDashboard();
});

elements.refreshButton.addEventListener("click", loadDashboard);

loadDashboard().catch(showError);

async function loadDashboard() {
  const [units, sessions, invoices, insights] = await Promise.all([
    request("/units"),
    request("/sessions"),
    request(`/invoices/${period}`),
    request("/insights"),
  ]);

  state.units = units.units;
  state.users = units.users;
  state.vehicles = units.vehicles;
  state.sessions = sessions.sessions;
  state.invoices = invoices.invoices;
  state.insights = insights;

  render();
}

async function request(path, options = {}) {
  const response = await fetch(`${elements.apiUrl.value}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Falha na API ${path}: ${response.status}`);
  }
  return response.json();
}

function render() {
  const totalEnergy = state.invoices.reduce((sum, invoice) => sum + invoice.energy_kwh, 0);
  elements.metricUnits.textContent = state.units.length;
  elements.metricSessions.textContent = state.sessions.length;
  elements.metricEnergy.textContent = `${totalEnergy.toFixed(1)} kWh`;
  elements.metricAnomalies.textContent = state.insights.anomalies.length;

  renderInvoices();
  renderProfiles();
  renderSessions();
  renderAnomalies();
}

function renderInvoices() {
  elements.invoices.innerHTML = emptyIf(state.invoices);
  state.invoices.forEach((invoice) => {
    const unit = state.units.find((item) => item.id === invoice.unit_id);
    elements.invoices.insertAdjacentHTML(
      "beforeend",
      `<div class="row-card">
        <strong>${unit?.name ?? invoice.unit_id}</strong>
        <div class="inline">
          <span class="tag">${invoice.energy_kwh.toFixed(1)} kWh</span>
          <span class="tag">R$ ${invoice.total.toFixed(2)}</span>
          <span class="muted">${invoice.session_count} sessões</span>
        </div>
      </div>`
    );
  });
}

function renderProfiles() {
  const profiles = Object.entries(state.insights.profiles);
  elements.profiles.innerHTML = emptyIf(profiles);
  profiles.forEach(([, profile]) => {
    elements.profiles.insertAdjacentHTML(
      "beforeend",
      `<div class="row-card">
        <strong>${profile.name}</strong>
        <div class="inline">
          <span class="tag">${profile.profile}</span>
          <span class="muted">${profile.sessions} sessões</span>
          <span class="muted">${profile.average_kwh.toFixed(1)} kWh médios</span>
        </div>
      </div>`
    );
  });
}

function renderSessions() {
  elements.sessions.innerHTML = "";
  state.sessions.forEach((session) => {
    elements.sessions.insertAdjacentHTML(
      "beforeend",
      `<tr>
        <td>${formatDate(session.start)}</td>
        <td>${session.rfid_tag}</td>
        <td>${session.unit_id}</td>
        <td>${session.kwh_delivered.toFixed(1)}</td>
        <td><span class="tag ${session.status === "interrompida" ? "warn" : ""}">${session.status}</span></td>
      </tr>`
    );
  });
}

function renderAnomalies() {
  elements.anomalies.innerHTML = emptyIf(state.insights.anomalies);
  state.insights.anomalies.forEach((anomaly) => {
    elements.anomalies.insertAdjacentHTML(
      "beforeend",
      `<div class="row-card">
        <strong>${anomaly.session_id}</strong>
        <div class="inline">
          <span class="tag danger">${anomaly.severity}</span>
          <span class="muted">${anomaly.reason}</span>
        </div>
      </div>`
    );
  });
}

function emptyIf(items) {
  return items.length ? "" : '<p class="empty">Nenhum dado carregado.</p>';
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function showError(error) {
  elements.anomalies.innerHTML = `<p class="empty">${error.message}</p>`;
}
