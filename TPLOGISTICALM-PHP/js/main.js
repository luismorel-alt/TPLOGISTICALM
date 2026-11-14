const state = { vehicles: [], packages: [], trips: [], orders: [] };
const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
let toastTimer;

const app = {
  shell: document.querySelector('.app-shell'),
  notice: document.querySelector('#app-notice'),
  toast: document.querySelector('#toast'),
  today: document.querySelector('#today-label'),
  packageDialog: document.querySelector('#package-dialog'),
};

function escapeHTML(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => replacements[character]);
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha sin registrar' : dateFormat.format(date);
}

function todayISO() {
  return new Date().toISOString();
}

function notify(message, type = 'success') {
  window.clearTimeout(toastTimer);
  app.toast.textContent = message;
  app.toast.classList.toggle('is-error', type === 'error');
  app.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => app.toast.classList.remove('is-visible'), 3500);
}

async function persistState() {
  try {
    const response = await fetch('./api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Error al guardar.');
  } catch (error) {
    console.error('No se pudo guardar en MariaDB.', error);
    notify('No se pudo guardar en MariaDB. Revisá que Docker esté activo.', 'error');
  }
}

async function loadState() {
  const response = await fetch('./api.php');
  if (!response.ok) throw new Error('No se pudo conectar con PHP/MariaDB. Iniciá Docker con docker compose up -d.');
  const initialData = await response.json();
  state.vehicles = initialData.vehicles || [];
  state.packages = initialData.packages || [];
  state.trips = initialData.trips || [];
  persistState();
}

function packageVolume(parcel) {
  if (Number(parcel.volumeM3) > 0) return Number(parcel.volumeM3);
  return Number(parcel.lengthM) * Number(parcel.widthM) * Number(parcel.heightM);
}

function payloadCapacity(vehicle) {
  return Math.max(0, Number(vehicle.pbvKg) - Number(vehicle.tareKg));
}

function tripPackages(trip) {
  return (trip.packageCodes || []).map((code) => state.packages.find((parcel) => parcel.code === code)).filter(Boolean);
}

function activeLoad(vehicleId) {
  const assigned = state.trips.filter((trip) => trip.vehicleId === vehicleId && trip.status === 'En curso');
  return assigned.reduce((load, trip) => {
    for (const parcel of tripPackages(trip)) {
      if (parcel.status === 'En viaje') {
        load.weightKg += Number(parcel.weightKg) || 0;
        load.volumeM3 += packageVolume(parcel);
      }
    }
    return load;
  }, { weightKg: 0, volumeM3: 0 });
}

function statusClass(status) {
  if (status === 'Entregado') return 'status-badge--entregado';
  if (status === 'En viaje') return 'status-badge--viaje';
  return 'status-badge--deposito';
}

function statusBadge(status) {
  return '<span class="status-badge ' + statusClass(status) + '">' + escapeHTML(status) + '</span>';
}

function renderMetrics() {
  document.querySelector('#metric-pending').textContent = state.packages.filter((parcel) => parcel.status === 'En depósito').length;
  document.querySelector('#metric-transit').textContent = state.packages.filter((parcel) => parcel.status === 'En viaje').length;
  document.querySelector('#metric-delivered').textContent = state.packages.filter((parcel) => parcel.status === 'Entregado').length;
  document.querySelector('#metric-vehicles').textContent = state.vehicles.length;
}

function renderOrders() {
  const container = document.querySelector('#web-orders-list');
  if (!state.orders.length) {
    container.innerHTML = '<section class="panel-card"><p class="empty-state">Todavía no se recibieron pedidos desde la tienda TPLM.</p></section>';
    return;
  }
  container.innerHTML = state.orders.map((order) => {
    const address = [order.address_line1, order.address_line2, order.city, order.country, order.postal_code].filter(Boolean).map(escapeHTML).join(', ');
    const items = (order.items || []).map((item) => '<li><strong>' + escapeHTML(item.title) + '</strong> · ' + escapeHTML(item.quantity) + ' × U$S ' + formatNumber(item.unit_price, 2) + ' = U$S ' + formatNumber(item.line_total, 2) + '</li>').join('');
    return '<article class="panel-card web-order-card"><div class="panel-card__header"><div><p class="eyebrow">' + escapeHTML(order.status) + ' · ' + formatDate(order.createdAt) + '</p><h2>' + escapeHTML(order.order_code) + '</h2><p>' + escapeHTML(order.first_name + ' ' + order.last_name) + '</p></div><strong>U$S ' + formatNumber(order.total, 2) + '</strong></div><p><strong>Entrega:</strong> ' + address + '</p><ul class="web-order-items">' + items + '</ul></article>';
  }).join('');
}

