const period = "2026-06";
const sessionKey = "ev-chargeops-session";

const state = {
  apiUrl: "http://localhost:8000",
  auth: null,
  units: [],
  users: [],
  vehicles: [],
  sessions: [],
  invoices: [],
  insights: { anomalies: [], profiles: {} },
};

const elements = {
  loginScreen: document.querySelector("#login-screen"),
  appScreen: document.querySelector("#app-screen"),
  loginForm: document.querySelector("#login-form"),
  loginError: document.querySelector("#login-error"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  apiUrl: document.querySelector("#api-url"),
  logoutButton: document.querySelector("#logout-button"),
  refreshButton: document.querySelector("#refresh-button"),
  operatorName: document.querySelector("#operator-name"),
  operatorRole: document.querySelector("#operator-role"),
  metricRevenue: document.querySelector("#metric-revenue"),
  metricEnergy: document.querySelector("#metric-energy"),
  metricSessions: document.querySelector("#metric-sessions"),
  metricAnomalies: document.querySelector("#metric-anomalies"),
  invoices: document.querySelector("#invoices"),
  profiles: document.querySelector("#profiles"),
  sessions: document.querySelector("#sessions"),
  anomalies: document.querySelector("#anomalies"),
};

bootstrap();

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginError.textContent = "";
  state.apiUrl = elements.apiUrl.value.trim();

  try {
    const auth = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: elements.email.value.trim(),
        password: elements.password.value,
      }),
    });
    state.auth = auth;
    localStorage.setItem(sessionKey, JSON.stringify({ ...auth, apiUrl: state.apiUrl }));
    showApp();
    await loadDashboard();
  } catch (error) {
    elements.loginError.textContent = "Credenciais inválidas ou API indisponível.";
  }
});

elements.logoutButton.addEventListener("click", () => {
  localStorage.removeItem(sessionKey);
  state.auth = null;
  elements.appScreen.classList.add("hidden");
  elements.loginScreen.classList.remove("hidden");
});

elements.refreshButton.addEventListener("click", loadDashboard);

async function bootstrap() {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored);
    state.apiUrl = parsed.apiUrl || state.apiUrl;
    state.auth = parsed;
    elements.apiUrl.value = state.apiUrl;
    showApp();
    await loadDashboard();
  } catch {
    localStorage.removeItem(sessionKey);
  }
}

function showApp() {
  elements.loginScreen.classList.add("hidden");
  elements.appScreen.classList.remove("hidden");
  elements.operatorName.textContent = state.auth.user.name;
  elements.operatorRole.textContent = state.auth.user.role === "manager" ? "Gestor" : "Morador";
}

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
  const headers = {
    "Content-Type": "application/json",
    ...(state.auth?.token ? { Authorization: `Bearer ${state.auth.token}` } : {}),
  };
  const response = await fetch(`${state.apiUrl}${path}`, { headers, ...options });
  if (!response.ok) {
    throw new Error(`Falha na API ${path}: ${response.status}`);
  }
  return response.json();
}

function render() {
  const totalEnergy = state.invoices.reduce((sum, invoice) => sum + invoice.energy_kwh, 0);
  const revenue = state.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  elements.metricRevenue.textContent = money(revenue);
  elements.metricEnergy.textContent = `${totalEnergy.toFixed(1)} kWh`;
  elements.metricSessions.textContent = state.sessions.length;
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
      `<div class="invoice-card">
        <div>
          <strong>${unit?.name ?? invoice.unit_id}</strong>
          <p>${invoice.session_count} sessões no ciclo</p>
        </div>
        <div class="invoice-values">
          <span>${invoice.energy_kwh.toFixed(1)} kWh</span>
          <strong>${money(invoice.total)}</strong>
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
      `<div class="profile-card">
        <span class="tag">${profile.profile}</span>
        <strong>${profile.name}</strong>
        <p>${profile.sessions} sessões · ${profile.average_kwh.toFixed(1)} kWh médios</p>
      </div>`
    );
  });
}

function renderSessions() {
  elements.sessions.innerHTML = "";
  state.sessions.forEach((session) => {
    const user = state.users.find((item) => item.id === session.user_id);
    const unit = state.units.find((item) => item.id === session.unit_id);
    elements.sessions.insertAdjacentHTML(
      "beforeend",
      `<tr>
        <td>${formatDate(session.start)}</td>
        <td>${session.rfid_tag}</td>
        <td>${user?.name ?? session.user_id}</td>
        <td>${unit?.name ?? session.unit_id}</td>
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
      `<div class="alert-card">
        <span class="tag danger">${anomaly.severity}</span>
        <div>
          <strong>${anomaly.session_id}</strong>
          <p>${anomaly.reason}</p>
        </div>
      </div>`
    );
  });
}

function emptyIf(items) {
  return items.length ? "" : '<p class="empty">Nenhum registro encontrado.</p>';
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
