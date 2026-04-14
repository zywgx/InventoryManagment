const state = {
  vehicles: [],
  activity: [],
  selectedVehicleId: null,
  filters: {
    search: "",
    make: "all",
    status: "all",
    bodyStyle: "all",
    ageBucket: "all",
    mileage: "all",
    price: "all"
  },
  loading: true,
  saving: false
};

const elements = {
  form: document.querySelector("#inventory-form"),
  resetForm: document.querySelector("#reset-form"),
  exportCsv: document.querySelector("#export-csv"),
  vehicleId: document.querySelector("#item-id"),
  year: document.querySelector("#item-year"),
  make: document.querySelector("#item-make"),
  model: document.querySelector("#item-model"),
  trim: document.querySelector("#item-trim"),
  bodyStyle: document.querySelector("#item-body-style"),
  color: document.querySelector("#item-color"),
  stockNumber: document.querySelector("#item-stock-number"),
  vin: document.querySelector("#item-vin"),
  mileage: document.querySelector("#item-mileage"),
  status: document.querySelector("#item-status"),
  lotSection: document.querySelector("#item-lot-section"),
  daysOnLot: document.querySelector("#item-days-on-lot"),
  acquisitionCost: document.querySelector("#item-acquisition-cost"),
  listPrice: document.querySelector("#item-list-price"),
  notes: document.querySelector("#item-notes"),
  searchInput: document.querySelector("#search-input"),
  makeFilter: document.querySelector("#category-filter"),
  statusFilter: document.querySelector("#status-filter"),
  bodyStyleFilter: document.querySelector("#body-style-filter"),
  ageFilter: document.querySelector("#age-filter"),
  priceFilter: document.querySelector("#price-filter"),
  mileageFilter: document.querySelector("#mileage-filter"),
  tableBody: document.querySelector("#inventory-table-body"),
  categoryBreakdown: document.querySelector("#category-breakdown"),
  alertList: document.querySelector("#alert-list"),
  activityLog: document.querySelector("#activity-log"),
  insightCards: document.querySelector("#insight-cards"),
  reorderList: document.querySelector("#reorder-list"),
  emptyStateTemplate: document.querySelector("#empty-state-template"),
  heroHealthLabel: document.querySelector("#hero-health-label"),
  heroRiskCount: document.querySelector("#hero-risk-count"),
  heroCategoryCount: document.querySelector("#hero-category-count"),
  metricTotalVehicles: document.querySelector("#metric-total-items"),
  metricFrontlineReady: document.querySelector("#metric-total-units"),
  metricRecon: document.querySelector("#metric-low-stock"),
  metricAging: document.querySelector("#metric-out-stock"),
  syncStatus: document.querySelector("#sync-status"),
  formStatus: document.querySelector("#form-status"),
  drawer: document.querySelector("#vehicle-drawer"),
  drawerContent: document.querySelector("#drawer-content")
};

function vehicleLabel(vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
}

function getStatusTone(status) {
  if (status === "available") return "healthy";
  if (status === "recon") return "low";
  return "out";
}

function getStatusLabel(status) {
  if (status === "available") return "Available";
  if (status === "recon") return "In Recon";
  return "Hold";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setSyncStatus(message, tone = "") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.tone = tone;
}

function setFormStatus(message = "", tone = "") {
  elements.formStatus.textContent = message;
  elements.formStatus.dataset.tone = tone;
}

function setSavingState(isSaving) {
  state.saving = isSaving;
  const saveButton = elements.form.querySelector('button[type="submit"]');
  saveButton.disabled = isSaving;
  saveButton.textContent = isSaving ? "Saving..." : "Save Vehicle";
}

function getAgeBucket(days) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  return "61+";
}