async function loadOrders() {
  const container = document.querySelector('#web-orders-list');
  container.innerHTML = '<section class="panel-card"><p class="empty-state">Consultando pedidos de TPLM…</p></section>';
  try {
    const response = await fetch('./api.php?resource=orders', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron consultar los pedidos.');
    state.orders = result.orders || [];
    renderOrders();
  } catch (error) {
    console.error(error);
    container.innerHTML = '<section class="panel-card"><p class="empty-state">No se pudieron consultar los pedidos. Comprobá que MariaDB esté activa y actualizá la lista.</p></section>';
  }
}

function renderRecentPackages() {
  const rows = document.querySelector('#recent-packages');
  const recent = [...state.packages].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)).slice(0, 5);
  rows.innerHTML = recent.map((parcel) => '<tr>' +
    '<td><button class="code-link" type="button" data-track-code="' + escapeHTML(parcel.code) + '">' + escapeHTML(parcel.code) + '</button></td>' +
    '<td>' + escapeHTML(parcel.destination) + '</td>' +
    '<td>' + statusBadge(parcel.status) + '</td>' +
    '<td>' + formatNumber(parcel.weightKg, 1) + ' kg</td>' +
    '</tr>').join('');
  document.querySelector('#recent-empty').hidden = recent.length > 0;
}

function renderFleet() {
  const fleet = document.querySelector('#fleet-overview');
  fleet.innerHTML = state.vehicles.map((vehicle) => {
    const load = activeLoad(vehicle.id);
    const payload = payloadCapacity(vehicle);
    const weightPercent = payload ? Math.min(100, (load.weightKg / payload) * 100) : 0;
    const volumePercent = vehicle.volumeM3 ? Math.min(100, (load.volumeM3 / vehicle.volumeM3) * 100) : 0;
    const active = state.trips.some((trip) => trip.vehicleId === vehicle.id && trip.status === 'En curso');
    return '<article class="fleet-item">' +
      '<div class="fleet-item__heading"><span class="fleet-item__name">' + escapeHTML(vehicle.name) + '</span><span class="fleet-item__type">' + escapeHTML(vehicle.model) + '</span></div>' +
      '<progress value="' + weightPercent + '" max="100" aria-label="Uso de peso de ' + escapeHTML(vehicle.name) + '"></progress>' +
      '<div class="fleet-item__detail"><span>' + formatNumber(load.weightKg, 1) + ' / ' + formatNumber(payload, 0) + ' kg</span><span>' + formatNumber(load.volumeM3, 2) + ' / ' + formatNumber(vehicle.volumeM3, 1) + ' m³</span></div>' +
      '<span class="sr-only">' + (active ? 'Tiene un viaje en curso.' : 'Sin viajes activos.') + ' Ocupación de volumen: ' + formatNumber(volumePercent, 0) + ' por ciento.</span>' +
      '</article>';
  }).join('') || '<p class="empty-state">No hay vehículos cargados.</p>';
}

function filteredPackages() {
  const search = document.querySelector('#package-search').value.trim().toLocaleLowerCase('es-AR');
  const status = document.querySelector('#status-filter').value;
  return state.packages.filter((parcel) => {
    const matchesStatus = status === 'todos' || parcel.status === status;
    const searchable = [parcel.code, parcel.recipient, parcel.destination, parcel.description].join(' ').toLocaleLowerCase('es-AR');
    return matchesStatus && searchable.includes(search);
  }).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

function dimensionsText(parcel) {
  return [parcel.lengthM, parcel.widthM, parcel.heightM].map((value) => formatNumber(value, 2)).join(' × ') + ' m';
}

function renderPackages() {
  const parcels = filteredPackages();
  document.querySelector('#package-count').textContent = parcels.length + (parcels.length === 1 ? ' resultado' : ' resultados');
  document.querySelector('#package-rows').innerHTML = parcels.map((parcel) => '<tr>' +
    '<td><button class="code-link" type="button" data-track-code="' + escapeHTML(parcel.code) + '">' + escapeHTML(parcel.code) + '</button></td>' +
    '<td>' + escapeHTML(parcel.recipient) + '</td>' +
    '<td>' + escapeHTML(parcel.destination) + '</td>' +
    '<td>' + dimensionsText(parcel) + '</td>' +
    '<td>' + formatNumber(packageVolume(parcel), 3) + ' m³</td>' +
    '<td>' + formatNumber(parcel.weightKg, 1) + ' kg</td>' +
    '<td>' + statusBadge(parcel.status) + '</td>' +
    '<td><button class="text-button" type="button" data-track-code="' + escapeHTML(parcel.code) + '">Ver</button></td>' +
    '</tr>').join('');
  document.querySelector('#packages-empty').hidden = parcels.length > 0;
}

function selectedPackages() {
  const selectedCodes = [...document.querySelectorAll('[data-package-choice]:checked')].map((input) => input.value);
  return selectedCodes.map((code) => state.packages.find((parcel) => parcel.code === code)).filter(Boolean);
}

function renderDispatchOptions() {
  const select = document.querySelector('#dispatch-vehicle');
  const currentValue = select.value;
  select.innerHTML = state.vehicles.map((vehicle) => '<option value="' + escapeHTML(vehicle.id) + '">' + escapeHTML(vehicle.name + ' · ' + vehicle.model) + '</option>').join('');
  if (state.vehicles.some((vehicle) => vehicle.id === currentValue)) select.value = currentValue;
}

function renderDispatchPackages() {
  const container = document.querySelector('#dispatch-available');
  const available = state.packages.filter((parcel) => parcel.status === 'En depósito');
  container.innerHTML = available.map((parcel) => '<label class="package-option">' +
    '<input type="checkbox" data-package-choice value="' + escapeHTML(parcel.code) + '">' +
    '<span class="package-option__body"><strong>' + escapeHTML(parcel.code) + ' · ' + escapeHTML(parcel.description) + '</strong><span>' + escapeHTML(parcel.destination) + ' · ' + formatNumber(parcel.weightKg, 1) + ' kg · ' + formatNumber(packageVolume(parcel), 3) + ' m³</span></span>' +
    '</label>').join('') || '<p class="empty-state">No hay paquetes listos para despachar.</p>';
}

function renderCapacity() {
  const vehicle = state.vehicles.find((item) => item.id === document.querySelector('#dispatch-vehicle').value);
  const createButton = document.querySelector('#create-trip');
  if (!vehicle) {
    document.querySelector('#vehicle-specs').innerHTML = '<p class="empty-state">No hay vehículos disponibles.</p>';
    document.querySelector('#capacity-message').textContent = 'Cargá un vehículo para calcular la capacidad.';
    createButton.disabled = true;
    return;
  }

  const payload = payloadCapacity(vehicle);
  const current = activeLoad(vehicle.id);
  const chosen = selectedPackages().reduce((load, parcel) => {
    load.weightKg += Number(parcel.weightKg) || 0;
    load.volumeM3 += packageVolume(parcel);
    return load;
  }, { weightKg: 0, volumeM3: 0 });
  const totalWeight = current.weightKg + chosen.weightKg;
  const totalVolume = current.volumeM3 + chosen.volumeM3;
  const weightPercent = payload ? (totalWeight / payload) * 100 : 0;
  const volumePercent = vehicle.volumeM3 ? (totalVolume / vehicle.volumeM3) * 100 : 0;
  const withinLimits = totalWeight <= payload && totalVolume <= vehicle.volumeM3;
  const hasSelection = selectedPackages().length > 0;

  document.querySelector('#vehicle-specs').innerHTML =
    '<div class="spec-card"><span>PBV</span><strong>' + formatNumber(vehicle.pbvKg, 0) + ' kg</strong></div>' +
    '<div class="spec-card"><span>Tara</span><strong>' + formatNumber(vehicle.tareKg, 0) + ' kg</strong></div>' +
    '<div class="spec-card"><span>Carga útil (PBV − tara)</span><strong>' + formatNumber(payload, 0) + ' kg</strong></div>' +
    '<div class="spec-card"><span>Volumen útil</span><strong>' + formatNumber(vehicle.volumeM3, 1) + ' m³</strong></div>';
  document.querySelector('#weight-progress').value = Math.min(100, weightPercent);
  document.querySelector('#volume-progress').value = Math.min(100, volumePercent);
  document.querySelector('#weight-progress').classList.toggle('is-over', weightPercent > 100);
  document.querySelector('#volume-progress').classList.toggle('is-over', volumePercent > 100);
  document.querySelector('#dispatch-weight-text').textContent = formatNumber(totalWeight, 1) + ' / ' + formatNumber(payload, 0) + ' kg';
  document.querySelector('#dispatch-volume-text').textContent = formatNumber(totalVolume, 3) + ' / ' + formatNumber(vehicle.volumeM3, 1) + ' m³';
  const stateBadge = document.querySelector('#capacity-state');
  stateBadge.classList.toggle('is-valid', withinLimits && hasSelection);
  stateBadge.classList.toggle('is-invalid', !withinLimits);
  stateBadge.textContent = !withinLimits ? 'Supera el límite' : hasSelection ? 'Dentro del límite' : 'Pendiente';
  let message = 'Elegí al menos un paquete para calcular la carga del viaje.';
  if (!withinLimits) {
    const limiter = weightPercent > 100 && volumePercent > 100 ? 'peso y volumen' : weightPercent > 100 ? 'peso' : 'volumen';
    message = 'El despacho supera el límite de ' + limiter + ' de ' + vehicle.name + '. Quitá paquetes o elegí otro vehículo.';
  } else if (hasSelection) {
    message = 'Carga válida. El viaje usa ' + formatNumber(weightPercent, 1) + '% del peso y ' + formatNumber(volumePercent, 1) + '% del volumen.';
  }
  document.querySelector('#capacity-message').textContent = message;
  createButton.disabled = !hasSelection || !withinLimits;
}

function renderAll() {
  renderMetrics();
  renderRecentPackages();
  renderFleet();
  renderPackages();
  renderDispatchOptions();
  renderDispatchPackages();
  renderCapacity();
  renderOrders();
}

function switchView(name, focusHeading = true) {
  const target = document.querySelector('[data-page="' + name + '"]');
  if (!target) return;
  document.querySelectorAll('[data-page]').forEach((section) => {
    const active = section === target;
    section.hidden = !active;
    section.classList.toggle('is-visible', active);
  });
  document.querySelectorAll('.nav-link[data-view]').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  app.shell.classList.remove('app-shell--menu-open');
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
  document.querySelector('#menu-toggle').setAttribute('aria-label', 'Abrir menú');
  if (focusHeading) target.querySelector('h1').focus({ preventScroll: true });
}

function addHistory(parcel, status, note) {
  if (!Array.isArray(parcel.history)) parcel.history = [];
  parcel.history.unshift({ status, note, date: todayISO() });
}

function generateCode() {
  let code;
  do {
    code = 'TLS-' + new Date().toISOString().slice(2, 10).replaceAll('-', '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (state.packages.some((parcel) => parcel.code === code));
  return code;
}

function createPackage(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const volume = Number(values.lengthM) * Number(values.widthM) * Number(values.heightM);
  const parcel = {
    code: generateCode(),
    sender: values.sender.trim(),
    recipient: values.recipient.trim(),
    origin: values.origin.trim(),
    destination: values.destination.trim(),
    description: values.description.trim(),
    weightKg: Number(values.weightKg),
    lengthM: Number(values.lengthM),
    widthM: Number(values.widthM),
    heightM: Number(values.heightM),
    volumeM3: Math.round(volume * 1000) / 1000,
    status: 'En depósito',
    receivedAt: todayISO(),
    history: [{ status: 'En depósito', note: 'Paquete recibido en origen.', date: todayISO() }],
  };
  state.packages.unshift(parcel);
  persistState();
  renderAll();
  form.reset();
  app.packageDialog.close();
  notify('Paquete registrado. Código: ' + parcel.code);
  document.querySelector('#tracking-code').value = parcel.code;
  switchView('seguimiento');
  showTracking(parcel.code);
}

function createTrip() {
  const vehicle = state.vehicles.find((item) => item.id === document.querySelector('#dispatch-vehicle').value);
  const parcels = selectedPackages();
  if (!vehicle || parcels.length === 0) return;
  const load = activeLoad(vehicle.id);
  const newWeight = parcels.reduce((sum, parcel) => sum + Number(parcel.weightKg), 0);
  const newVolume = parcels.reduce((sum, parcel) => sum + packageVolume(parcel), 0);
  if (load.weightKg + newWeight > payloadCapacity(vehicle) || load.volumeM3 + newVolume > Number(vehicle.volumeM3)) {
    renderCapacity();
    notify('El viaje supera la capacidad del vehículo.', 'error');
    return;
  }
  const trip = {
    id: 'V-' + String(25 + state.trips.length).padStart(3, '0'),
    vehicleId: vehicle.id,
    packageCodes: parcels.map((parcel) => parcel.code),
    status: 'En curso',
    createdAt: todayISO(),
  };
  state.trips.unshift(trip);
  parcels.forEach((parcel) => {
    parcel.status = 'En viaje';
    parcel.tripId = trip.id;
    addHistory(parcel, 'En viaje', 'Asignado al viaje ' + trip.id + ' con ' + vehicle.name + '.');
  });
  persistState();
  renderAll();
  notify('Viaje ' + trip.id + ' creado con ' + parcels.length + ' paquete(s).');
}

function showTracking(code) {
  const result = document.querySelector('#tracking-result');
  const normalized = code.trim().toUpperCase();
  const parcel = state.packages.find((item) => item.code.toUpperCase() === normalized);
  const url = new URL(window.location.href);
  if (normalized) url.searchParams.set('guia', normalized);
  else url.searchParams.delete('guia');
  window.history.replaceState({}, '', url);

  if (!parcel) {
    result.innerHTML = normalized ? '<div class="notice" role="status">No encontramos el paquete <strong>' + escapeHTML(normalized) + '</strong>. Revisá el código e intentá de nuevo.</div>' : '';
    return;
  }
  const history = Array.isArray(parcel.history) ? parcel.history : [];
  const historyHTML = [...history].sort((a, b) => new Date(b.date) - new Date(a.date)).map((item) =>
    '<li class="timeline__item"><span class="timeline__dot" aria-hidden="true"></span><div class="timeline__text"><strong>' + escapeHTML(item.status) + '</strong><span>' + escapeHTML(item.note || '') + '</span></div><time class="timeline__date" datetime="' + escapeHTML(item.date) + '">' + formatDate(item.date) + '</time></li>'
  ).join('');
  const deliveryAction = parcel.status === 'En viaje'
    ? '<button class="button button--secondary button--small tracking-action" type="button" data-mark-delivered="' + escapeHTML(parcel.code) + '">Marcar como entregado</button>'
    : '';
  const trip = state.trips.find((item) => item.id === parcel.tripId);
  const vehicle = trip ? state.vehicles.find((item) => item.id === trip.vehicleId) : null;
  result.innerHTML = '<article class="tracking-card">' +
    '<header class="tracking-card__header"><div><p class="eyebrow">DETALLE DEL ENVÍO</p><h2>' + escapeHTML(parcel.description) + '</h2><p class="tracking-card__code">' + escapeHTML(parcel.code) + ' · Recibido ' + formatDate(parcel.receivedAt) + '</p></div>' + statusBadge(parcel.status) + '</header>' +
    '<div class="tracking-card__route"><div class="route-point"><span>ORIGEN</span><strong>' + escapeHTML(parcel.origin) + '</strong></div><span class="route-line" aria-hidden="true">⟶</span><div class="route-point"><span>DESTINO</span><strong>' + escapeHTML(parcel.destination) + '</strong></div></div>' +
    '<div class="tracking-card__body"><h3>Historial del paquete</h3><ol class="timeline">' + (historyHTML || '<li class="timeline__item"><span class="timeline__dot" aria-hidden="true"></span><div class="timeline__text"><strong>' + escapeHTML(parcel.status) + '</strong><span>Sin movimientos registrados.</span></div></li>') + '</ol>' +
    (vehicle ? '<p class="tracking-card__code">Viaje ' + escapeHTML(trip.id) + ' · ' + escapeHTML(vehicle.name) + '</p>' : '') + deliveryAction + '</div></article>';
}

function markDelivered(code) {
  const parcel = state.packages.find((item) => item.code === code);
  if (!parcel || parcel.status !== 'En viaje') return;
  parcel.status = 'Entregado';
  addHistory(parcel, 'Entregado', 'Entrega confirmada en destino.');
  const trip = state.trips.find((item) => item.id === parcel.tripId);
  if (trip && tripPackages(trip).every((item) => item.status === 'Entregado')) trip.status = 'Finalizado';
  persistState();
  renderAll();
  showTracking(parcel.code);
  notify('Entrega registrada para ' + parcel.code + '.');
}

function closeMenu() {
  app.shell.classList.remove('app-shell--menu-open');
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
  document.querySelector('#menu-toggle').setAttribute('aria-label', 'Abrir menú');
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      if (viewButton.tagName === 'A') event.preventDefault();
      switchView(viewButton.dataset.view);
      return;
    }
    if (event.target.closest('[data-open-package]')) {
      if (typeof app.packageDialog.showModal === 'function') app.packageDialog.showModal();
      return;
    }
    const closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) {
      document.getElementById(closeButton.dataset.closeDialog).close();
      return;
    }
    const trackButton = event.target.closest('[data-track-code]');
    if (trackButton) {
      const code = trackButton.dataset.trackCode;
      document.querySelector('#tracking-code').value = code;
      switchView('seguimiento');
      showTracking(code);
      return;
    }
    const deliverButton = event.target.closest('[data-mark-delivered]');
    if (deliverButton) markDelivered(deliverButton.dataset.markDelivered);
  });

  document.querySelector('#menu-toggle').addEventListener('click', (event) => {
    const isOpen = app.shell.classList.toggle('app-shell--menu-open');
    event.currentTarget.setAttribute('aria-expanded', String(isOpen));
    event.currentTarget.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
  });
  document.querySelector('.menu-backdrop').addEventListener('click', closeMenu);
  document.querySelector('#refresh-orders').addEventListener('click', loadOrders);
  document.querySelector('#package-search').addEventListener('input', renderPackages);
  document.querySelector('#status-filter').addEventListener('change', renderPackages);
  document.querySelector('#dispatch-vehicle').addEventListener('change', renderCapacity);
  document.querySelector('#dispatch-available').addEventListener('change', renderCapacity);
  document.querySelector('#package-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) createPackage(event.currentTarget);
  });
  document.querySelector('#dispatch-form').addEventListener('submit', (event) => {
    event.preventDefault();
    createTrip();
  });
  document.querySelector('#tracking-form').addEventListener('submit', (event) => {
    event.preventDefault();
    showTracking(document.querySelector('#tracking-code').value);
  });
  window.addEventListener('popstate', () => {
    const code = new URLSearchParams(window.location.search).get('guia');
    if (code) {
      switchView('seguimiento', false);
      document.querySelector('#tracking-code').value = code;
      showTracking(code);
    }
  });
}

async function initialize() {
  app.today.textContent = dateFormat.format(new Date());
  bindEvents();
  try {
    await loadState();
    renderAll();
    await loadOrders();
    const initialCode = new URLSearchParams(window.location.search).get('guia');
    if (initialCode) {
      document.querySelector('#tracking-code').value = initialCode;
      switchView('seguimiento', false);
      showTracking(initialCode);
    }
  } catch (error) {
    console.error(error);
    app.notice.hidden = false;
    app.notice.textContent = 'No se pudo conectar con PHP/MariaDB. Verificá que Docker Desktop esté activo y ejecutá docker compose up -d.';
  }
}

initialize();