function matchesRange(value, bucket) {
  if (bucket === "all") return true;
  if (bucket.endsWith("+")) {
    return value >= Number(bucket.replace("+", ""));
  }
  const [min, max] = bucket.split("-").map(Number);
  return value >= min && value <= max;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function loadData() {
  state.loading = true;
  setSyncStatus("Loading live dealership inventory...");
  render();

  try {
    const [vehiclesPayload, activityPayload] = await Promise.all([
      requestJson("/api/vehicles"),
      requestJson("/api/activity")
    ]);
    state.vehicles = vehiclesPayload.vehicles;
    state.activity = activityPayload.activity;
    setSyncStatus("Connected to live dealership inventory.", "success");
  } catch (error) {
    state.vehicles = [];
    state.activity = [];
    setSyncStatus(error.message || "Dealership service unavailable.", "error");
  } finally {
    state.loading = false;
    render();
  }
}

function getFilteredVehicles() {
  return state.vehicles.filter((vehicle) => {
    const haystack = [
      vehicle.stockNumber,
      vehicle.vin,
      vehicle.make,
      vehicle.model,
      vehicle.trim,
      vehicle.bodyStyle,
      vehicle.notes
    ].join(" ").toLowerCase();

    const matchesSearch = haystack.includes(state.filters.search.toLowerCase());
    const matchesMake = state.filters.make === "all" || vehicle.make === state.filters.make;
    const matchesStatus = state.filters.status === "all" || vehicle.status === state.filters.status;
    const matchesBodyStyle = state.filters.bodyStyle === "all" || vehicle.bodyStyle === state.filters.bodyStyle;
    const matchesAge = state.filters.ageBucket === "all" || getAgeBucket(vehicle.daysOnLot) === state.filters.ageBucket;
    const matchesPrice = matchesRange(vehicle.listPrice, state.filters.price);
    const matchesMileage = matchesRange(vehicle.mileage, state.filters.mileage);

    return matchesSearch && matchesMake && matchesStatus && matchesBodyStyle && matchesAge && matchesPrice && matchesMileage;
  });
}

function getBusinessMetrics() {
  const lotValue = state.vehicles.reduce((sum, vehicle) => sum + vehicle.listPrice, 0);
  const grossPotential = state.vehicles.reduce((sum, vehicle) => sum + (vehicle.listPrice - vehicle.acquisitionCost), 0);
  const averageDays = state.vehicles.length
    ? Math.round(state.vehicles.reduce((sum, vehicle) => sum + vehicle.daysOnLot, 0) / state.vehicles.length)
    : 0;
  const averageMiles = state.vehicles.length
    ? Math.round(state.vehicles.reduce((sum, vehicle) => sum + vehicle.mileage, 0) / state.vehicles.length)
    : 0;

  return { lotValue, grossPotential, averageDays, averageMiles };
}

function getPriorityVehicles() {
  return [...state.vehicles]
    .filter((vehicle) => vehicle.daysOnLot >= 45 || vehicle.status === "recon")
    .sort((a, b) => b.daysOnLot - a.daysOnLot)
    .slice(0, 4);
}

function getVehicleById(vehicleId) {
  return state.vehicles.find((vehicle) => vehicle.id === vehicleId) || null;
}

function openDrawer(vehicleId) {
  state.selectedVehicleId = vehicleId;
  renderDrawer();
  elements.drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  state.selectedVehicleId = null;
  elements.drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
}

function renderDrawer() {
  const vehicle = getVehicleById(state.selectedVehicleId);
  if (!vehicle) {
    elements.drawerContent.innerHTML = "";
    return;
  }

  const gross = vehicle.listPrice - vehicle.acquisitionCost;
  const recentEvents = state.activity.filter((entry) => entry.vehicleId === vehicle.id).slice(0, 4);

  elements.drawerContent.innerHTML = `
    <div class="drawer-header">
      <p class="section-kicker">Vehicle Detail</p>
      <h2>${escapeHtml(vehicleLabel(vehicle))}</h2>
      <p class="drawer-copy">${escapeHtml(vehicle.bodyStyle)} in ${escapeHtml(vehicle.color || "Unassigned color")} parked at ${escapeHtml(vehicle.lotSection || "unassigned lot section")}.</p>
    </div>
    <div class="drawer-grid">
      <article class="drawer-card">
        <span>Stock Number</span>
        <strong>${escapeHtml(vehicle.stockNumber)}</strong>
      </article>
      <article class="drawer-card">
        <span>VIN</span>
        <strong>${escapeHtml(vehicle.vin)}</strong>
      </article>
      <article class="drawer-card">
        <span>Status</span>
        <strong>${getStatusLabel(vehicle.status)}</strong>
      </article>
      <article class="drawer-card">
        <span>Days on Lot</span>
        <strong>${vehicle.daysOnLot}</strong>
      </article>
      <article class="drawer-card">
        <span>Mileage</span>
        <strong>${formatNumber(vehicle.mileage)}</strong>
      </article>
      <article class="drawer-card">
        <span>List Price</span>
        <strong>${formatCurrency(vehicle.listPrice)}</strong>
      </article>
      <article class="drawer-card">
        <span>Acquisition</span>
        <strong>${formatCurrency(vehicle.acquisitionCost)}</strong>
      </article>
      <article class="drawer-card">
        <span>Gross Potential</span>
        <strong>${formatCurrency(gross)}</strong>
      </article>
    </div>
    <div class="drawer-section">
      <p class="section-kicker">Desk Notes</p>
      <p class="drawer-note">${escapeHtml(vehicle.notes || "No desk notes yet.")}</p>
    </div>
    <div class="drawer-section">
      <p class="section-kicker">Recent Activity</p>
      <div class="drawer-activity">
        ${recentEvents.length ? recentEvents.map((entry) => `
          <article class="activity-entry">
            <div class="activity-head">
              <p class="activity-title">${escapeHtml(entry.type.replaceAll("-", " "))}</p>
              <strong>${formatDate(entry.createdAt)}</strong>
            </div>
            <p class="activity-meta">${escapeHtml(entry.message)}</p>
          </article>
        `).join("") : `<div class="empty-state"><h3>No vehicle activity yet</h3><p>Updates for this unit will appear here.</p></div>`}
      </div>
    </div>
  `;
}

function renderSummary() {
  const ready = state.vehicles.filter((vehicle) => vehicle.status === "available").length;
  const recon = state.vehicles.filter((vehicle) => vehicle.status === "recon").length;
  const aging = state.vehicles.filter((vehicle) => vehicle.daysOnLot >= 60).length;
  const brands = new Set(state.vehicles.map((vehicle) => vehicle.make)).size;

  elements.metricTotalVehicles.textContent = state.vehicles.length;
  elements.metricFrontlineReady.textContent = ready;
  elements.metricRecon.textContent = recon;
  elements.metricAging.textContent = aging;
  elements.heroRiskCount.textContent = aging;
  elements.heroCategoryCount.textContent = brands;
  elements.heroHealthLabel.textContent = aging === 0 ? "Stable" : aging <= 2 ? "Watch Aging" : "Desk Needed";
}

function renderMakeBreakdown() {
  const totals = state.vehicles.reduce((map, vehicle) => {
    map[vehicle.make] = (map[vehicle.make] || 0) + 1;
    return map;
  }, {});
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;

  if (entries.length === 0) {
    elements.categoryBreakdown.innerHTML = `<div class="empty-state"><h3>No brand mix yet</h3><p>Add vehicles to build the makeup of the lot.</p></div>`;
    return;
  }

  elements.categoryBreakdown.innerHTML = entries
    .map(([make, count]) => `
      <article class="stacked-row">
        <div class="stacked-row-header">
          <strong>${escapeHtml(make)}</strong>
          <span>${count} units</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(count / max) * 100}%"></div>
        </div>
      </article>
    `)
    .join("");
}

function renderDeskPriorities() {
  const metrics = getBusinessMetrics();
  elements.insightCards.innerHTML = `
    <article class="metric-card compact">
      <span>Lot Value</span>
      <strong>${formatCurrency(metrics.lotValue)}</strong>
      <small>Combined advertised inventory value</small>
    </article>
    <article class="metric-card compact">
      <span>Gross Potential</span>
      <strong>${formatCurrency(metrics.grossPotential)}</strong>
      <small>Spread between cost and list</small>
    </article>
    <article class="metric-card compact">
      <span>Avg Days on Lot</span>
      <strong>${metrics.averageDays}</strong>
      <small>Average vehicle aging pace</small>
    </article>
    <article class="metric-card compact">
      <span>Avg Mileage</span>
      <strong>${formatNumber(metrics.averageMiles)}</strong>
      <small>Average miles across inventory</small>
    </article>
  `;

  const priorities = getPriorityVehicles();
  if (priorities.length === 0) {
    elements.reorderList.innerHTML = `<div class="empty-state"><h3>No pressing desk items</h3><p>The lot looks balanced right now.</p></div>`;
    return;
  }

  elements.reorderList.innerHTML = priorities
    .map((vehicle) => `
      <article class="alert-card ${getStatusTone(vehicle.status)}">
        <p class="alert-title">${escapeHtml(vehicleLabel(vehicle))}</p>
        <p class="alert-meta">${vehicle.daysOnLot} days | ${getStatusLabel(vehicle.status)} | ${vehicle.status === "recon" ? "Push recon and photography." : "Review pricing and merchandising."}</p>
      </article>
    `)
    .join("");
}

function renderRiskWatch() {
  const risky = [...state.vehicles]
    .filter((vehicle) => vehicle.daysOnLot >= 45 || vehicle.status !== "available")
    .sort((a, b) => b.daysOnLot - a.daysOnLot)
    .slice(0, 5);

  if (risky.length === 0) {
    elements.alertList.innerHTML = `<div class="empty-state"><h3>No major lot risk</h3><p>Units are turning and frontline readiness looks healthy.</p></div>`;
    return;
  }

  elements.alertList.innerHTML = risky
    .map((vehicle) => `
      <article class="alert-card ${getStatusTone(vehicle.status)}">
        <p class="alert-title">${escapeHtml(vehicleLabel(vehicle))} <span class="status-pill status-${getStatusTone(vehicle.status)}">${getStatusLabel(vehicle.status)}</span></p>
        <p class="alert-meta">${vehicle.daysOnLot} days | ${formatNumber(vehicle.mileage)} miles | ${escapeHtml(vehicle.lotSection || "No lot section assigned")}</p>
      </article>
    `)
    .join("");
}

function renderActivity() {
  const recent = state.activity.slice(0, 8);
  if (recent.length === 0) {
    elements.activityLog.innerHTML = `<div class="empty-state"><h3>No recent dealership activity</h3><p>Status changes and vehicle edits will show up here.</p></div>`;
    return;
  }

  elements.activityLog.innerHTML = recent
    .map((entry) => `
      <article class="activity-entry">
        <div class="activity-head">
          <p class="activity-title">${escapeHtml(entry.vehicleLabel)}</p>
          <strong>${formatDate(entry.createdAt)}</strong>
        </div>
        <p class="activity-meta">${escapeHtml(entry.message)}</p>
      </article>
    `)
    .join("");
}

function populateSelect(select, values, placeholder, activeValue) {
  select.innerHTML = [
    `<option value="all">${placeholder}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
  ].join("");
  select.value = values.includes(activeValue) ? activeValue : "all";
}

function renderFilters() {
  const makes = [...new Set(state.vehicles.map((vehicle) => vehicle.make))].sort((a, b) => a.localeCompare(b));
  const bodyStyles = [...new Set(state.vehicles.map((vehicle) => vehicle.bodyStyle))].sort((a, b) => a.localeCompare(b));
  populateSelect(elements.makeFilter, makes, "All Makes", state.filters.make);
  populateSelect(elements.bodyStyleFilter, bodyStyles, "All Body Styles", state.filters.bodyStyle);
}

function renderTable() {
  const vehicles = getFilteredVehicles();

  if (state.loading) {
    elements.tableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><h3>Loading lot inventory</h3><p>Pulling the latest vehicles from the dealership service.</p></div></td></tr>`;
    return;
  }

  if (vehicles.length === 0) {
    elements.tableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 9;
    cell.appendChild(elements.emptyStateTemplate.content.cloneNode(true));
    row.appendChild(cell);
    elements.tableBody.appendChild(row);
    return;
  }

  elements.tableBody.innerHTML = vehicles
    .sort((a, b) => a.daysOnLot - b.daysOnLot)
    .map((vehicle) => {
      const tone = getStatusTone(vehicle.status);
      const gross = vehicle.listPrice - vehicle.acquisitionCost;
      return `
        <tr>
          <td>
            <button type="button" class="vehicle-link" data-view="${vehicle.id}">
              <strong>${escapeHtml(vehicleLabel(vehicle))}</strong>
              <span>${escapeHtml(vehicle.bodyStyle)} | ${escapeHtml(vehicle.color || "Color not set")} | ${escapeHtml(vehicle.notes || "No desk notes")}</span>
            </button>
          </td>
          <td>
            <strong>${escapeHtml(vehicle.stockNumber)}</strong>
            <span class="vin-label">${escapeHtml(vehicle.vin)}</span>
          </td>
          <td><span class="status-pill status-${tone}">${getStatusLabel(vehicle.status)}</span></td>
          <td>${formatNumber(vehicle.mileage)}</td>
          <td>${vehicle.daysOnLot}</td>
          <td>${formatCurrency(vehicle.listPrice)}</td>
          <td>${formatCurrency(gross)}</td>
          <td>
            <div class="adjust-actions">
              <button type="button" data-status="available" data-id="${vehicle.id}">Frontline</button>
              <button type="button" data-status="recon" data-id="${vehicle.id}">Recon</button>
              <button type="button" data-status="hold" data-id="${vehicle.id}">Hold</button>
            </div>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" data-action="edit" data-id="${vehicle.id}">Edit</button>
              <button type="button" data-action="delete" data-id="${vehicle.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  renderSummary();
  renderMakeBreakdown();
  renderDeskPriorities();
  renderRiskWatch();
  renderActivity();
  renderFilters();
  renderTable();
  renderDrawer();
}

function resetForm() {
  elements.form.reset();
  elements.vehicleId.value = "";
  elements.status.value = "available";
  setFormStatus("");
}

function populateForm(vehicleId) {
  const vehicle = getVehicleById(vehicleId);
  if (!vehicle) return;

  elements.vehicleId.value = vehicle.id;
  elements.year.value = vehicle.year;
  elements.make.value = vehicle.make;
  elements.model.value = vehicle.model;
  elements.trim.value = vehicle.trim;
  elements.bodyStyle.value = vehicle.bodyStyle;
  elements.color.value = vehicle.color;
  elements.stockNumber.value = vehicle.stockNumber;
  elements.vin.value = vehicle.vin;
  elements.mileage.value = vehicle.mileage;
  elements.status.value = vehicle.status;
  elements.lotSection.value = vehicle.lotSection;
  elements.daysOnLot.value = vehicle.daysOnLot;
  elements.acquisitionCost.value = vehicle.acquisitionCost;
  elements.listPrice.value = vehicle.listPrice;
  elements.notes.value = vehicle.notes;
  setFormStatus(`Editing ${vehicleLabel(vehicle)}.`, "success");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveVehicle(formData) {
  const payload = {
    year: Number(formData.get("year")),
    make: formData.get("make").trim(),
    model: formData.get("model").trim(),
    trim: formData.get("trim").trim(),
    bodyStyle: formData.get("bodyStyle").trim(),
    color: formData.get("color").trim(),
    stockNumber: formData.get("stockNumber").trim().toUpperCase(),
    vin: formData.get("vin").trim().toUpperCase(),
    mileage: Number(formData.get("mileage")),
    status: formData.get("status"),
    lotSection: formData.get("lotSection").trim(),
    daysOnLot: Number(formData.get("daysOnLot")),
    acquisitionCost: Number(formData.get("acquisitionCost")),
    listPrice: Number(formData.get("listPrice")),
    notes: formData.get("notes").trim()
  };

  const vehicleId = elements.vehicleId.value;
  const url = vehicleId ? `/api/vehicles/${vehicleId}` : "/api/vehicles";
  const method = vehicleId ? "PUT" : "POST";
  await requestJson(url, {
    method,
    body: JSON.stringify(payload)
  });

  await loadData();
  resetForm();
  setFormStatus(vehicleId ? "Vehicle updated successfully." : "Vehicle added to inventory.", "success");
}

async function deleteVehicle(vehicleId) {
  try {
    await requestJson(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
    if (state.selectedVehicleId === vehicleId) {
      closeDrawer();
    }
    await loadData();
    setFormStatus("Vehicle removed from active inventory.", "success");
  } catch (error) {
    setFormStatus(error.message || "Unable to delete vehicle.", "error");
  }
}

async function updateVehicleStatus(vehicleId, status) {
  try {
    await requestJson(`/api/vehicles/${vehicleId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
    await loadData();
    if (state.selectedVehicleId === vehicleId) {
      openDrawer(vehicleId);
    }
    setFormStatus(`Vehicle moved to ${getStatusLabel(status)}.`, "success");
  } catch (error) {
    setFormStatus(error.message || "Unable to update lot status.", "error");
  }
}

function exportVehiclesToCsv() {
  const vehicles = getFilteredVehicles();
  const headers = [
    "Year", "Make", "Model", "Trim", "Body Style", "Stock Number", "VIN", "Mileage",
    "Status", "Lot Section", "Days On Lot", "Acquisition Cost", "List Price", "Gross Potential", "Notes"
  ];
  const rows = vehicles.map((vehicle) => [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.bodyStyle,
    vehicle.stockNumber,
    vehicle.vin,
    vehicle.mileage,
    getStatusLabel(vehicle.status),
    vehicle.lotSection,
    vehicle.daysOnLot,
    vehicle.acquisitionCost,
    vehicle.listPrice,
    vehicle.listPrice - vehicle.acquisitionCost,
    vehicle.notes
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dealership-inventory-report.csv";
  link.click();
  URL.revokeObjectURL(url);
  setFormStatus("CSV export generated for the current filtered view.", "success");
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSavingState(true);
  setFormStatus("");

  try {
    const formData = new FormData(elements.form);
    await saveVehicle(formData);
  } catch (error) {
    setFormStatus(error.message || "Unable to save vehicle.", "error");
  } finally {
    setSavingState(false);
  }
});

elements.resetForm.addEventListener("click", resetForm);
elements.exportCsv.addEventListener("click", exportVehiclesToCsv);

elements.searchInput.addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  renderTable();
});

elements.makeFilter.addEventListener("change", (event) => {
  state.filters.make = event.target.value;
  renderTable();
});

elements.statusFilter.addEventListener("change", (event) => {
  state.filters.status = event.target.value;
  renderTable();
});

elements.bodyStyleFilter.addEventListener("change", (event) => {
  state.filters.bodyStyle = event.target.value;
  renderTable();
});

elements.ageFilter.addEventListener("change", (event) => {
  state.filters.ageBucket = event.target.value;
  renderTable();
});

elements.priceFilter.addEventListener("change", (event) => {
  state.filters.price = event.target.value;
  renderTable();
});

elements.mileageFilter.addEventListener("change", (event) => {
  state.filters.mileage = event.target.value;
  renderTable();
});

elements.tableBody.addEventListener("click", (event) => {
  const viewButton = event.target.closest("button[data-view]");
  if (viewButton) {
    openDrawer(viewButton.dataset.view);
    return;
  }

  const statusButton = event.target.closest("button[data-status]");
  if (statusButton) {
    updateVehicleStatus(statusButton.dataset.id, statusButton.dataset.status);
    return;
  }

  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) return;
  if (actionButton.dataset.action === "edit") populateForm(actionButton.dataset.id);
  if (actionButton.dataset.action === "delete") deleteVehicle(actionButton.dataset.id);
});

elements.drawer.addEventListener("click", (event) => {
  if (event.target.closest("[data-drawer-close]")) {
    closeDrawer();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.drawer.getAttribute("aria-hidden") === "false") {
    closeDrawer();
  }
});

render();
loadData();
