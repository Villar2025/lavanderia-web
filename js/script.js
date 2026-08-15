// =====================
// Supabase config
// =====================
const SUPABASE_URL = "https://flhxxpbbvedykyshrvxy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rGKJYFn0ws09B_sLZ7OkgA_t1GvDSuO";

let supabaseClient = null;

if (window.supabase && typeof window.supabase.createClient === "function") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("Supabase no cargó correctamente.");
}

// =====================
// Estado de la venta
// =====================
let cart = []; // [{ id, name, category, price, qty }]
let lastSaved = null;
let lastEncargoId = null;

const $ = (sel) => document.querySelector(sel);

function ensureSupabase() {
  if (!supabaseClient) {
    throw new Error("No se pudo conectar con Supabase. Revisa tu conexión o la carga del script.");
  }
}

const saleForm = $("#saleForm");
const employeeEl = $("#employee");
const saleDateEl = $("#saleDate");
const cashEl = $("#cash");
const salePaymentMethod = $("#salePaymentMethod");

const cartBody = $("#cartBody");
const cartTable = $("#cartTable");
const cartEmpty = $("#cartEmpty");
const totalEl = $("#total");
const changeEl = $("#change");

const statusEl = $("#status");
const newBtn = $("#newBtn");
const saveBtn = $("#saveBtn");

const printTicketBtn = $("#printTicketBtn");

const ticketSaleId = $("#ticketSaleId");
const ticketDate = $("#ticketDate");
const ticketEmployee = $("#ticketEmployee");
const ticketItemsBody = $("#ticketItemsBody");
const ticketTotal = $("#ticketTotal");
const ticketCash = $("#ticketCash");
const ticketChange = $("#ticketChange");

// Fecha por defecto: hoy
(function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  saleDateEl.value = `${yyyy}-${mm}-${dd}`;
})();

function wholeMoney(n) {
  return Math.round(n);
}

function money(n) {
  const val = wholeMoney(n);
  return `$${val.toLocaleString("es-MX")}`;
}

function localDateStartISO(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function localDateEndISO(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

function getLocalDateTime() {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function calcTotal() {
  const rawTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return Math.ceil(rawTotal);
}

function calcChange() {
  const total = calcTotal();

  if (salePaymentMethod.value === "transferencia") {
    return 0;
  }

  const cash = wholeMoney(cashEl.value || 0);
  return Math.round(cash - total);
}

function render() {
  const hasItems = cart.length > 0;
  cartEmpty.style.display = hasItems ? "none" : "block";
  cartTable.style.display = hasItems ? "table" : "none";

  cartBody.innerHTML = "";

  for (const item of cart) {
    const tr = document.createElement("tr");
    const subtotal = item.price * item.qty;

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${money(item.price)}</td>
      <td>
        <input
          type="number"
          min="1"
          value="${item.qty}"
          data-id="${item.id}"
          class="qtyEdit"
          style="max-width: 90px;"
        />
      </td>
      <td>${money(subtotal)}</td>
      <td style="text-align:right;">
        <button type="button" class="iconBtn" data-remove="${item.id}">Quitar</button>
      </td>
    `;

    cartBody.appendChild(tr);
  }

  const total = calcTotal();
  totalEl.textContent = money(total);

  const change = calcChange();
  changeEl.textContent = money(change);

  if (change < 0) {
    changeEl.style.borderColor = "rgba(255,107,107,0.55)";
  } else {
    changeEl.style.borderColor = "rgba(52,211,153,0.45)";
  }
}

function addItem({ name, category, price, qty }) {
  const p = Number(price);
  const q = Number(qty);

  if (!name || !category || !Number.isFinite(p) || p < 0 || !Number.isFinite(q) || q < 1) return;

  const existing = cart.find((x) => x.name === name && x.category === category && x.price === p);
  if (existing) {
    existing.qty += q;
  } else {
    cart.push({
      id: crypto.randomUUID(),
      name,
      category,
      price: p,
      qty: q,
    });
  }

  statusEl.textContent = "";
  render();
}

// =====================
// Agregar por dropdown
// =====================
document.querySelectorAll(".addBtn").forEach((btn) => {
  if (btn.id === "addCustomDry") return;

  btn.addEventListener("click", () => {
    const row = btn.closest(".row");
    if (!row) return;

    const select = row.querySelector(".productSelect");
    const qty = row.querySelector(".qtyInput");

    if (!select || !qty) return;

    if (!select.value) {
      statusEl.textContent = "Selecciona un producto antes de agregar.";
      return;
    }

    const opt = select.options[select.selectedIndex];
    const price = opt.dataset.price;
    const name = select.value;
    const category = select.dataset.category;

    addItem({ name, category, price, qty: qty.value });

    select.selectedIndex = 0;
    qty.value = 1;
  });
});

document.querySelectorAll(".productSelect").forEach((select) => {
  select.addEventListener("change", () => {
    const row = select.closest(".row");
    if (!row) return;

    const qty = row.querySelector(".qtyInput");
    if (!qty) return;

    if (!select.value) return;

    const opt = select.options[select.selectedIndex];
    const price = opt.dataset.price;
    const name = select.value;
    const category = select.dataset.category;

    addItem({ name, category, price, qty: qty.value });

    select.selectedIndex = 0;
    qty.value = 1;
  });
});

// Secado precio libre
$("#addCustomDry").addEventListener("click", () => {
  const input = $("#customDryPrice");
  const price = wholeMoney(input.value || 0);

  if (!Number.isFinite(price) || price <= 0) {
    statusEl.textContent = "Escribe un precio válido para el secado.";
    return;
  }

  addItem({
    name: "Secado (precio libre)",
    category: "lavadoras_secadoras",
    price,
    qty: 1,
  });

  input.value = "";
});

// Editar cantidades y quitar
cartBody.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.classList.contains("qtyEdit")) return;

  const id = el.dataset.id;
  const item = cart.find((x) => x.id === id);
  if (!item) return;

  const newQty = Number(el.value);
  if (!Number.isFinite(newQty) || newQty < 1) return;

  item.qty = newQty;
  render();
});

cartBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const removeId = btn.dataset.remove;
  if (!removeId) return;

  cart = cart.filter((x) => x.id !== removeId);
  render();
});

// Recalcular cambio al escribir dinero
cashEl.addEventListener("input", () => render());

salePaymentMethod.addEventListener("change", () => {
  const total = calcTotal();

  if (salePaymentMethod.value === "transferencia") {
    cashEl.value = total;
    cashEl.readOnly = true;
  } else {
    cashEl.value = "";
    cashEl.readOnly = false;
  }

  render();
});

// =====================
// Guardar venta (Opción A: ventas + venta_items)
// =====================
async function saveToSupabase(salePayload) {
  ensureSupabase();

  const ventaRow = {
    employee: salePayload.employee,
    sale_date: salePayload.date,
    total: salePayload.total,
    cash: salePayload.cash,
    change: salePayload.change,
  };

  const { data: venta, error: ventaError } = await supabaseClient
    .from("ventas")
    .insert(ventaRow)
    .select("id")
    .single();

  if (ventaError) {
    console.error(ventaError);
    return { ok: false, error: ventaError.message };
  }

  const itemsRows = salePayload.items.map((i) => ({
    venta_id: venta.id,
    name: i.name,
    category: i.category,
    price: i.price,
    qty: i.qty,
    subtotal: i.subtotal,
  }));

  const { error: itemsError } = await supabaseClient
    .from("venta_items")
    .insert(itemsRows);

  if (itemsError) {
    console.error(itemsError);
    await supabaseClient.from("ventas").delete().eq("id", venta.id);
    return { ok: false, error: itemsError.message };
  }

  const fichasRows = salePayload.items.map((item) => {
    let concepto = item.name;
    let cantidad = Number(item.qty || 0);
  
    if (
      item.name === "Secadora 9 kg (15 min)" ||
      item.name === "Solo secado 9 kg (15 min)"
    ) {
      concepto = "Secadora 9 kg (15 min)";
    }
  
    if (
      item.name === "Secadora 9 kg (30 min)" ||
      item.name === "Solo secado 9 kg (30 min)"
    ) {
      concepto = "Secadora 9 kg (30 min)";
      cantidad = cantidad * 2;
    }
  
    return {
      employee: salePayload.employee,
      origen: "auto_servicio",
      concepto,
      cantidad,
      referencia_id: String(venta.id),
    };
  });
  
  const { error: fichasError } = await supabaseClient
    .from("movimientos_fichas")
    .insert(fichasRows);
  
  if (fichasError) {
    console.error(
      "Error al registrar fichas de auto servicio:",
      fichasError
    );
  
    await supabaseClient
      .from("venta_items")
      .delete()
      .eq("venta_id", venta.id);
  
    await supabaseClient
      .from("ventas")
      .delete()
      .eq("id", venta.id);
  
    return {
      ok: false,
      error: "No se pudieron registrar las fichas de la venta."
    };
  }

  const { error: movimientoError } = await supabaseClient
  .from("movimientos_caja")
  .insert({
    employee: salePayload.employee,
    origen: "auto_servicio",
    metodo_pago: salePayload.paymentMethod,
    monto: salePayload.total,
    referencia_id: String(venta.id),
  });

if (movimientoError) {
  console.error("Error al registrar movimiento de caja:", movimientoError);

  await supabaseClient
    .from("venta_items")
    .delete()
    .eq("venta_id", venta.id);

  await supabaseClient
    .from("ventas")
    .delete()
    .eq("id", venta.id);

  return {
    ok: false,
    error: "No se pudo registrar el movimiento de caja."
  };
}

  return { ok: true, id: venta.id };
}

// =====================
// Submit: registrar venta
// =====================
saleForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const employee = employeeEl.value;
  const date = saleDateEl.value;

  if (!employee) return (statusEl.textContent = "Selecciona el empleado.");
  if (!date) return (statusEl.textContent = "Selecciona la fecha.");
  if (cart.length === 0) return (statusEl.textContent = "Agrega al menos un producto.");

  const total = calcTotal();
  const paymentMethod = salePaymentMethod.value;
  const cash = wholeMoney(cashEl.value || 0);
  
  const change =
    paymentMethod === "transferencia"
      ? 0
      : cash - total;

  if (!Number.isFinite(cash) || cash <= 0) return (statusEl.textContent = "Escribe el dinero recibido.");
  if (change < 0) return (statusEl.textContent = "El dinero recibido no alcanza para cubrir el total.");

  const salePayload = {
    employee,
    date,
    paymentMethod,
    items: cart.map((i) => ({
      name: i.name,
      category: i.category,
      price: i.price,
      qty: i.qty,
      subtotal: wholeMoney(i.price * i.qty),
    })),
    total,
    cash,
    change,
    created_at: new Date().toISOString(),
  };

  statusEl.textContent = "Registrando venta...";
  saveBtn.disabled = true;

  try {
    const res = await saveToSupabase(salePayload);
    if (!res.ok) throw new Error(res.error || "No se pudo guardar.");

    lastSaved = {
      id: res.id,
      employee,
      date,
      created_at: salePayload.created_at,
      paymentMethod,
      items: salePayload.items,
      total,
      cash,
      change,
    };
    statusEl.textContent = `✅ Venta registrada (ID: ${res.id}).`;
    newBtn.disabled = false;
    printTicketBtn.disabled = false;
  } catch (err) {
    statusEl.textContent = `❌ Error: ${err.message || "No se pudo registrar"}`;
  } finally {
    saveBtn.disabled = false;
  }
});

// Nueva venta (reset)
newBtn.addEventListener("click", () => {
  cart = [];
  lastSaved = null;

  cashEl.value = "";
  statusEl.textContent = "";

  newBtn.disabled = true;
  printTicketBtn.disabled = true;

  render();
});

// init
render();

// =====================
// Ver ventas (lectura)
// =====================
const fromDateEl = $("#fromDate");
const toDateEl = $("#toDate");
const employeeFilterEl = $("#employeeFilter");
const loadSalesBtn = $("#loadSalesBtn");
const salesBody = $("#salesBody");
const salesStatus = $("#salesStatus");

const detailPanel = $("#detailPanel");
const detailBody = $("#detailBody");
const closeDetailBtn = $("#closeDetail");

(function setDefaultFilters() {
  const today = saleDateEl.value;
  fromDateEl.value = today;
  toDateEl.value = today;
})();

function clearSalesTable() {
  salesBody.innerHTML = "";
}

function formatDate(yyyyMMdd) {
  if (!yyyyMMdd) return "";
  const [y, m, d] = yyyyMMdd.split("-");
  return `${d}/${m}/${y}`;
}

async function loadSales() {
  ensureSupabase();

  salesStatus.textContent = "Cargando ventas...";
  clearSalesTable();

  const from = fromDateEl.value;
  const to = toDateEl.value;
  const emp = employeeFilterEl.value;

  let q = supabaseClient
    .from("ventas")
    .select("id, employee, sale_date, total, cash, change, created_at")
    .order("created_at", { ascending: false });

  if (from) q = q.gte("sale_date", from);
  if (to) q = q.lte("sale_date", to);
  if (emp) q = q.eq("employee", emp);

  const { data, error } = await q;

  if (error) {
    console.error(error);
    salesStatus.textContent = `❌ Error al cargar: ${error.message}`;
    return;
  }


  salesStatus.textContent = `Listo: ${data.length} venta(s).`;

  const totalVentas = data.length;
const totalIngreso = data.reduce(
  (sum, v) => sum + Number(v.total || 0),
  0
);

let totalEfectivo = 0;
let totalTransferencia = 0;

const ventaIds = (data || []).map((v) => String(v.id));

if (ventaIds.length > 0) {
  const { data: movimientosCaja, error: movimientosCajaError } =
    await supabaseClient
      .from("movimientos_caja")
      .select("metodo_pago, monto, referencia_id")
      .eq("origen", "auto_servicio")
      .in("referencia_id", ventaIds);

  if (movimientosCajaError) {
    console.error(
      "Error al cargar movimientos de caja:",
      movimientosCajaError
    );
  } else {
    for (const movimiento of movimientosCaja || []) {
      const monto = Number(movimiento.monto || 0);

      if (movimiento.metodo_pago === "efectivo") {
        totalEfectivo += monto;
      }

      if (movimiento.metodo_pago === "transferencia") {
        totalTransferencia += monto;
      }
    }
  }
}

summaryCount.textContent = totalVentas;
summaryEfectivo.textContent = money(totalEfectivo);
summaryTransferencia.textContent = money(totalTransferencia);
summaryTotal.textContent = money(totalIngreso);

salesSummary.style.display = "block";

  for (const v of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(v.sale_date)}</td>
      <td>${v.employee}</td>
      <td>${money(v.total)}</td>
      <td>${money(v.cash)}</td>
      <td>${money(v.change)}</td>
      <td style="text-align:right;">
        <button type="button" class="addBtn" data-view="${v.id}" style="width:auto; padding:8px 10px;">
          Ver detalle
        </button>
      </td>
    `;
    salesBody.appendChild(tr);
  }
}

async function loadSaleDetail(ventaId) {
  ensureSupabase();

  detailPanel.style.display = "block";
  detailBody.innerHTML = `<tr><td colspan="5" class= "muted">Cargando detalle...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("venta_items")
    .select("name, category, price, qty, subtotal")
    .eq("venta_id", ventaId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    detailBody.innerHTML = `<tr><td colspan="5" class="muted">❌ Error: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    detailBody.innerHTML = `<tr><td colspan="5" class="muted">No hay items.</td></tr>`;
    return;
  }

  detailBody.innerHTML = "";
  for (const it of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.name}</td>
      <td>${it.category}</td>
      <td>${money(it.price)}</td>
      <td>${it.qty}</td>
      <td>${money(it.subtotal)}</td>
    `;
    detailBody.appendChild(tr);
  }
}

loadSalesBtn.addEventListener("click", loadSales);

salesBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.view;
  if (!id) return;
  loadSaleDetail(id);
});

closeDetailBtn.addEventListener("click", () => {
  detailPanel.style.display = "none";
  detailBody.innerHTML = "";
});

const salesSummary = $("#salesSummary");
const summaryCount = $("#summaryCount");
const summaryEfectivo = $("#summaryEfectivo");
const summaryTransferencia = $("#summaryTransferencia");
const summaryTotal = $("#summaryTotal");

// =====================
// Protección por contraseña
// =====================
const ADMIN_PASSWORD = "1234";

const accessSection = $("#accessSection");
const viewSalesSection = $("#viewSalesSection");
const adminPasswordEl = $("#adminPassword");
const unlockBtn = $("#unlockBtn");
const accessStatus = $("#accessStatus");

unlockBtn.addEventListener("click", () => {
  const entered = adminPasswordEl.value.trim();

  if (!entered) {
    accessStatus.textContent = "Ingresa la contraseña.";
    return;
  }

  if (entered === ADMIN_PASSWORD) {
    accessStatus.textContent = "Acceso concedido.";
    viewSalesSection.style.display = "block";
    adminPasswordEl.value = "";
  } else {
    accessStatus.textContent = "Contraseña incorrecta.";
    adminPasswordEl.value = "";
  }
});

function resetViewEncargosSection() {
  if (viewEncargosBody) viewEncargosBody.innerHTML = "";
  if (viewEncargosStatus) viewEncargosStatus.textContent = "";
  if (viewEncargosSummary) viewEncargosSummary.style.display = "none";

  if (viewEncargosSummaryCount) viewEncargosSummaryCount.textContent = "0";
  if (viewEncargosSummaryTotal) viewEncargosSummaryTotal.textContent = "$0";
  if (viewEncargosSummaryPaid) viewEncargosSummaryPaid.textContent = "$0";
  if (viewEncargosSummaryDue) viewEncargosSummaryDue.textContent = "$0";
  if (viewEncargosSummaryCambio) viewEncargosSummaryCambio.textContent = "$0";

  if (viewEncargoDetailPanel) viewEncargoDetailPanel.style.display = "none";

  if (viewDetailEncargoId) viewDetailEncargoId.textContent = "-";
  if (viewDetailEncargoFecha) viewDetailEncargoFecha.textContent = "-";
  if (viewDetailEncargoEmpleado) viewDetailEncargoEmpleado.textContent = "-";
  if (viewDetailEncargoCliente) viewDetailEncargoCliente.textContent = "-";
  if (viewDetailEncargoTelefono) viewDetailEncargoTelefono.textContent = "-";
  if (viewDetailEncargoTotal) viewDetailEncargoTotal.textContent = "-";
  if (viewDetailEncargoPagado) viewDetailEncargoPagado.textContent = "-";
  if (viewDetailEncargoCambio) viewDetailEncargoCambio.textContent = "-";
  if (viewDetailEncargoFalta) viewDetailEncargoFalta.textContent = "-";
  if (viewDetailEncargoPagoEstado) viewDetailEncargoPagoEstado.textContent = "-";
  if (viewDetailEncargoPedidoEstado) viewDetailEncargoPedidoEstado.textContent = "-";
  if (viewDetailEncargoEntregadoAt) viewDetailEncargoEntregadoAt.textContent = "-";

  if (viewEncargoServicesBody) viewEncargoServicesBody.innerHTML = "";
  if (viewEncargoUsageBody) viewEncargoUsageBody.innerHTML = "";
}

async function deleteAllDataExceptPending() {
  ensureSupabase();

  const confirm1 = confirm("¿Eliminar todas las ventas y todos los encargos que NO estén pendientes?");
  if (!confirm1) return;

  const confirm2 = prompt("Escribe ELIMINAR para confirmar");
  if (confirm2 !== "ELIMINAR") {
    alert("Cancelado");
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("delete_all_data_except_pending");

    if (error) throw error;

    console.log("Resultado borrado:", data);

    if (salesBody) salesBody.innerHTML = "";
    if (detailBody) detailBody.innerHTML = "";
    if (detailPanel) detailPanel.style.display = "none";
    if (salesSummary) salesSummary.style.display = "none";
    if (summaryCount) summaryCount.textContent = "0";
    if (summaryTotal) summaryTotal.textContent = "$0";

    if (typeof resetViewEncargosSection === "function") {
      resetViewEncargosSection();
    }

    if (typeof clearUsageTables === "function") {
      clearUsageTables();
    }

    if (salesStatus) salesStatus.textContent = "✅ Datos eliminados.";
    if (viewEncargosStatus) viewEncargosStatus.textContent = "✅ Se conservaron los pendientes.";
    if (usageSummaryStatus) usageSummaryStatus.textContent = "✅ Resumen reiniciado.";

    alert(
      `Eliminación completada:\n` +
      `Ventas: ${data?.ventas ?? 0}\n` +
      `Items de ventas: ${data?.venta_items ?? 0}\n` +
      `Encargos eliminados: ${data?.encargos ?? 0}`
    );
  } catch (err) {
    console.error("ERROR AL ELIMINAR:", err);
    alert(`Error al eliminar datos: ${err.message || JSON.stringify(err)}`);
  }
}

// =====================
// Cerrar sesión ventas
// =====================
const logoutBtn = $("#logoutBtn");
const deleteAllDataBtn = $("#deleteAllDataBtn");

const btnConsultaAutoServicio = $("#btnConsultaAutoServicio");
const btnConsultaEncargos = $("#btnConsultaEncargos");
const btnConsultaResumen = $("#btnConsultaResumen");

const btnGastosReparto = $("#btnGastosReparto");
const consultaGastosReparto = $("#consultaGastosReparto");

const repartoCortesBody = $("#repartoCortesBody");
const repartoCortesStatus = $("#repartoCortesStatus");

const repartoEfectivo = $("#repartoEfectivo");
const repartoTransferencias = $("#repartoTransferencias");

const repartoGranTotal = $("#repartoGranTotal");
const repartoTotalSalidas = $("#repartoTotalSalidas");
const repartoEfectivoRestante = $("#repartoEfectivoRestante");
const repartoRestante = $("#repartoRestante");

const repartoConcepto = $("#repartoConcepto");
const repartoMonto = $("#repartoMonto");

const agregarGastoRepartoBtn = $("#agregarGastoRepartoBtn");
const repartoGastosBody = $("#repartoGastosBody");
const guardarRepartoBtn = $("#guardarRepartoBtn");
const repartoStatus = $("#repartoStatus");

const cargarHistorialRepartosBtn = $("#cargarHistorialRepartosBtn");
const historialRepartosBody = $("#historialRepartosBody");
const historialRepartosStatus = $("#historialRepartosStatus");

const detalleRepartoPanel = $("#detalleRepartoPanel");
const cerrarDetalleRepartoBtn = $("#cerrarDetalleRepartoBtn");

const detalleRepartoId = $("#detalleRepartoId");
const detalleRepartoFecha = $("#detalleRepartoFecha");

const detalleRepartoEfectivo = $("#detalleRepartoEfectivo");
const detalleRepartoTransferencias = $("#detalleRepartoTransferencias");

const detalleRepartoTotalCortes = $("#detalleRepartoTotalCortes");
const detalleRepartoTotalSalidas = $("#detalleRepartoTotalSalidas");

const detalleRepartoEfectivoRestante = $("#detalleRepartoEfectivoRestante");
const detalleRepartoRestante = $("#detalleRepartoRestante");

const detalleRepartoCortesBody = $("#detalleRepartoCortesBody");
const detalleRepartoGastosBody = $("#detalleRepartoGastosBody");

let cortesDisponiblesReparto = [];
let cortesSeleccionadosReparto = [];
let gastosReparto = [];

const openCorteTurnoBtn = $("#openCorteTurnoBtn");
const consultaCorteTurno = $("#consultaCorteTurno");

const corteEmployee = $("#corteEmployee");
const corteFechaInicio = $("#corteFechaInicio");
const corteFechaFin = $("#corteFechaFin");
const corteHoraInicio = $("#corteHoraInicio");
const corteHoraFin = $("#corteHoraFin");
const generarCorteBtn = $("#generarCorteBtn");
const guardarCorteBtn = $("#guardarCorteBtn");
const corteStatus = $("#corteStatus");

const historialCorteDesde = $("#historialCorteDesde");
const historialCorteHasta = $("#historialCorteHasta");
const historialCorteEmpleado = $("#historialCorteEmpleado");
const cargarHistorialCortesBtn = $("#cargarHistorialCortesBtn");
const historialCortesBody = $("#historialCortesBody");
const historialCortesStatus = $("#historialCortesStatus");

const historialAnteriorBtn = $("#historialAnteriorBtn");
const historialSiguienteBtn = $("#historialSiguienteBtn");
const historialPaginaInfo = $("#historialPaginaInfo");

let historialPaginaActual = 0;
const historialTamanoPagina = 10;
let historialHayMas = false;

const detalleCortePanel = $("#detalleCortePanel");
const cerrarDetalleCorteBtn = $("#cerrarDetalleCorteBtn");

const detalleCorteId = $("#detalleCorteId");
const detalleCorteEmpleado = $("#detalleCorteEmpleado");
const detalleCorteInicio = $("#detalleCorteInicio");
const detalleCorteFin = $("#detalleCorteFin");
const detalleCorteEfectivo = $("#detalleCorteEfectivo");
const detalleCorteTransferencias = $("#detalleCorteTransferencias");
const detalleCorteTotal = $("#detalleCorteTotal");

const detalleFichasAuto = $("#detalleFichasAuto");
const detalleFichasEncargos = $("#detalleFichasEncargos");
const detalleFichasTotal = $("#detalleFichasTotal");

let ultimoCorteGenerado = null;

const consultaAutoServicio = $("#consultaAutoServicio");
const consultaEncargos = $("#consultaEncargos");
const consultaResumen = $("#consultaResumen");

function mostrarConsulta(tipo) {
  consultaAutoServicio.style.display =
    tipo === "auto" ? "" : "none";

  consultaEncargos.style.display =
    tipo === "encargos" ? "" : "none";

  consultaResumen.style.display =
    tipo === "resumen" ? "" : "none";

  consultaCorteTurno.style.display =
    tipo === "corte" ? "" : "none";

  consultaGastosReparto.style.display =
    tipo === "gastos" ? "" : "none";

  btnConsultaAutoServicio.classList.toggle(
    "active",
    tipo === "auto"
  );

  btnConsultaEncargos.classList.toggle(
    "active",
    tipo === "encargos"
  );

  btnConsultaResumen.classList.toggle(
    "active",
    tipo === "resumen"
  );

  openCorteTurnoBtn.classList.toggle(
    "active",
    tipo === "corte"
  );

  btnGastosReparto.classList.toggle(
    "active",
    tipo === "gastos"
  );
}

btnConsultaAutoServicio.addEventListener("click", () => {
  mostrarConsulta("auto");
});

btnConsultaEncargos.addEventListener("click", () => {
  mostrarConsulta("encargos");
});

btnConsultaResumen.addEventListener("click", () => {
  mostrarConsulta("resumen");
});

openCorteTurnoBtn.addEventListener("click", () => {
  mostrarConsulta("corte");
});

btnGastosReparto.addEventListener("click", () => {
  mostrarConsulta("gastos");
  cargarCortesDisponiblesReparto();
});

async function generarCorteTurno() {
  ensureSupabase();

  const employee = corteEmployee.value;
  const fechaInicio = corteFechaInicio.value;
  const fechaFin = corteFechaFin.value;
  const horaInicio = corteHoraInicio.value.trim();
  const horaFin = corteHoraFin.value.trim();

  if (!employee) {
    corteStatus.textContent = "Selecciona el empleado.";
    return;
  }

  if (!fechaInicio || !fechaFin) {
    corteStatus.textContent =
      "Selecciona la fecha inicial y la fecha final.";
    return;
  }

  if (!horaInicio || !horaFin) {
    corteStatus.textContent = "Selecciona la hora inicial y la hora final.";
    return;
  }

  const horaInicioCompleta =
  horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio;

  const horaFinCompleta =
  horaFin.length === 5 ? `${horaFin}:00` : horaFin;

  const inicioLocal = new Date(
    `${fechaInicio}T${horaInicioCompleta}`
  );
  
  const finLocal = new Date(
    `${fechaFin}T${horaFinCompleta}`
  );

  if (finLocal <= inicioLocal) {
    corteStatus.textContent =
      "La hora final debe ser mayor que la hora inicial.";
    return;
  }

  corteStatus.textContent = "Generando corte... consultando movimientos de caja";

  const { data, error } = await supabaseClient
  .from("movimientos_caja")
  .select("metodo_pago, monto, origen, created_at")
  .eq("employee", employee)
  .gte("created_at", inicioLocal.toISOString())
  .lte("created_at", finLocal.toISOString())
  .order("created_at", { ascending: true });

  if (error) {
    console.error("Error al generar corte:", error);
    corteStatus.textContent =
      `❌ Error al generar corte: ${error.message}`;
    return;
  }

  let efectivo = 0;
  let transferencias = 0;

  for (const movimiento of data || []) {
    const monto = Number(movimiento.monto || 0);

    if (movimiento.metodo_pago === "efectivo") {
      efectivo += monto;
    }

    if (movimiento.metodo_pago === "transferencia") {
      transferencias += monto;
    }
  }

  const totalCobrado = efectivo + transferencias;

  corteStatus.textContent = "Generando corte... consultando fichas";

  const { data: fichasData, error: fichasError } = await supabaseClient
  .from("movimientos_fichas")
  .select("origen, concepto, cantidad, created_at")
  .eq("employee", employee)
  .gte("created_at", inicioLocal.toISOString())
  .lte("created_at", finLocal.toISOString())
  .order("created_at", { ascending: true });

if (fichasError) {
  console.error("Error al cargar fichas del corte:", fichasError);

  corteStatus.textContent =
    `❌ Error al cargar fichas: ${fichasError.message}`;

  return;
}

const fichasAuto = {};
const fichasEncargos = {};
const fichasTotal = {};

for (const ficha of fichasData || []) {
  const concepto = ficha.concepto;
  const cantidad = Number(ficha.cantidad || 0);

  if (ficha.origen === "auto_servicio") {
    fichasAuto[concepto] =
      Number(fichasAuto[concepto] || 0) + cantidad;
  }

  if (ficha.origen === "encargo") {
    fichasEncargos[concepto] =
      Number(fichasEncargos[concepto] || 0) + cantidad;
  }

  fichasTotal[concepto] =
    Number(fichasTotal[concepto] || 0) + cantidad;
}

ultimoCorteGenerado = {
  employee,
  inicio: inicioLocal.toISOString(),
  fin: finLocal.toISOString(),
  efectivo,
  transferencias,
  total_cobrado: totalCobrado,
  fichas_auto: fichasAuto,
  fichas_encargos: fichasEncargos,
  fichas_total: fichasTotal
};

guardarCorteBtn.disabled = false;

function fichasHTML(mapa) {
  const entradas = Object.entries(mapa);

  if (entradas.length === 0) {
    return `<div class="muted">Sin fichas registradas.</div>`;
  }

  return entradas
    .map(([concepto, cantidad]) => `
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <span>${concepto}</span>
        <strong>${cantidad}</strong>
      </div>
    `)
    .join("");
}

corteStatus.innerHTML = `
<div class="block" style="margin-top:12px;">

  <div>
    <strong>Empleado:</strong> ${employee}
  </div>

  <div>
    <strong>Inicio:</strong>
    ${fechaInicio} ${horaInicio}
  </div>

  <div>
    <strong>Fin:</strong>
    ${fechaFin} ${horaFin}
  </div>

  <hr class="sep" />

  <div><strong>Efectivo:</strong> ${money(efectivo)}</div>
  <div><strong>Transferencias:</strong> ${money(transferencias)}</div>
  <div><strong>Total cobrado:</strong> ${money(totalCobrado)}</div>

  <hr class="sep" />

  <h3>Fichas de Auto servicio</h3>
  ${fichasHTML(fichasAuto)}

  <hr class="sep" />

  <h3>Fichas de Encargos</h3>
  ${fichasHTML(fichasEncargos)}

  <hr class="sep" />

  <h3>Total general de fichas</h3>
  ${fichasHTML(fichasTotal)}

</div>
`;

}

generarCorteBtn.addEventListener("click", generarCorteTurno);

guardarCorteBtn.addEventListener("click", async () => {
  if (!ultimoCorteGenerado) {
    corteStatus.textContent =
      "Primero genera un corte antes de guardarlo.";
    return;
  }

  guardarCorteBtn.disabled = true;
  corteStatus.textContent = "Guardando corte...";

  const { data, error } = await supabaseClient
    .from("cortes_turno")
    .insert(ultimoCorteGenerado)
    .select("id")
    .single();

  if (error) {
    console.error("Error al guardar corte:", error);

    corteStatus.textContent =
      `❌ Error al guardar el corte: ${error.message}`;

    guardarCorteBtn.disabled = false;
    return;
  }

  corteStatus.innerHTML += `
    <div style="margin-top:12px;">
      ✅ Corte guardado correctamente.
      <br>
      <strong>Folio de corte:</strong> ${data.id}
    </div>
  `;

  ultimoCorteGenerado = null;
  guardarCorteBtn.disabled = true;
});

async function cargarHistorialCortes() {
  ensureSupabase();

  historialCortesStatus.textContent = "Cargando cortes...";
  historialCortesBody.innerHTML = "";

  const desde = historialPaginaActual * historialTamanoPagina;
  const hasta = desde + historialTamanoPagina;

  let q = supabaseClient
  .from("cortes_turno")
  .select(`
    id,
    employee,
    inicio,
    fin,
    efectivo,
    transferencias,
    total_cobrado,
    created_at
  `)
  .order("created_at", { ascending: false })
  .range(desde, hasta);

  if (historialCorteDesde.value) {
    q = q.gte(
      "inicio",
      localDateStartISO(historialCorteDesde.value)
    );
  }

  if (historialCorteHasta.value) {
    q = q.lte(
      "fin",
      localDateEndISO(historialCorteHasta.value)
    );
  }

  if (historialCorteEmpleado.value) {
    q = q.eq("employee", historialCorteEmpleado.value);
  }

  const { data, error } = await q;

  if (error) {
    console.error("Error al cargar historial:", error);

    historialCortesStatus.textContent =
      `❌ Error al cargar cortes: ${error.message}`;

    return;
  }

  const resultados = data || [];

  historialHayMas =
    resultados.length > historialTamanoPagina;
  
  const cortesPagina =
    resultados.slice(0, historialTamanoPagina);


    if (cortesPagina.length === 0) {
    historialCortesStatus.textContent =
      "No hay cortes con esos filtros.";
    return;
  }

  historialCortesStatus.textContent =
  `Mostrando ${cortesPagina.length} corte(s).`;

  for (const corte of cortesPagina) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${corte.id}</td>
      <td>${corte.employee || ""}</td>
      <td>${formatDateTime(corte.inicio)}</td>
      <td>${formatDateTime(corte.fin)}</td>
      <td>${money(corte.efectivo || 0)}</td>
      <td>${money(corte.transferencias || 0)}</td>
      <td>${money(corte.total_cobrado || 0)}</td>
      <td style="text-align:right;">
        <button
          type="button"
          class="addBtn"
          data-ver-corte="${corte.id}"
          style="width:auto; padding:8px 10px;"
        >
          Ver detalle
        </button>
      </td>
    `;

    historialCortesBody.appendChild(tr);
  }
}

async function cargarCortesDisponiblesReparto() {
  ensureSupabase();

  repartoCortesStatus.textContent = "Cargando cortes disponibles...";
  repartoCortesBody.innerHTML = "";

  cortesDisponiblesReparto = [];
  cortesSeleccionadosReparto = [];

  repartoGranTotal.textContent = money(0);
  repartoTotalSalidas.textContent = money(0);
  repartoRestante.textContent = money(0);

  // 1. Saber qué cortes ya fueron usados en un reparto
  const { data: cortesUsados, error: cortesUsadosError } =
    await supabaseClient
      .from("reparto_cortes_detalle")
      .select("corte_id");

  if (cortesUsadosError) {
    console.error(cortesUsadosError);
    repartoCortesStatus.textContent =
      `❌ Error al revisar cortes usados: ${cortesUsadosError.message}`;
    return;
  }

  const idsUsados = new Set(
    (cortesUsados || []).map((row) => String(row.corte_id))
  );

  // 2. Cargar todos los cortes cerrados
  const { data: cortes, error: cortesError } =
    await supabaseClient
      .from("cortes_turno")
      .select(`
        id,
        employee,
        inicio,
        fin,
        efectivo,
        transferencias,
        total_cobrado,
        created_at
      `)
      .order("created_at", { ascending: false });

  if (cortesError) {
    console.error(cortesError);
    repartoCortesStatus.textContent =
      `❌ Error al cargar cortes: ${cortesError.message}`;
    return;
  }

  // 3. Quitar los cortes que ya pertenecen a otro reparto
  cortesDisponiblesReparto = (cortes || []).filter(
    (corte) => !idsUsados.has(String(corte.id))
  );

  if (cortesDisponiblesReparto.length === 0) {
    repartoCortesBody.innerHTML = `
      <tr>
        <td colspan="7" class="muted">
          No hay cortes disponibles para repartir.
        </td>
      </tr>
    `;

    repartoCortesStatus.textContent =
      "No hay cortes cerrados disponibles.";
    return;
  }

  // 4. Mostrar los cortes disponibles
  repartoCortesBody.innerHTML = cortesDisponiblesReparto
    .map(
      (corte) => `
        <tr>
          <td>
            <input
              type="checkbox"
              class="repartoCorteCheck"
              data-corte-id="${corte.id}"
            />
          </td>

          <td>${corte.employee || "-"}</td>

          <td>${formatDateTime(corte.inicio)}</td>

          <td>${formatDateTime(corte.fin)}</td>

          <td>${money(Number(corte.efectivo || 0))}</td>

          <td>${money(Number(corte.transferencias || 0))}</td>

          <td><strong>${money(Number(corte.total_cobrado || 0))}</strong></td>
        </tr>
      `
    )
    .join("");

  repartoCortesStatus.textContent =
    `${cortesDisponiblesReparto.length} corte(s) disponible(s).`;
}

function actualizarTotalesReparto() {
  cortesSeleccionadosReparto = [];

  const checks = document.querySelectorAll(".repartoCorteCheck:checked");

  for (const check of checks) {
    const corteId = String(check.dataset.corteId);

    const corte = cortesDisponiblesReparto.find(
      (item) => String(item.id) === corteId
    );

    if (corte) {
      cortesSeleccionadosReparto.push(corte);
    }
  }

  const totalEfectivo = cortesSeleccionadosReparto.reduce(
    (suma, corte) =>
      suma + Number(corte.efectivo || 0),
    0
  );
  
  const totalTransferencias = cortesSeleccionadosReparto.reduce(
    (suma, corte) =>
      suma + Number(corte.transferencias || 0),
    0
  );
  
  const granTotal = totalEfectivo + totalTransferencias;
  
  const totalSalidas = gastosReparto.reduce(
    (suma, gasto) =>
      suma + Number(gasto.monto || 0),
    0
  );
  
  const efectivoRestante = totalEfectivo - totalSalidas;
  const restante = efectivoRestante + totalTransferencias;
  
  repartoEfectivo.textContent = money(totalEfectivo);
  repartoTransferencias.textContent = money(totalTransferencias);
  repartoGranTotal.textContent = money(granTotal);
  repartoTotalSalidas.textContent = money(totalSalidas);
  repartoEfectivoRestante.textContent = money(efectivoRestante);
  repartoRestante.textContent = money(restante);

  guardarRepartoBtn.disabled =
  cortesSeleccionadosReparto.length === 0 ||
  gastosReparto.length === 0;
}

function renderGastosReparto() {
  if (gastosReparto.length === 0) {
    repartoGastosBody.innerHTML = `
      <tr>
        <td colspan="3" class="muted">
          Aún no agregas gastos.
        </td>
      </tr>
    `;
    return;
  }

  repartoGastosBody.innerHTML = gastosReparto
    .map(
      (gasto, index) => `
        <tr>
          <td>${gasto.concepto}</td>
          <td>${money(gasto.monto)}</td>
          <td>
            <button
              type="button"
              class="iconBtn quitarGastoRepartoBtn"
              data-index="${index}"
            >
              Quitar
            </button>
          </td>
        </tr>
      `
    )
    .join("");
}

if (agregarGastoRepartoBtn) {
  agregarGastoRepartoBtn.addEventListener("click", () => {
    const concepto = repartoConcepto.value.trim();
    const monto = Number(repartoMonto.value || 0);

    if (!concepto) {
      repartoStatus.textContent =
        "❌ Escribe el concepto del gasto.";
      return;
    }

    if (monto <= 0) {
      repartoStatus.textContent =
        "❌ El monto debe ser mayor a $0.";
      return;
    }

    const efectivoDisponible = cortesSeleccionadosReparto.reduce(
      (suma, corte) =>
        suma + Number(corte.efectivo || 0),
      0
    );
    
    const totalActual = gastosReparto.reduce(
      (suma, gasto) =>
        suma + Number(gasto.monto || 0),
      0
    );
    
    if (totalActual + monto > efectivoDisponible) {
      repartoStatus.textContent =
        "❌ El gasto supera el efectivo disponible.";
      return;
    }

    gastosReparto.push({
      concepto,
      monto
    });

    repartoConcepto.value = "";
    repartoMonto.value = 0;
    repartoStatus.textContent = "";

    renderGastosReparto();
    actualizarTotalesReparto();
  });
}

if (repartoGastosBody) {
  repartoGastosBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".quitarGastoRepartoBtn");
    if (!btn) return;

    const index = Number(btn.dataset.index);

    gastosReparto.splice(index, 1);

    renderGastosReparto();
    actualizarTotalesReparto();
  });
}

if (guardarRepartoBtn) {
  guardarRepartoBtn.addEventListener("click", async () => {
    ensureSupabase();

    if (cortesSeleccionadosReparto.length === 0) {
      repartoStatus.textContent =
        "❌ Selecciona al menos un corte.";
      return;
    }

    if (gastosReparto.length === 0) {
      repartoStatus.textContent =
        "❌ Agrega al menos un gasto o salida.";
      return;
    }

    const totalEfectivo = cortesSeleccionadosReparto.reduce(
      (suma, corte) =>
        suma + Number(corte.efectivo || 0),
      0
    );
    
    const totalTransferencias = cortesSeleccionadosReparto.reduce(
      (suma, corte) =>
        suma + Number(corte.transferencias || 0),
      0
    );
    
    const granTotal = totalEfectivo + totalTransferencias;
    
    const totalSalidas = gastosReparto.reduce(
      (suma, gasto) =>
        suma + Number(gasto.monto || 0),
      0
    );
    
    const efectivoRestante = totalEfectivo - totalSalidas;
    const restante = efectivoRestante + totalTransferencias;
    
    if (efectivoRestante < 0) {
      repartoStatus.textContent =
        "❌ Las salidas superan el efectivo disponible.";
      return;
    }

    guardarRepartoBtn.disabled = true;
    repartoStatus.textContent = "Guardando reparto...";

    let repartoId = null;

    try {
      // 1. Crear reparto principal
      const { data: repartoCreado, error: repartoError } =
        await supabaseClient
          .from("repartos_cortes")
          .insert({
            efectivo_cortes: totalEfectivo,
            transferencias_cortes: totalTransferencias,
            total_cortes: granTotal,
            total_salidas: totalSalidas,
            efectivo_restante: efectivoRestante,
            restante: restante
          })
          .select("id")
          .single();
    
      if (repartoError) throw repartoError;
    
      repartoId = repartoCreado.id;

      // 2. Relacionar los cortes seleccionados
      const cortesDetalle = cortesSeleccionadosReparto.map(
        (corte) => ({
          reparto_id: repartoId,
          corte_id: corte.id
        })
      );

      const { error: cortesDetalleError } =
        await supabaseClient
          .from("reparto_cortes_detalle")
          .insert(cortesDetalle);

      if (cortesDetalleError) throw cortesDetalleError;

      // 3. Guardar los gastos
      const gastosDetalle = gastosReparto.map(
        (gasto) => ({
          reparto_id: repartoId,
          concepto: gasto.concepto,
          monto: gasto.monto
        })
      );

      const { error: gastosError } =
        await supabaseClient
          .from("reparto_gastos")
          .insert(gastosDetalle);

      if (gastosError) throw gastosError;

      repartoStatus.textContent =
        `✅ Reparto guardado correctamente. ID: ${repartoId}`;

      // 4. Limpiar pantalla
      gastosReparto = [];
      cortesSeleccionadosReparto = [];

      repartoConcepto.value = "";
      repartoMonto.value = 0;

      renderGastosReparto();

      repartoGranTotal.textContent = money(0);
      repartoTotalSalidas.textContent = money(0);
      repartoRestante.textContent = money(0);

      // 5. Recargar cortes disponibles
      await cargarCortesDisponiblesReparto();

      // 6. Actualizar historial automáticamente
      await cargarHistorialRepartos();

    } catch (err) {
      console.error("Error al guardar reparto:", err);

      // Si algo falló después de crear el reparto,
      // eliminamos el reparto incompleto.
      if (repartoId) {
        await supabaseClient
          .from("repartos_cortes")
          .delete()
          .eq("id", repartoId);
      }

      repartoStatus.textContent =
        `❌ Error al guardar reparto: ${err.message || "Error desconocido"}`;

      guardarRepartoBtn.disabled = false;
    }
  });
}

async function cargarHistorialRepartos() {
  ensureSupabase();

  historialRepartosStatus.textContent = "Cargando historial...";
  historialRepartosBody.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("repartos_cortes")
    .select(`
      id,
      created_at,
      efectivo_cortes,
      transferencias_cortes,
      total_cortes,
      total_salidas,
      efectivo_restante,
      restante
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    historialRepartosStatus.textContent =
      `❌ Error al cargar historial: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    historialRepartosBody.innerHTML = `
      <tr>
        <td colspan="6" class="muted">
          No hay repartos guardados.
        </td>
      </tr>
    `;

    historialRepartosStatus.textContent =
      "No hay repartos guardados.";
    return;
  }

  historialRepartosBody.innerHTML = data
  .map(
    (row) => `
      <tr>
        <td>${row.id}</td>
        <td>${formatDateTime(row.created_at)}</td>
        <td>${money(Number(row.efectivo_cortes || 0))}</td>
        <td>${money(Number(row.transferencias_cortes || 0))}</td>
        <td>${money(Number(row.total_cortes || 0))}</td>
        <td>${money(Number(row.total_salidas || 0))}</td>
        <td>${money(Number(row.efectivo_restante || 0))}</td>
        <td>${money(Number(row.restante || 0))}</td>
        <td>
          <button
            type="button"
            class="ghost abrirDetalleRepartoBtn"
            data-reparto-id="${row.id}"
            style="width:auto;"
          >
            Abrir
          </button>
        </td>
      </tr>
    `
  )
  .join("");

  historialRepartosStatus.textContent =
    `${data.length} reparto(s) encontrado(s).`;
}

if (cargarHistorialRepartosBtn) {
  cargarHistorialRepartosBtn.addEventListener("click", () => {
    cargarHistorialRepartos();
  });
}

async function abrirDetalleReparto(repartoId) {
  ensureSupabase();

  detalleRepartoPanel.style.display = "";
  detalleRepartoCortesBody.innerHTML = "";
  detalleRepartoGastosBody.innerHTML = "";

  // 1. Cargar datos generales del reparto
  const { data: reparto, error: repartoError } =
    await supabaseClient
      .from("repartos_cortes")
      .select(`
        id,
        created_at,
        efectivo_cortes,
        transferencias_cortes,
        total_cortes,
        total_salidas,
        efectivo_restante,
        restante
      `)
      .eq("id", repartoId)
      .single();

  if (repartoError) {
    console.error(repartoError);
    detalleRepartoPanel.style.display = "none";
    historialRepartosStatus.textContent =
      `❌ Error al abrir reparto: ${repartoError.message}`;
    return;
  }

  detalleRepartoId.textContent = reparto.id;
  detalleRepartoFecha.textContent =
    formatDateTime(reparto.created_at);

    detalleRepartoEfectivo.textContent =
    money(Number(reparto.efectivo_cortes || 0));
  
  detalleRepartoTransferencias.textContent =
    money(Number(reparto.transferencias_cortes || 0));
  
  detalleRepartoTotalCortes.textContent =
    money(Number(reparto.total_cortes || 0));
  
  detalleRepartoTotalSalidas.textContent =
    money(Number(reparto.total_salidas || 0));
  
  detalleRepartoEfectivoRestante.textContent =
    money(Number(reparto.efectivo_restante || 0));
  
  detalleRepartoRestante.textContent =
    money(Number(reparto.restante || 0));

  // 2. Saber qué cortes pertenecen a este reparto
  const { data: detallesCortes, error: detallesError } =
    await supabaseClient
      .from("reparto_cortes_detalle")
      .select("corte_id")
      .eq("reparto_id", repartoId);

  if (detallesError) {
    console.error(detallesError);
    historialRepartosStatus.textContent =
      `❌ Error al cargar cortes: ${detallesError.message}`;
    return;
  }

  const corteIds = (detallesCortes || []).map(
    (row) => row.corte_id
  );

  if (corteIds.length > 0) {
    const { data: cortes, error: cortesError } =
      await supabaseClient
        .from("cortes_turno")
        .select(`
          id,
          employee,
          inicio,
          fin,
          total_cobrado
        `)
        .in("id", corteIds);

    if (cortesError) {
      console.error(cortesError);
      historialRepartosStatus.textContent =
        `❌ Error al cargar detalle de cortes: ${cortesError.message}`;
      return;
    }

    detalleRepartoCortesBody.innerHTML = (cortes || [])
      .map(
        (corte) => `
          <tr>
            <td>${corte.employee || "-"}</td>
            <td>${formatDateTime(corte.inicio)}</td>
            <td>${formatDateTime(corte.fin)}</td>
            <td>${money(Number(corte.total_cobrado || 0))}</td>
          </tr>
        `
      )
      .join("");
  }

  // 3. Cargar gastos del reparto
  const { data: gastos, error: gastosError } =
    await supabaseClient
      .from("reparto_gastos")
      .select(`
        concepto,
        monto
      `)
      .eq("reparto_id", repartoId)
      .order("id", { ascending: true });

  if (gastosError) {
    console.error(gastosError);
    historialRepartosStatus.textContent =
      `❌ Error al cargar gastos: ${gastosError.message}`;
    return;
  }

  detalleRepartoGastosBody.innerHTML = (gastos || [])
    .map(
      (gasto) => `
        <tr>
          <td>${gasto.concepto}</td>
          <td>${money(Number(gasto.monto || 0))}</td>
        </tr>
      `
    )
    .join("");

  historialRepartosStatus.textContent = "";
}

if (historialRepartosBody) {
  historialRepartosBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".abrirDetalleRepartoBtn");
    if (!btn) return;

    const repartoId = btn.dataset.repartoId;

    abrirDetalleReparto(repartoId);
  });
}

if (cerrarDetalleRepartoBtn) {
  cerrarDetalleRepartoBtn.addEventListener("click", () => {
    detalleRepartoPanel.style.display = "none";
  });
}

renderGastosReparto();

if (repartoCortesBody) {
  repartoCortesBody.addEventListener("change", (e) => {
    if (!e.target.classList.contains("repartoCorteCheck")) return;

    actualizarTotalesReparto();
  });
}

historialPaginaInfo.textContent =
  `Página ${historialPaginaActual + 1}`;

historialAnteriorBtn.disabled =
  historialPaginaActual === 0;

historialSiguienteBtn.disabled =
  !historialHayMas;

function renderDetalleFichas(target, mapa) {
  target.innerHTML = "";

  const entradas = Object.entries(mapa || {});

  if (entradas.length === 0) {
    target.innerHTML =
      `<div class="muted">Sin fichas registradas.</div>`;
    return;
  }

  for (const [concepto, cantidad] of entradas) {
    const div = document.createElement("div");

    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.gap = "12px";
    div.style.marginBottom = "6px";

    div.innerHTML = `
      <span>${concepto}</span>
      <strong>${cantidad}</strong>
    `;

    target.appendChild(div);
  }
}

async function verDetalleCorte(corteId) {
  ensureSupabase();

  detalleCortePanel.style.display = "block";

  const { data, error } = await supabaseClient
    .from("cortes_turno")
    .select(`
      id,
      employee,
      inicio,
      fin,
      efectivo,
      transferencias,
      total_cobrado,
      fichas_auto,
      fichas_encargos,
      fichas_total
    `)
    .eq("id", corteId)
    .single();

  if (error) {
    console.error("Error al cargar detalle del corte:", error);
    historialCortesStatus.textContent =
      `❌ Error al cargar detalle: ${error.message}`;
    return;
  }

  detalleCorteId.textContent = data.id;
  detalleCorteEmpleado.textContent = data.employee || "-";
  detalleCorteInicio.textContent = formatDateTime(data.inicio);
  detalleCorteFin.textContent = formatDateTime(data.fin);

  detalleCorteEfectivo.textContent = money(data.efectivo || 0);
  detalleCorteTransferencias.textContent =
    money(data.transferencias || 0);
  detalleCorteTotal.textContent = money(data.total_cobrado || 0);

  renderDetalleFichas(detalleFichasAuto, data.fichas_auto);
  renderDetalleFichas(detalleFichasEncargos, data.fichas_encargos);
  renderDetalleFichas(detalleFichasTotal, data.fichas_total);
}

historialCortesBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const corteId = btn.dataset.verCorte;
  if (!corteId) return;

  verDetalleCorte(corteId);
});

cerrarDetalleCorteBtn.addEventListener("click", () => {
  detalleCortePanel.style.display = "none";
});


cargarHistorialCortesBtn.addEventListener("click", () => {
  historialPaginaActual = 0;
  cargarHistorialCortes();
});

historialAnteriorBtn.addEventListener("click", () => {
  if (historialPaginaActual <= 0) return;

  historialPaginaActual--;
  cargarHistorialCortes();
});

historialSiguienteBtn.addEventListener("click", () => {
  if (!historialHayMas) return;

  historialPaginaActual++;
  cargarHistorialCortes();
});

consultaAutoServicio.style.display = "none";
consultaEncargos.style.display = "none";
consultaResumen.style.display = "none";

btnConsultaAutoServicio.classList.remove("active");
btnConsultaEncargos.classList.remove("active");
btnConsultaResumen.classList.remove("active");

logoutBtn.addEventListener("click", () => {
  viewSalesSection.style.display = "none";

  consultaAutoServicio.style.display = "none";
  consultaEncargos.style.display = "none";
  consultaResumen.style.display = "none";

  btnConsultaAutoServicio.classList.remove("active");
  btnConsultaEncargos.classList.remove("active");
  btnConsultaResumen.classList.remove("active");

  salesBody.innerHTML = "";
  detailPanel.style.display = "none";
  detailBody.innerHTML = "";
  salesSummary.style.display = "none";
  salesStatus.textContent = "";
  summaryCount.textContent = "0";
  summaryTotal.textContent = "$0";

  resetViewEncargosSection();

  accessStatus.textContent = "Sesión cerrada.";
  adminPasswordEl.value = "";
});

// =====================
// Encargos: formulario
// =====================
const encargoForm = $("#encargoForm");
const encargoEmployee = $("#encargoEmployee");
const encargoClientName = $("#encargoClientName");
const encargoClientPhone = $("#encargoClientPhone");
const encargoKilos = $("#encargoKilos");
const encargoServiceType = $("#encargoServiceType");
const encargoKilosField = $("#encargoKilosField");
const encargoExpressField = $("#encargoExpressField");
const encargoExpressPrice = $("#encargoExpressPrice");
const encargoExpressKilosField = $("#encargoExpressKilosField");
const encargoExpressKilos = $("#encargoExpressKilos");

const edredonIndividual = $("#edredonIndividual");
const edredonMatrimonial = $("#edredonMatrimonial");
const edredonKing = $("#edredonKing");

const colchaIndividual = $("#colchaIndividual");
const colchaMatrimonial = $("#colchaMatrimonial");
const colchaKing = $("#colchaKing");

const mantelesKilos = $("#mantelesKilos");

const almohadasChico = $("#almohadasChico");
const almohadasMediano = $("#almohadasMediano");
const almohadasGrande = $("#almohadasGrande");

const almohadasPeluchesPrice = $("#almohadasPeluchesPrice");

const encargoPaymentStatus = $("#encargoPaymentStatus");
const encargoAmountPaid = $("#encargoAmountPaid");

const encargoTotal = $("#encargoTotal");
const encargoResult = $("#encargoResult");
const encargoResultLabel = $("#encargoResultLabel");
const encargoStatus = $("#encargoStatus");
const saveEncargoBtn = $("#saveEncargoBtn");
const newEncargoBtn = $("#newEncargoBtn");
const printEncargoBtn = $("#printEncargoBtn");

function num(val) {
  return Number(val || 0);
}

// =====================
// Artículos del encargo
// Almohadas, Peluches, Frazadas y Otros
// =====================
let encargoArticulos = [];

const articuloTipo = $("#articuloTipo");
const articuloOtroField = $("#articuloOtroField");
const articuloOtroNombre = $("#articuloOtroNombre");
const articuloTamano = $("#articuloTamano");
const articuloCantidad = $("#articuloCantidad");
const articuloPrecio = $("#articuloPrecio");
const agregarArticuloEncargoBtn = $("#agregarArticuloEncargoBtn");

const encargoArticulosBody = $("#encargoArticulosBody");
const encargoArticulosEmpty = $("#encargoArticulosEmpty");
const encargoArticulosTotal = $("#encargoArticulosTotal");
const encargoArticulosStatus = $("#encargoArticulosStatus");

function calcEncargoArticulosTotal() {
  return wholeMoney(
    encargoArticulos.reduce((total, articulo) => {
      return total + Number(articulo.cantidad) * Number(articulo.precio);
    }, 0)
  );
}

function syncLegacyArticuloFields() {
  let totalChico = 0;
  let totalMediano = 0;
  let totalGrande = 0;

  for (const articulo of encargoArticulos) {
    const cantidad = Number(articulo.cantidad || 0);

    if (articulo.tamano === "Chico") {
      totalChico += cantidad;
    }

    if (articulo.tamano === "Mediano") {
      totalMediano += cantidad;
    }

    if (articulo.tamano === "Grande") {
      totalGrande += cantidad;
    }
  }

  /*
    Conservamos actualizados los campos anteriores.
    Así no se rompe la lógica actual del encargo.
  */
  almohadasChico.value = totalChico;
  almohadasMediano.value = totalMediano;
  almohadasGrande.value = totalGrande;
  almohadasPeluchesPrice.value = calcEncargoArticulosTotal();
}

function renderEncargoArticulos() {
  if (!encargoArticulosBody) return;

  encargoArticulosBody.innerHTML = "";

  if (encargoArticulos.length === 0) {
    encargoArticulosBody.innerHTML = `
      <tr id="encargoArticulosEmpty">
        <td colspan="6" class="muted">
          Aún no agregas artículos.
        </td>
      </tr>
    `;
  } else {
    for (const articulo of encargoArticulos) {
      const subtotal =
        Number(articulo.cantidad) * Number(articulo.precio);

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${articulo.tipo}</td>
        <td>${articulo.tamano}</td>
        <td>${articulo.cantidad}</td>
        <td>${money(articulo.precio)}</td>
        <td>${money(subtotal)}</td>
        <td style="text-align:right;">
          <button
            type="button"
            class="iconBtn"
            data-remove-articulo="${articulo.id}"
          >
            Quitar
          </button>
        </td>
      `;

      encargoArticulosBody.appendChild(tr);
    }
  }

  const totalArticulos = calcEncargoArticulosTotal();

  if (encargoArticulosTotal) {
    encargoArticulosTotal.textContent = money(totalArticulos);
  }

  syncLegacyArticuloFields();

  /*
    La función actual toma el valor de
    almohadasPeluchesPrice y lo suma al total.
  */
  updateEncargoSummary();
}

function resetArticuloForm() {
  if (articuloTipo) articuloTipo.value = "Almohada";
  if (articuloTamano) articuloTamano.value = "Chico";
  if (articuloCantidad) articuloCantidad.value = 1;
  if (articuloPrecio) articuloPrecio.value = 0;
  if (articuloOtroNombre) articuloOtroNombre.value = "";
  if (articuloOtroField) articuloOtroField.style.display = "none";
}

function clearEncargoArticulos() {
  encargoArticulos = [];

  if (encargoArticulosStatus) {
    encargoArticulosStatus.textContent = "";
  }

  resetArticuloForm();
  renderEncargoArticulos();
}

if (articuloTipo) {
  articuloTipo.addEventListener("change", () => {
    const esOtro = articuloTipo.value === "Otro";

    if (articuloOtroField) {
      articuloOtroField.style.display = esOtro ? "" : "none";
    }

    if (!esOtro && articuloOtroNombre) {
      articuloOtroNombre.value = "";
    }
  });
}

if (agregarArticuloEncargoBtn) {
  agregarArticuloEncargoBtn.addEventListener("click", () => {
    const tipoSeleccionado = articuloTipo.value;
    const otroNombre = articuloOtroNombre.value.trim();

    const tipo =
      tipoSeleccionado === "Otro"
        ? otroNombre
        : tipoSeleccionado;

    const tamano = articuloTamano.value;
    const cantidad = Number(articuloCantidad.value || 0);
    const precio = Number(articuloPrecio.value || 0);

    if (!tipo) {
      encargoArticulosStatus.textContent =
        "Escribe el nombre del artículo.";
      return;
    }

    if (!tamano) {
      encargoArticulosStatus.textContent =
        "Selecciona el tamaño.";
      return;
    }

    if (!Number.isInteger(cantidad) || cantidad < 1) {
      encargoArticulosStatus.textContent =
        "La cantidad debe ser de al menos 1.";
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      encargoArticulosStatus.textContent =
        "Escribe un precio válido.";
      return;
    }

    encargoArticulos.push({
      id: crypto.randomUUID(),
      tipo,
      tamano,
      cantidad,
      precio: wholeMoney(precio),
    });

    encargoArticulosStatus.textContent = "";
    resetArticuloForm();
    renderEncargoArticulos();
  });
}

if (encargoArticulosBody) {
  encargoArticulosBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const articuloId = btn.dataset.removeArticulo;
    if (!articuloId) return;

    encargoArticulos = encargoArticulos.filter(
      (articulo) => articulo.id !== articuloId
    );

    renderEncargoArticulos();
  });
}

renderEncargoArticulos();

function toggleEncargoService() {
  const express = encargoServiceType.value === "express";

  encargoKilosField.style.display = express ? "none" : "";
  encargoExpressField.style.display = "none";

  encargoExpressKilosField.style.display = express ? "" : "none";

  if (express) {
    encargoKilos.value = 0;
  } else {
    encargoExpressPrice.value = 0;
  }

  updateEncargoSummary();
}

function updateExpressPrice() {
  const kilos = num(encargoExpressKilos.value);

  if (kilos <= 0) {
    encargoExpressPrice.value = 0;
  } else {
    const kilosBase = kilos < 4 ? 4 : kilos;
    encargoExpressPrice.value = wholeMoney(kilosBase * 30);
  }

  updateEncargoSummary();
}

function calcEncargoTotal() {
  const isExpress = encargoServiceType.value === "express";

  const kilos = num(encargoKilos.value);
  const kilosBase = kilos > 0 && kilos < 4 ? 4 : kilos;
  const kilosSubtotal = isExpress ? 0 : kilosBase * 26;

  const expressSubtotal = isExpress ? num(encargoExpressPrice.value) : 0;

  const edredonSubtotal =
    num(edredonIndividual.value) * 95 +
    num(edredonMatrimonial.value) * 100 +
    num(edredonKing.value) * 110;

  const colchaSubtotal =
    num(colchaIndividual.value) * 90 +
    num(colchaMatrimonial.value) * 95 +
    num(colchaKing.value) * 100;

  const mantelesSubtotal = num(mantelesKilos.value) * 55;

  const almohadasSubtotal = num(almohadasPeluchesPrice.value);

  return wholeMoney(
    kilosSubtotal +
    expressSubtotal +
    edredonSubtotal +
    colchaSubtotal +
    mantelesSubtotal +
    almohadasSubtotal
  );
}

function updateEncargoSummary() {
  const total = calcEncargoTotal();
  const paid = wholeMoney(encargoAmountPaid.value);
  const status = encargoPaymentStatus.value;

  encargoTotal.textContent = money(total);

  if (status === "pagado" || status === "transferencia") {
    const cambio = paid - total;
    encargoResultLabel.textContent = "Cambio";
    encargoResult.textContent = money(cambio);

    if (cambio < 0) {
      encargoResult.style.borderColor = "rgba(255,107,107,0.55)";
    } else {
      encargoResult.style.borderColor = "rgba(52,211,153,0.45)";
    }
  } else {
    const resto = total - paid;
    encargoResultLabel.textContent = "Falta";
    encargoResult.textContent = money(resto < 0 ? 0 : resto);
    encargoResult.style.borderColor = "rgba(255,255,255,0.15)";
  }
}

[
  encargoKilos,
  encargoServiceType,
  encargoExpressPrice,
  edredonIndividual,
  edredonMatrimonial,
  edredonKing,
  colchaIndividual,
  colchaMatrimonial,
  colchaKing,
  mantelesKilos,
  almohadasChico,
  almohadasMediano,
  almohadasGrande,
  almohadasPeluchesPrice,
  encargoAmountPaid,
  encargoPaymentStatus
].forEach((el) => {
  el.addEventListener("input", updateEncargoSummary);
  el.addEventListener("change", updateEncargoSummary);
});

encargoPaymentStatus.addEventListener("change", () => {
  const total = calcEncargoTotal();

  if (encargoPaymentStatus.value === "transferencia") {
    encargoAmountPaid.value = total;
    encargoAmountPaid.readOnly = true;
  } else {
    encargoAmountPaid.readOnly = false;
  }

  updateEncargoSummary();
});

encargoServiceType.addEventListener("change", toggleEncargoService);
encargoExpressKilos.addEventListener("input", updateExpressPrice);
encargoExpressKilos.addEventListener("change", updateExpressPrice);

async function saveEncargoToSupabase(payload) {
  ensureSupabase();

  const { data, error } = await supabaseClient
    .from("encargos")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}

async function saveEncargoArticulosToSupabase(encargoId, articulos) {
  ensureSupabase();

  if (!encargoId) {
    return {
      ok: false,
      error: "No se recibió el ID del encargo."
    };
  }

  if (!Array.isArray(articulos) || articulos.length === 0) {
    return {
      ok: true
    };
  }

  const articulosRows = articulos.map((articulo) => ({
    encargo_id: encargoId,
    tipo: articulo.tipo,
    tamano: articulo.tamano,
    cantidad: Number(articulo.cantidad || 1),
    importe: Number(articulo.precio || 0)
  }));

  const { error } = await supabaseClient
    .from("encargo_articulos")
    .insert(articulosRows);

  if (error) {
    console.error("Error al guardar artículos:", error);

    return {
      ok: false,
      error: error.message
    };
  }

  return {
    ok: true
  };
}

encargoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const employee = encargoEmployee.value;
  const clientName = encargoClientName.value.trim();
  const clientPhone = encargoClientPhone.value.trim();
  const kilos = num(encargoKilos.value);
  const expressKilos = num(encargoExpressKilos.value);

  const paymentStatus = encargoPaymentStatus.value;
  const amountPaid = wholeMoney(encargoAmountPaid.value);
  const total = calcEncargoTotal();

  if (!employee) {
    encargoStatus.textContent = "Selecciona el empleado.";
    return;
  }

  if (!clientName) {
    encargoStatus.textContent = "Escribe el nombre del cliente.";
    return;
  }

  if (total <= 0) {
    encargoStatus.textContent = "El encargo debe tener al menos un servicio.";
    return;
  }

  if (
    (paymentStatus === "pagado" || paymentStatus === "transferencia") &&
    amountPaid < total
  ) {
    encargoStatus.textContent = "Si está marcado como pagado, el monto debe cubrir el total.";
    return;
  }

  const isExpress = encargoServiceType.value === "express";
  const expressPrice = isExpress ? wholeMoney(encargoExpressPrice.value) : 0;
  
  const kilosBase = kilos > 0 && kilos < 4 ? 4 : kilos;
  const kilosSubtotal = isExpress ? 0 : wholeMoney(kilosBase * 26);
  
  const mantelesSubtotal = wholeMoney(num(mantelesKilos.value) * 55);
  const almohadasSubtotal = wholeMoney(almohadasPeluchesPrice.value);

  const cambio =
    paymentStatus === "pagado"
      ? wholeMoney(amountPaid - total)
      : 0;

  const amountDue =
    paymentStatus === "pendiente"
      ? wholeMoney(Math.max(total - amountPaid, 0))
      : 0;

  const payload = {
    employee,
    client_name: clientName,
    client_phone: clientPhone,

    is_express: isExpress,
    express_price: expressPrice,
    express_kilos: isExpress ? expressKilos : 0,
    
    kilos: isExpress ? 0 : kilos,
    kilos_price: isExpress ? 0 : 26,
    kilos_subtotal: kilosSubtotal,

    created_at: new Date().toISOString(),

    edredon_individual: num(edredonIndividual.value),
    edredon_matrimonial: num(edredonMatrimonial.value),
    edredon_king: num(edredonKing.value),

    colcha_individual: num(colchaIndividual.value),
    colcha_matrimonial: num(colchaMatrimonial.value),
    colcha_king: num(colchaKing.value),

    manteles_kilos: num(mantelesKilos.value),
    manteles_subtotal: mantelesSubtotal,

    almohadas_chico: num(almohadasChico.value),
    almohadas_mediano: num(almohadasMediano.value),
    almohadas_grande: num(almohadasGrande.value),

    almohadas_peluches_qty:
     num(almohadasChico.value) +
     num(almohadasMediano.value) +
     num(almohadasGrande.value),

   almohadas_peluches_price: num(almohadasPeluchesPrice.value),
   almohadas_peluches_subtotal: almohadasSubtotal,

    total,
    payment_status: paymentStatus,
    amount_paid: amountPaid,
    change: cambio,
    amount_due: amountDue,

    delivered_status: "pendiente",
    delivered_at: null,

    used_lavadora_16: 0,
    used_lavadora_9: 0,
    used_lavadora_4: 0,

    used_secadora_15: 0,
    used_secadora_30: 0,

    used_jabon: 0,
    used_suavizante: 0,
    used_desmugrante: 0,

    used_bolsa_chica: 0,
    used_bolsa_mediana: 0,
    used_bolsa_grande: 0,
  };

  encargoStatus.textContent = "Registrando encargo...";
  saveEncargoBtn.disabled = true;

  try {
    const res = await saveEncargoToSupabase(payload);
  
    if (!res.ok) {
      throw new Error(res.error || "No se pudo guardar el encargo.");
    }
  
    const articulosRes = await saveEncargoArticulosToSupabase(
      res.id,
      encargoArticulos
    );
  
    if (!articulosRes.ok) {
      /*
        Si fallan los artículos, eliminamos el encargo recién creado
        para evitar que quede guardado de forma incompleta.
      */
      await supabaseClient
        .from("encargos")
        .delete()
        .eq("id", res.id);
  
      throw new Error(
        articulosRes.error ||
        "No se pudieron guardar los artículos del encargo."
      );
    }

    if (amountPaid > 0) {
      const metodoPagoEncargo =
        paymentStatus === "transferencia"
          ? "transferencia"
          : "efectivo";
    
      const montoRealCobrado =
        paymentStatus === "pagado"
          ? Math.min(amountPaid, total)
          : amountPaid;
    
      const { error: movimientoEncargoError } = await supabaseClient
        .from("movimientos_caja")
        .insert({
          employee,
          origen: "encargo",
          metodo_pago: metodoPagoEncargo,
          monto: montoRealCobrado,
          referencia_id: String(res.id),
        });
    
      if (movimientoEncargoError) {
        throw new Error(
          "El encargo se guardó, pero no se pudo registrar el movimiento de caja: " +
          movimientoEncargoError.message
        );
      }
    }
  
    encargoStatus.textContent =
      `✅ Encargo registrado (ID: ${res.id}).`;
  
    newEncargoBtn.disabled = false;
    printEncargoBtn.disabled = false;
    lastEncargoId = res.id;
  } catch (err) {
    encargoStatus.textContent = `❌ Error: ${err.message || "No se pudo registrar el encargo."}`;
  } finally {
    saveEncargoBtn.disabled = false;
  }
});

newEncargoBtn.addEventListener("click", () => {
  encargoEmployee.selectedIndex = 0;
  encargoClientName.value = "";
  encargoClientPhone.value = "";
  encargoKilos.value = 0;
  encargoServiceType.value = "normal";
  encargoExpressPrice.value = 0;
  encargoExpressKilos.value = 0;
  toggleEncargoService();

  edredonIndividual.value = 0;
  edredonMatrimonial.value = 0;
  edredonKing.value = 0;

  colchaIndividual.value = 0;
  colchaMatrimonial.value = 0;
  colchaKing.value = 0;

  mantelesKilos.value = 0;

  almohadasChico.value = 0;
  almohadasMediano.value = 0;
  almohadasGrande.value = 0;

  almohadasPeluchesPrice.value = 0;

  clearEncargoArticulos();
 
  encargoPaymentStatus.value = "pagado";
  encargoAmountPaid.value = 0;

  encargoStatus.textContent = "";
  newEncargoBtn.disabled = true;

  printEncargoBtn.disabled = true;
  lastEncargoId = null;

  const encargosListBlock = $("#encargosListBlock");
  if (encargosListBlock) encargosListBlock.open = false;

  const serviciosAdicionalesBlock = $("#serviciosAdicionalesBlock");
  if (serviciosAdicionalesBlock) serviciosAdicionalesBlock.open = false;

  updateEncargoSummary();
});

printEncargoBtn.addEventListener("click", () => {
  if (!lastEncargoId) {
    encargoStatus.textContent = "Primero registra un encargo.";
    return;
  }

  printEncargoTicket(lastEncargoId);
});

toggleEncargoService();
updateEncargoSummary();

// =====================
// Lista y control de encargos
// =====================
const encargoFromDate = $("#encargoFromDate");
const encargoToDate = $("#encargoToDate");
const encargoEmployeeFilter = $("#encargoEmployeeFilter");
const loadEncargosBtn = $("#loadEncargosBtn");
const encargosBody = $("#encargosBody");
const encargosListStatus = $("#encargosListStatus");

const encargosListBlock = $("#encargosListBlock");
const encargoDetailPanel = $("#encargoDetailPanel");
const closeEncargoDetailBtn = $("#closeEncargoDetailBtn");
const saveEncargoUsageBtn = $("#saveEncargoUsageBtn");
const encargoDetailStatus = $("#encargoDetailStatus");

const detailEncargoId = $("#detailEncargoId");
const detailEncargoCliente = $("#detailEncargoCliente");
const detailEncargoEmpleado = $("#detailEncargoEmpleado");
const detailEncargoTotal = $("#detailEncargoTotal");
const detailUsoEmployee = $("#detailUsoEmployee");

const useLav16 = $("#useLav16");
const useLav9 = $("#useLav9");
const useLav4 = $("#useLav4");

const useSec15 = $("#useSec15");
const useSec30 = $("#useSec30");

const useJabon = $("#useJabon");
const useSuavizante = $("#useSuavizante");
const useDesmugrante = $("#useDesmugrante");

const useBolsaChica = $("#useBolsaChica");
const useBolsaMediana = $("#useBolsaMediana");
const useBolsaGrande = $("#useBolsaGrande");

const detailPaymentStatus = $("#detailPaymentStatus");
const detailAmountPaid = $("#detailAmountPaid");
const detailAbonoHoy = $("#detailAbonoHoy");
const detailAbonoMetodo = $("#detailAbonoMetodo");
const detailDelivered = $("#detailDelivered");
const detailPaymentResultLabel = $("#detailPaymentResultLabel");
const detailPaymentResult = $("#detailPaymentResult");

let currentEncargoId = null;
let currentEncargoTotal = 0;
let currentEncargoPaid = 0;

let usoAnteriorEncargo = {
  lav16: 0,
  lav9: 0,
  lav4: 0,
  sec15: 0,
  sec30: 0,
  jabon: 0,
  suavizante: 0,
  desmugrante: 0,
  bolsaChica: 0,
  bolsaMediana: 0,
  bolsaGrande: 0
};

(function setDefaultEncargoFilters() {
  const today = saleDateEl.value;
  if (encargoFromDate) encargoFromDate.value = today;
  if (encargoToDate) encargoToDate.value = today;
})();

function clearEncargosTable() {
  if (encargosBody) encargosBody.innerHTML = "";
}

function resetEncargoDetailFields() {
  if (!useLav16) return;

  useLav16.value = 0;
  useLav9.value = 0;
  useLav4.value = 0;

  useSec15.value = 0;
  useSec30.value = 0;

  useJabon.value = 0;
  useSuavizante.value = 0;
  useDesmugrante.value = 0;

  useBolsaChica.value = 0;
  useBolsaMediana.value = 0;
  useBolsaGrande.value = 0;

  detailPaymentStatus.value = "pagado";
  detailAmountPaid.value = 0;
  if (detailAbonoHoy) detailAbonoHoy.value = 0;
  if (detailAbonoMetodo) detailAbonoMetodo.value = "efectivo";
  currentEncargoPaid = 0;
  detailDelivered.value = "pendiente";
  encargoDetailStatus.textContent = "";

  if (detailPaymentResultLabel) detailPaymentResultLabel.textContent = "Cambio";
  if (detailPaymentResult) {
    detailPaymentResult.textContent = "$0";
    detailPaymentResult.style.borderColor = "rgba(255,255,255,0.15)";
  }
}

function updateDetailPaymentSummary() {
  const total = Number(currentEncargoTotal || 0);
  const pagadoAnterior = Number(currentEncargoPaid || 0);
  const abonoHoy = Number(detailAbonoHoy?.value || 0);

  const nuevoPagado = pagadoAnterior + abonoHoy;

  if (detailAmountPaid) {
    detailAmountPaid.value = nuevoPagado;
  }

  let cambio = 0;
  let falta = 0;

  if (nuevoPagado >= total) {
    cambio = nuevoPagado - total;
  } else {
    falta = total - nuevoPagado;
  }

  if (falta > 0) {
    detailPaymentResultLabel.textContent = "Falta";
    detailPaymentResult.textContent = money(falta);
  } else {
    detailPaymentResultLabel.textContent = "Cambio";
    detailPaymentResult.textContent = money(cambio);
  }
}

function syncSaveEncargoButtonLabel() {
  if (!saveEncargoUsageBtn || !detailDelivered) return;

  saveEncargoUsageBtn.textContent =
    detailDelivered.value === "entregado"
      ? "Guardar y marcar como entregado"
      : "Guardar cambios";
}

function formatDateTime(dateString) {
  if (!dateString) return "";

  const d = new Date(dateString);

  const fecha = d.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City"
  });

  const hora = d.toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${fecha} ${hora}`;
}

function paymentLabel(row) {
  const total = Number(row.total || 0);
  const paid = Number(row.amount_paid || 0);

  if (paid >= total) {
    const cambio = paid - total;
    return cambio > 0 ? `Cambio ${money(cambio)}` : "Pagado exacto";
  } else {
    const falta = total - paid;
    return `Falta ${money(falta)}`;
  }
}

async function loadEncargosList() {
  ensureSupabase();

  encargosListStatus.textContent = "Cargando pedidos...";
  clearEncargosTable();

  let q = supabaseClient
    .from("encargos")
    .select(`
      id,
      created_at,
      employee,
      client_name,
      client_phone,
      kilos,
      is_express,
      express_kilos,
      payment_status,
      amount_paid,
      total,
      change,
      amount_due,
      delivered_status
    `)
    .order("created_at", { ascending: false });

    if (encargoFromDate.value) {
      q = q.gte("created_at", localDateStartISO(encargoFromDate.value));
    }
    
    if (encargoToDate.value) {
      q = q.lte("created_at", localDateEndISO(encargoToDate.value));
    }

  if (encargoEmployeeFilter.value) {
    q = q.eq("employee", encargoEmployeeFilter.value);
  }

  const { data, error } = await q;

  if (error) {
    console.error(error);
    encargosListStatus.textContent = `❌ Error al cargar pedidos: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    encargosListStatus.textContent = "No hay pedidos con esos filtros.";
    return;
  }

  encargosListStatus.textContent = `Listo: ${data.length} pedido(s).`;

  for (const row of data) {
    const tr = document.createElement("tr");
    const fecha = formatDateTime(row.created_at);
    const estadoPedido = row.delivered_status || "pendiente";

    tr.innerHTML = `
      <td>${
  row.is_express
    ? Number(row.express_kilos || 0) + " kg ESS"
    : Number(row.kilos || 0) + " kg"
}</td>
      <td>${fecha}</td>
      <td>${row.employee || ""}</td>
      <td>${row.client_name || ""}</td>
      <td>${row.client_phone || ""}</td>
      <td>${estadoPedido}</td>
      <td>${row.payment_status || ""}</td>
      <td>${money(row.total || 0)}</td>
      <td>${paymentLabel(row)}</td>
      <td style="text-align:right;">
        <button type="button" class="addBtn" data-open-encargo="${row.id}" style="width:auto; padding:8px 10px;">
          Abrir
        </button>
        <button type="button" class="ghost printEncargoRowBtn" data-print-encargo="${row.id}" style="width:auto; padding:8px 10px;">
          Imprimir ticket
        </button>
      </td>
    `;

    encargosBody.appendChild(tr);
  }
}

async function openEncargoDetail(id) {
  ensureSupabase();

  detailUsoEmployee.value = "";
  
  currentEncargoId = id;
  encargoDetailStatus.textContent = "";
  encargoDetailPanel.style.display = "block";

  const { data, error } = await supabaseClient
    .from("encargos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    encargoDetailStatus.textContent = `❌ Error al cargar detalle: ${error.message}`;
    return;
  }

  resetEncargoDetailFields();

  detailEncargoId.textContent = data.id;
  detailEncargoCliente.textContent = data.client_name || "-";
  detailEncargoEmpleado.textContent = data.employee || "-";
  detailEncargoTotal.textContent = money(data.total || 0);

  currentEncargoTotal = Number(data.total || 0);

  useLav16.value = Number(data.used_lavadora_16 || 0);
  useLav9.value = Number(data.used_lavadora_9 || 0);
  useLav4.value = Number(data.used_lavadora_4 || 0);

  useSec15.value = Number(data.used_secadora_15 || 0);
  useSec30.value = Number(data.used_secadora_30 || 0);

  useJabon.value = Number(data.used_jabon || 0);
  useSuavizante.value = Number(data.used_suavizante || 0);
  useDesmugrante.value = Number(data.used_desmugrante || 0);

  useBolsaChica.value = Number(data.used_bolsa_chica || 0);
  useBolsaMediana.value = Number(data.used_bolsa_mediana || 0);
  useBolsaGrande.value = Number(data.used_bolsa_grande || 0);

  usoAnteriorEncargo = {
    lav16: Number(data.used_lavadora_16 || 0),
    lav9: Number(data.used_lavadora_9 || 0),
    lav4: Number(data.used_lavadora_4 || 0),
  
    sec15: Number(data.used_secadora_15 || 0),
    sec30: Number(data.used_secadora_30 || 0),
  
    jabon: Number(data.used_jabon || 0),
    suavizante: Number(data.used_suavizante || 0),
    desmugrante: Number(data.used_desmugrante || 0),
  
    bolsaChica: Number(data.used_bolsa_chica || 0),
    bolsaMediana: Number(data.used_bolsa_mediana || 0),
    bolsaGrande: Number(data.used_bolsa_grande || 0)
  };

  detailPaymentStatus.value = data.payment_status || "pagado";
  currentEncargoPaid = Number(data.amount_paid || 0);
  detailAmountPaid.value = currentEncargoPaid;
  if (detailAbonoHoy) detailAbonoHoy.value = 0;
  detailDelivered.value = data.delivered_status || "pendiente";

  updateDetailPaymentSummary();
  syncSaveEncargoButtonLabel();
}

[
  detailPaymentStatus,
  detailAbonoHoy
].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", updateDetailPaymentSummary);
  el.addEventListener("change", updateDetailPaymentSummary);
});

if (detailDelivered) {
  detailDelivered.addEventListener("change", syncSaveEncargoButtonLabel);
}

async function saveEncargoUsageAndDelivery() {
  ensureSupabase();

  if (!detailUsoEmployee.value) {
    encargoDetailStatus.textContent =
      "Selecciona el empleado que está registrando el uso.";
    return;
  }

  if (!currentEncargoId) {
    encargoDetailStatus.textContent = "No hay encargo seleccionado.";
    return;
  }

  const paymentStatus = detailPaymentStatus.value;
  const abonoHoy = Number(detailAbonoHoy?.value || 0);
  const abonoMetodo = detailAbonoMetodo?.value || "efectivo";
  const amountPaid = wholeMoney(Number(currentEncargoPaid || 0) + abonoHoy);
  const deliveredStatus = detailDelivered.value === "entregado" ? "entregado" : "pendiente";
  const total = Number(currentEncargoTotal || 0);

  if (
    (paymentStatus === "pagado" || paymentStatus === "transferencia") &&
    amountPaid < total
  ) {
    encargoDetailStatus.textContent =
      "Si marcas como pagado, el monto debe cubrir el total.";
    return;
  }

  const updatePayload = {
    used_lavadora_16: Number(useLav16.value || 0),
    used_lavadora_9: Number(useLav9.value || 0),
    used_lavadora_4: Number(useLav4.value || 0),

    used_secadora_15: Number(useSec15.value || 0),
    used_secadora_30: Number(useSec30.value || 0),

    used_jabon: Number(useJabon.value || 0),
    used_suavizante: Number(useSuavizante.value || 0),
    used_desmugrante: Number(useDesmugrante.value || 0),

    used_bolsa_chica: Number(useBolsaChica.value || 0),
    used_bolsa_mediana: Number(useBolsaMediana.value || 0),
    used_bolsa_grande: Number(useBolsaGrande.value || 0),

    payment_status: paymentStatus,
    amount_paid: amountPaid,
    change:
    paymentStatus === "pagado"
      ? wholeMoney(amountPaid - total)
      : 0,
  
    amount_due:
      paymentStatus === "pendiente"
        ? wholeMoney(Math.max(total - amountPaid, 0))
        : 0,

    delivered_status: deliveredStatus,
    delivered_at: deliveredStatus === "entregado" ? new Date().toISOString() : null,
  };

  encargoDetailStatus.textContent = "Guardando cambios...";
  saveEncargoUsageBtn.disabled = true;

  const { error } = await supabaseClient
    .from("encargos")
    .update(updatePayload)
    .eq("id", currentEncargoId);

  saveEncargoUsageBtn.disabled = false;

  if (error) {
    console.error(error);
    encargoDetailStatus.textContent = `❌ Error al guardar: ${error.message}`;
    return;
  }

  const fichasEncargoRows = [];

function agregarFichaEncargo(concepto, cantidad) {
  const qty = Number(cantidad || 0);

  if (qty > 0) {
    fichasEncargoRows.push({
      employee: detailUsoEmployee.value,
      origen: "encargo",
      concepto,
      cantidad: qty,
      referencia_id: String(currentEncargoId),
    });
  }
}

agregarFichaEncargo(
  "Lavadora 16 kg",
  Number(useLav16.value || 0) - usoAnteriorEncargo.lav16
);

agregarFichaEncargo(
  "Lavadora 9 kg",
  Number(useLav9.value || 0) - usoAnteriorEncargo.lav9
);

agregarFichaEncargo(
  "Lavadora 4 kg",
  Number(useLav4.value || 0) - usoAnteriorEncargo.lav4
);

agregarFichaEncargo(
  "Secadora 9 kg (15 min)",
  Number(useSec15.value || 0) - usoAnteriorEncargo.sec15
);

agregarFichaEncargo(
  "Secadora 9 kg (30 min)",
  (
    Number(useSec30.value || 0) -
    usoAnteriorEncargo.sec30
  ) * 2
);

agregarFichaEncargo(
  "1 medida de jabón",
  Number(useJabon.value || 0) - usoAnteriorEncargo.jabon
);

agregarFichaEncargo(
  "1 medida de suavizante",
  Number(useSuavizante.value || 0) - usoAnteriorEncargo.suavizante
);

agregarFichaEncargo(
  "1 medida de desmugrante",
  Number(useDesmugrante.value || 0) - usoAnteriorEncargo.desmugrante
);

agregarFichaEncargo(
  "Bolsa chica",
  Number(useBolsaChica.value || 0) - usoAnteriorEncargo.bolsaChica
);

agregarFichaEncargo(
  "Bolsa mediana",
  Number(useBolsaMediana.value || 0) - usoAnteriorEncargo.bolsaMediana
);

agregarFichaEncargo(
  "Bolsa grande",
  Number(useBolsaGrande.value || 0) - usoAnteriorEncargo.bolsaGrande
);

if (fichasEncargoRows.length > 0) {
  const { error: fichasEncargoError } = await supabaseClient
    .from("movimientos_fichas")
    .insert(fichasEncargoRows);

  if (fichasEncargoError) {
    console.error(
      "Error al registrar fichas del encargo:",
      fichasEncargoError
    );

    encargoDetailStatus.textContent =
      "⚠️ El encargo se actualizó, pero no se pudieron registrar las fichas del corte.";

    return;
  }
}

usoAnteriorEncargo = {
  lav16: Number(useLav16.value || 0),
  lav9: Number(useLav9.value || 0),
  lav4: Number(useLav4.value || 0),

  sec15: Number(useSec15.value || 0),
  sec30: Number(useSec30.value || 0),

  jabon: Number(useJabon.value || 0),
  suavizante: Number(useSuavizante.value || 0),
  desmugrante: Number(useDesmugrante.value || 0),

  bolsaChica: Number(useBolsaChica.value || 0),
  bolsaMediana: Number(useBolsaMediana.value || 0),
  bolsaGrande: Number(useBolsaGrande.value || 0)
};

  if (abonoHoy > 0) {
    const pendienteAntes = Math.max(
      total - Number(currentEncargoPaid || 0),
      0
    );
  
    const montoAbonoReal = Math.min(
      abonoHoy,
      pendienteAntes
    );
  
    if (montoAbonoReal > 0) {
      const employeeAbono =
        detailUsoEmployee.value;
  
      const { error: movimientoAbonoError } = await supabaseClient
        .from("movimientos_caja")
        .insert({
          employee: employeeAbono,
          origen: "abono_encargo",
          metodo_pago: abonoMetodo,
          monto: montoAbonoReal,
          referencia_id: String(currentEncargoId),
        });
  
      if (movimientoAbonoError) {
        console.error(
          "Error al registrar abono en caja:",
          movimientoAbonoError
        );
  
        encargoDetailStatus.textContent =
          "⚠️ El encargo se actualizó, pero no se pudo registrar el abono en el corte de caja.";
  
        return;
      }
    }
  }

  encargoDetailStatus.textContent =
    deliveredStatus === "entregado"
      ? "✅ Encargo actualizado y marcado como entregado."
      : "✅ Encargo actualizado correctamente.";

  updateDetailPaymentSummary();
  await openEncargoDetail(currentEncargoId);

  if (encargoDetailPanel.style.display !== "none") {
    await loadEncargosList();
  }
}

if (loadEncargosBtn) {
  loadEncargosBtn.addEventListener("click", loadEncargosList);
}

if (encargosBody) {
  encargosBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const openId = btn.dataset.openEncargo;

    if (openId) {
      openEncargoDetail(openId);
    
      encargoDetailPanel.style.display = "block";
      encargoDetailPanel.open = true;
    
      if (encargosListBlock) {
        encargosListBlock.open = false;
      }
    
      const encargoRegistroBlock =
        document.getElementById("encargoRegistroBlock");
    
      if (encargoRegistroBlock) {
        encargoRegistroBlock.open = false;
      }
    
      return;
    }

    const printId = btn.dataset.printEncargo;
    if (printId) {
      printEncargoTicket(printId);
      return;
    }
  });
}

if (closeEncargoDetailBtn) {
  closeEncargoDetailBtn.addEventListener("click", () => {
    encargoDetailPanel.open = false;
    encargoDetailPanel.style.display = "none";

    currentEncargoId = null;
    currentEncargoTotal = 0;
    encargoDetailStatus.textContent = "";

    if (encargosListBlock) {
      encargosListBlock.open = true;
    }
  });
}

if (saveEncargoUsageBtn) {
  saveEncargoUsageBtn.addEventListener("click", saveEncargoUsageAndDelivery);
}

// =====================
// Tabs
// =====================
const tabBtns = document.querySelectorAll(".tabBtn[data-tab]");
const tabContents = document.querySelectorAll(".tabContent");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;

    tabBtns.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(target).classList.add("active");
  });
});

// =====================
// Ver encargos dentro de "Ver ventas"
// =====================
const viewEncargoFromDate = $("#viewEncargoFromDate");
const viewEncargoToDate = $("#viewEncargoToDate");
const viewEncargoEmployeeFilter = $("#viewEncargoEmployeeFilter");
const loadViewEncargosBtn = $("#loadViewEncargosBtn");
const viewEncargosBody = $("#viewEncargosBody");
const viewEncargosStatus = $("#viewEncargosStatus");

const viewEncargosSummary = $("#viewEncargosSummary");
const viewEncargosSummaryCount = $("#viewEncargosSummaryCount");
const viewEncargosSummaryTotal = $("#viewEncargosSummaryTotal");
const viewEncargosSummaryEfectivo = $("#viewEncargosSummaryEfectivo");
const viewEncargosSummaryTransferencia = $("#viewEncargosSummaryTransferencia");
const viewEncargosSummaryPaid = $("#viewEncargosSummaryPaid");
const viewEncargosSummaryDue = $("#viewEncargosSummaryDue");

const loadUsageSummaryBtn = $("#loadUsageSummaryBtn");
const clearUsageFiltersBtn = $("#clearUsageFiltersBtn");
const usageFromDate = $("#usageFromDate");
const usageToDate = $("#usageToDate");
const usageEmployeeFilter = $("#usageEmployeeFilter");
const usageSalesBody = $("#usageSalesBody");
const usageEncargosBody = $("#usageEncargosBody");
const usageTotalBody = $("#usageTotalBody");
const usageSummaryStatus = $("#usageSummaryStatus");

const viewEncargoDetailPanel = $("#viewEncargoDetailPanel");
const closeViewEncargoDetail = $("#closeViewEncargoDetail");
const viewDetailEncargoId = $("#viewDetailEncargoId");
const viewDetailEncargoFecha = $("#viewDetailEncargoFecha");
const viewDetailEncargoEmpleado = $("#viewDetailEncargoEmpleado");
const viewDetailEncargoCliente = $("#viewDetailEncargoCliente");
const viewDetailEncargoTelefono = $("#viewDetailEncargoTelefono");
const viewDetailEncargoTotal = $("#viewDetailEncargoTotal");
const viewDetailEncargoPagado = $("#viewDetailEncargoPagado");
const viewDetailEncargoCambio = $("#viewDetailEncargoCambio");
const viewDetailEncargoFalta = $("#viewDetailEncargoFalta");
const viewDetailEncargoPagoEstado = $("#viewDetailEncargoPagoEstado");
const viewDetailEncargoPedidoEstado = $("#viewDetailEncargoPedidoEstado");
const viewDetailEncargoEntregadoAt = $("#viewDetailEncargoEntregadoAt");
const viewEncargoServicesBody = $("#viewEncargoServicesBody");
const viewEncargoUsageBody = $("#viewEncargoUsageBody");

(function setDefaultViewEncargoFilters() {
  if (viewEncargoFromDate) viewEncargoFromDate.value = "";
  if (viewEncargoToDate) viewEncargoToDate.value = "";
  if (viewEncargoEmployeeFilter) viewEncargoEmployeeFilter.value = "";
})();

(function setDefaultUsageFilters() {
  if (usageFromDate) usageFromDate.value = "";
  if (usageToDate) usageToDate.value = "";
  if (usageEmployeeFilter) usageEmployeeFilter.value = "";
})();

function clearViewEncargosTable() {
  if (viewEncargosBody) viewEncargosBody.innerHTML = "";
}

function setViewEncargoTableMessage(message, colspan = 4, target = viewEncargoServicesBody) {
  if (!target) return;
  target.innerHTML = `<tr><td colspan="${colspan}" class="muted">${message}</td></tr>`;
}

function humanPaymentStatus(value) {
  if (value === "pagado") return "Pagado";
  if (value === "transferencia") return "Pagado por transferencia";
  return "Pendiente / Adelanto";
}

function humanDeliveredStatus(value) {
  return value === "entregado" ? "Entregado" : "Pendiente";
}

function buildEncargoServicesRows(row) {
  const rows = [];

  const pushRow = (name, qty, price, subtotal) => {
    const q = Number(qty || 0);
    const p = Number(price || 0);
    const s = Number(subtotal || 0);
    if (q <= 0 && s <= 0) return;
    rows.push({ name, qty: q, price: p, subtotal: s });
  };

  pushRow("Lavado por kilos", row.kilos, row.kilos_price || 26, row.kilos_subtotal);
  pushRow("Edredón/Cobertor Individual", row.edredon_individual, 95, Number(row.edredon_individual || 0) * 95);
  pushRow("Edredón/Cobertor Matrimonial", row.edredon_matrimonial, 100, Number(row.edredon_matrimonial || 0) * 100);
  pushRow("Edredón/Cobertor King Size", row.edredon_king, 110, Number(row.edredon_king || 0) * 110);
  pushRow("Colcha Individual", row.colcha_individual, 90, Number(row.colcha_individual || 0) * 90);
  pushRow("Colcha Matrimonial", row.colcha_matrimonial, 95, Number(row.colcha_matrimonial || 0) * 95);
  pushRow("Colcha King Size", row.colcha_king, 100, Number(row.colcha_king || 0) * 100);
  pushRow("Manteles por kilo", row.manteles_kilos, 55, row.manteles_subtotal);
  pushRow(
    "Almohadas/Peluches",
    row.almohadas_peluches_qty,
    row.almohadas_peluches_qty > 0
      ? Number(row.almohadas_peluches_price || 0) / Number(row.almohadas_peluches_qty || 1)
      : 0,
    row.almohadas_peluches_subtotal || row.almohadas_peluches_price
  );

  return rows;
}

function buildEncargoUsageRows(row) {
  const usages = [
    ["Lavadora 16 kg", row.used_lavadora_16],
    ["Lavadora 9 kg", row.used_lavadora_9],
    ["Lavadora 4 kg", row.used_lavadora_4],
    ["Secadora 9 kg (15 min)", row.used_secadora_15],
    ["Secadora 9 kg (30 min)", row.used_secadora_30],
    ["Medidas de jabón", row.used_jabon],
    ["Medidas de suavizante", row.used_suavizante],
    ["Medidas de desmugrante", row.used_desmugrante],
    ["Bolsas chicas", row.used_bolsa_chica],
    ["Bolsas medianas", row.used_bolsa_mediana],
    ["Bolsas grandes", row.used_bolsa_grande],
  ];

  return usages
    .filter(([, qty]) => Number(qty || 0) > 0)
    .map(([name, qty]) => ({ name, qty: Number(qty || 0) }));
}

async function loadViewEncargos() {
  ensureSupabase();

  if (!viewEncargosStatus) return;

  viewEncargosStatus.textContent = "Cargando encargos...";
  clearViewEncargosTable();
  if (viewEncargosSummary) viewEncargosSummary.style.display = "none";
  if (viewEncargoDetailPanel) viewEncargoDetailPanel.style.display = "none";

  let q = supabaseClient
    .from("encargos")
    .select(`
      id,
      created_at,
      employee,
      client_name,
      client_phone,
      kilos,
      payment_status,
      amount_paid,
      total,
      change,
      amount_due,
      delivered_status
    `)
    .order("created_at", { ascending: false });

  if (viewEncargoFromDate && viewEncargoFromDate.value) {
    q = q.gte("created_at", localDateStartISO(viewEncargoFromDate.value));
  }

  if (viewEncargoToDate && viewEncargoToDate.value) {
    q = q.lte("created_at", localDateEndISO(viewEncargoToDate.value));
  }

  const { data, error } = await q;

  if (error) {
    console.error(error);
    viewEncargosStatus.textContent = `❌ Error al cargar encargos: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    viewEncargosStatus.textContent = "No hay encargos con esos filtros.";
    return;
  }

  let movimientosCajaQuery = supabaseClient
  .from("movimientos_caja")
  .select("employee, origen, monto, metodo_pago, referencia_id, created_at")
  .in("origen", ["encargo", "abono_encargo"]);

if (viewEncargoFromDate && viewEncargoFromDate.value) {
  movimientosCajaQuery = movimientosCajaQuery.gte(
    "created_at",
    localDateStartISO(viewEncargoFromDate.value)
  );
}

if (viewEncargoToDate && viewEncargoToDate.value) {
  movimientosCajaQuery = movimientosCajaQuery.lte(
    "created_at",
    localDateEndISO(viewEncargoToDate.value)
  );
}

if (viewEncargoEmployeeFilter && viewEncargoEmployeeFilter.value) {
  movimientosCajaQuery = movimientosCajaQuery.eq(
    "employee",
    viewEncargoEmployeeFilter.value
  );
}

const {
  data: movimientosCajaData,
  error: movimientosCajaError
} = await movimientosCajaQuery;

if (movimientosCajaError) {
  console.error(movimientosCajaError);

  viewEncargosStatus.textContent =
    `❌ Error al cargar abonos: ${movimientosCajaError.message}`;

  return;
}

const totalCobradoEmpleado = (movimientosCajaData || []).reduce(
  (suma, movimiento) =>
    suma + Number(movimiento.monto || 0),
  0
);

const totalEfectivoEncargos = (movimientosCajaData || []).reduce(
  (suma, movimiento) =>
    movimiento.metodo_pago === "efectivo"
      ? suma + Number(movimiento.monto || 0)
      : suma,
  0
);

const totalTransferenciaEncargos = (movimientosCajaData || []).reduce(
  (suma, movimiento) =>
    movimiento.metodo_pago === "transferencia"
      ? suma + Number(movimiento.monto || 0)
      : suma,
  0
);

const empleadoSeleccionado =
  viewEncargoEmployeeFilter &&
  viewEncargoEmployeeFilter.value
    ? viewEncargoEmployeeFilter.value
    : "";

const idsEncargosEmpleado = new Set(
  (movimientosCajaData || [])
    .map((movimiento) => String(movimiento.referencia_id || ""))
    .filter(Boolean)
);

const dataFiltrada = empleadoSeleccionado
  ? (data || []).filter((row) =>
      String(row.employee || "") === empleadoSeleccionado ||
      idsEncargosEmpleado.has(String(row.id))
    )
  : (data || []);

  if (!dataFiltrada || dataFiltrada.length === 0) {
    viewEncargosStatus.textContent =
      "No hay encargos con esos filtros.";
    return;
  }

  const totalEncargos = dataFiltrada.length;

  let totalVendido = 0;
  let totalCobrado = 0;
  let totalPorCobrar = 0;
  let totalCambio = 0;

  for (const row of dataFiltrada) {
    const total = Number(row.total || 0);
    const pagadoAcumulado = Number(row.amount_paid || 0);
  
    const porCobrar = Math.max(total - pagadoAcumulado, 0);
    const cambio = Math.max(pagadoAcumulado - total, 0);
  
    totalVendido += total;
    totalPorCobrar += porCobrar;
    totalCambio += cambio;
  }

  if (viewEncargoEmployeeFilter && viewEncargoEmployeeFilter.value) {
    totalCobrado = totalCobradoEmpleado;
  } else {
    totalCobrado = dataFiltrada.reduce(
      (suma, row) =>
        suma + Number(row.amount_paid || 0),
      0
    );
  }

  viewEncargosSummaryCount.textContent = totalEncargos;
viewEncargosSummaryTotal.textContent = money(totalVendido);

viewEncargosSummaryEfectivo.textContent =
  money(totalEfectivoEncargos);

viewEncargosSummaryTransferencia.textContent =
  money(totalTransferenciaEncargos);

viewEncargosSummaryPaid.textContent = money(totalCobrado);
viewEncargosSummaryDue.textContent = money(totalPorCobrar);

viewEncargosSummary.style.display = "block";

  viewEncargosStatus.textContent = `Listo: ${totalEncargos} encargo(s).`;

  for (const row of dataFiltrada) {
    const total = Number(row.total || 0);
    const pagado = Number(row.amount_paid || 0);
    const porCobrar = Math.max(total - pagado, 0);
    const cambio = Math.max(pagado - total, 0);

    const cobradoPorEmpleadoSeleccionado = empleadoSeleccionado
  ? (movimientosCajaData || [])
      .filter(
        (movimiento) =>
          String(movimiento.referencia_id || "") === String(row.id)
      )
      .reduce(
        (suma, movimiento) =>
          suma + Number(movimiento.monto || 0),
        0
      )
  : 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateTime(row.created_at)}</td>
      <td>
  <strong>${row.employee || ""}</strong>
  ${
    empleadoSeleccionado &&
    empleadoSeleccionado !== String(row.employee || "") &&
    cobradoPorEmpleadoSeleccionado > 0
      ? `<br><small>Cobró ${empleadoSeleccionado}: ${money(cobradoPorEmpleadoSeleccionado)}</small>`
      : ""
  }
</td>
      <td>${row.client_name || ""}</td>
      <td>${row.client_phone || ""}</td>
      <td>${humanDeliveredStatus(row.delivered_status)}</td>
      <td>${humanPaymentStatus(row.payment_status)}</td>
      <td>${money(total)}</td>
      <td>${money(pagado)}</td>
      <td>${money(porCobrar)}</td>
      <td>${money(cambio)}</td>
      <td style="text-align:right;">
        <button type="button" class="addBtn" data-view-encargo="${row.id}" style="width:auto; padding:8px 10px;">
          Ver detalle
        </button>
      </td>
    `;
    viewEncargosBody.appendChild(tr);
  }
}

async function loadViewEncargoDetail(encargoId) {
  ensureSupabase();

  if (!viewEncargoDetailPanel) return;

  viewEncargoDetailPanel.style.display = "block";
  setViewEncargoTableMessage("Cargando detalle...", 4, viewEncargoServicesBody);
  setViewEncargoTableMessage("Cargando uso registrado...", 2, viewEncargoUsageBody);

  const { data, error } = await supabaseClient
    .from("encargos")
    .select("*")
    .eq("id", encargoId)
    .single();

  if (error) {
    console.error(error);
    setViewEncargoTableMessage(`❌ Error: ${error.message}`, 4, viewEncargoServicesBody);
    setViewEncargoTableMessage("No se pudo cargar el uso registrado.", 2, viewEncargoUsageBody);
    return;
  }

  const change = Number(data.change || 0);
  const due = Number(data.amount_due || Math.max(Number(data.total || 0) - Number(data.amount_paid || 0), 0));

  viewDetailEncargoId.textContent = data.id ?? "-";
  viewDetailEncargoFecha.textContent = formatDateTime(data.created_at) || "-";
  viewDetailEncargoEmpleado.textContent = data.employee || "-";
  viewDetailEncargoCliente.textContent = data.client_name || "-";
  viewDetailEncargoTelefono.textContent = data.client_phone || "-";
  viewDetailEncargoTotal.textContent = money(data.total || 0);
  viewDetailEncargoPagado.textContent = money(data.amount_paid || 0);
  viewDetailEncargoCambio.textContent = money(change);
  viewDetailEncargoFalta.textContent = money(due);
  viewDetailEncargoPagoEstado.textContent = humanPaymentStatus(data.payment_status);
  viewDetailEncargoPedidoEstado.textContent = humanDeliveredStatus(data.delivered_status);
  viewDetailEncargoEntregadoAt.textContent = data.delivered_at ? formatDateTime(data.delivered_at) : "-";

  const services = buildEncargoServicesRows(data);
  if (!services.length) {
    setViewEncargoTableMessage("No hay servicios registrados.", 4, viewEncargoServicesBody);
  } else {
    viewEncargoServicesBody.innerHTML = "";
    for (const item of services) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${money(item.price)}</td>
        <td>${money(item.subtotal)}</td>
      `;
      viewEncargoServicesBody.appendChild(tr);
    }
  }

  const usages = buildEncargoUsageRows(data);
  if (!usages.length) {
    setViewEncargoTableMessage("Aún no hay uso registrado para este encargo.", 2, viewEncargoUsageBody);
  } else {
    viewEncargoUsageBody.innerHTML = "";
    for (const item of usages) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.qty}</td>
      `;
      viewEncargoUsageBody.appendChild(tr);
    }
  }
}

function createEmptyUsageMap() {
  return {
    "Lavadora 16 kg": 0,
    "Lavadora 9 kg": 0,
    "Lavadora 4 kg": 0,
    "Secadora 9 kg (15 min)": 0,
    "Secadora 9 kg (30 min)": 0,
    "Secado (precio libre)": 0,
    "1 medida de jabón": 0,
    "1 medida de suavizante": 0,
    "1 medida de desmugrante": 0,
    "Bolsa chica": 0,
    "Bolsa mediana": 0,
    "Bolsa grande": 0,
    "Suavizante (botella)": 0,
    "Pinol": 0,
    "Cloro": 0,
    "Jabón en polvo": 0,
  };
}

function clearUsageTables() {
  if (usageSalesBody) usageSalesBody.innerHTML = "";
  if (usageEncargosBody) usageEncargosBody.innerHTML = "";
  if (usageTotalBody) usageTotalBody.innerHTML = "";
}

function renderUsageTable(target, usageMap) {
  if (!target) return;

  target.innerHTML = "";

  const entries = Object.entries(usageMap).filter(([, qty]) => Number(qty || 0) > 0);

  if (!entries.length) {
    target.innerHTML = `<tr><td colspan="2" class="muted">Sin registros.</td></tr>`;
    return;
  }

  for (const [name, qty] of entries) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${qty}</td>
    `;
    target.appendChild(tr);
  }
}

function sumUsageMaps(a, b) {
  const result = createEmptyUsageMap();

  Object.keys(result).forEach((key) => {
    result[key] = Number(a[key] || 0) + Number(b[key] || 0);
  });

  return result;
}

function normalizeUsageName(name) {
  const raw = String(name || "").trim().toLowerCase();

  const map = {
    "lavadora 16 kg": "Lavadora 16 kg",
    "lavadora 9 kg": "Lavadora 9 kg",
    "lavadora 4 kg": "Lavadora 4 kg",

    "secadora 9 kg (15 min)": "Secadora 9 kg (15 min)",
    "secadora 9 kg (15 minutos)": "Secadora 9 kg (15 min)",

    "secadora 9 kg (30 min)": "Secadora 9 kg (30 min)",
    "secadora 9 kg (30 minutos)": "Secadora 9 kg (30 min)",

    "secado (precio libre)": "Secado (precio libre)",
    "secado": "Secado (precio libre)",

    "1 medida de jabón": "1 medida de jabón",
    "1 medida de jabon": "1 medida de jabón",
    "medida de jabón": "1 medida de jabón",
    "medida de jabon": "1 medida de jabón",
    "jabon": "1 medida de jabón",
    "jabón": "1 medida de jabón",

    "1 medida de suavizante": "1 medida de suavizante",
    "medida de suavizante": "1 medida de suavizante",

    "1 medida de desmugrante": "1 medida de desmugrante",
    "medida de desmugrante": "1 medida de desmugrante",

    "bolsa chica": "Bolsa chica",
    "bolsa mediana": "Bolsa mediana",
    "bolsa grande": "Bolsa grande",

    "suavizante (botella)": "Suavizante (botella)",
    "suavizante": "Suavizante (botella)",

    "pinol": "Pinol",
    "cloro": "Cloro",
    "jabón en polvo": "Jabón en polvo",
    "jabon en polvo": "Jabón en polvo",
  };

  return map[raw] || String(name || "").trim();
}

async function loadUsageSummary() {
  ensureSupabase();

  if (!usageSummaryStatus) return;

  usageSummaryStatus.textContent = "Cargando resumen de uso...";
  clearUsageTables();

  const from = usageFromDate?.value?.trim() || "";
  const to = usageToDate?.value?.trim() || "";
  const emp = usageEmployeeFilter?.value?.trim() || "";

  // =========================
  // VENTAS
  // =========================
  let ventasQuery = supabaseClient
    .from("ventas")
    .select("id, employee, sale_date");

  if (from) ventasQuery = ventasQuery.gte("sale_date", from);
  if (to) ventasQuery = ventasQuery.lte("sale_date", to);
  if (emp) ventasQuery = ventasQuery.eq("employee", emp);

  const { data: ventasData, error: ventasError } = await ventasQuery;

  if (ventasError) {
    console.error(ventasError);
    usageSummaryStatus.textContent = `❌ Error al cargar ventas: ${ventasError.message}`;
    return;
  }

  const ventaIds = (ventasData || []).map((v) => v.id);
  const salesUsage = createEmptyUsageMap();

  if (ventaIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabaseClient
      .from("venta_items")
      .select("venta_id, name, qty")
      .in("venta_id", ventaIds);

    if (itemsError) {
      console.error(itemsError);
      usageSummaryStatus.textContent = `❌ Error al cargar items de ventas: ${itemsError.message}`;
      return;
    }

    for (const item of itemsData || []) {
      const name = item.name;
      const qty = Number(item.qty || 0);
    
      if (name === "Secadora 9 kg (15 min)" || name === "Solo secado 9 kg (15 min)") {
        salesUsage["Secadora 9 kg (15 min)"] += qty;
      } else if (name === "Secadora 9 kg (30 min)" || name === "Solo secado 9 kg (30 min)") {
        salesUsage["Secadora 9 kg (30 min)"] += qty * 2;
      } else if (salesUsage[name] !== undefined) {
        salesUsage[name] += qty;
      }
    }
  }

  // =========================
  // ENCARGOS
  // =========================
  let encargosQuery = supabaseClient
    .from("encargos")
    .select(`
      employee,
      created_at,
      used_lavadora_16,
      used_lavadora_9,
      used_lavadora_4,
      used_secadora_15,
      used_secadora_30,
      used_jabon,
      used_suavizante,
      used_desmugrante,
      used_bolsa_chica,
      used_bolsa_mediana,
      used_bolsa_grande
    `);

  if (from) encargosQuery = encargosQuery.gte("created_at", localDateStartISO(from));
  if (to) encargosQuery = encargosQuery.lte("created_at", localDateEndISO(to));
  if (emp) encargosQuery = encargosQuery.eq("employee", emp);

  const { data: encargosData, error: encargosError } = await encargosQuery;

  let fichasEncargosQuery = supabaseClient
  .from("movimientos_fichas")
  .select("employee, concepto, cantidad, created_at")
  .eq("origen", "encargo");

if (usageFromDate.value) {
  fichasEncargosQuery = fichasEncargosQuery.gte(
    "created_at",
    localDateStartISO(usageFromDate.value)
  );
}

if (usageToDate.value) {
  fichasEncargosQuery = fichasEncargosQuery.lte(
    "created_at",
    localDateEndISO(usageToDate.value)
  );
}

if (usageEmployeeFilter.value) {
  fichasEncargosQuery = fichasEncargosQuery.eq(
    "employee",
    usageEmployeeFilter.value
  );
}

const {
  data: fichasEncargosData,
  error: fichasEncargosError
} = await fichasEncargosQuery;

if (fichasEncargosError) {
  console.error(fichasEncargosError);

  usageSummaryStatus.textContent =
    `❌ Error al cargar fichas de encargos: ${fichasEncargosError.message}`;

  return;
}

const encargosUsage = createEmptyUsageMap();

for (const row of fichasEncargosData || []) {
  const concepto = row.concepto;
  const cantidad = Number(row.cantidad || 0);

  if (Object.prototype.hasOwnProperty.call(encargosUsage, concepto)) {
    encargosUsage[concepto] += cantidad;
  }
}

  // =========================
  // TOTAL
  // =========================
  const totalUsage = sumUsageMaps(salesUsage, encargosUsage);

  renderUsageTable(usageSalesBody, salesUsage);
  renderUsageTable(usageEncargosBody, encargosUsage);
  renderUsageTable(usageTotalBody, totalUsage);

  const totalVentasRegs = Object.values(salesUsage).reduce((a, b) => a + Number(b || 0), 0);
  const totalEncargosRegs = Object.values(encargosUsage).reduce((a, b) => a + Number(b || 0), 0);

  if (totalVentasRegs === 0 && totalEncargosRegs === 0) {
    usageSummaryStatus.textContent = "No hay registros con esos filtros.";
  } else {
    usageSummaryStatus.textContent = "✅ Resumen de uso cargado correctamente.";
  }
}

if (loadViewEncargosBtn) {
  loadViewEncargosBtn.addEventListener("click", loadViewEncargos);
}

if (viewEncargosBody) {
  viewEncargosBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.viewEncargo;
    if (!id) return;

    loadViewEncargoDetail(id);
  });
}

if (closeViewEncargoDetail) {
  closeViewEncargoDetail.addEventListener("click", () => {
    viewEncargoDetailPanel.style.display = "none";
    if (viewEncargoServicesBody) viewEncargoServicesBody.innerHTML = "";
    if (viewEncargoUsageBody) viewEncargoUsageBody.innerHTML = "";
  });
}

if (loadUsageSummaryBtn) {
  loadUsageSummaryBtn.addEventListener("click", loadUsageSummary);
}

if (clearUsageFiltersBtn) {
  clearUsageFiltersBtn.addEventListener("click", () => {
    if (usageFromDate) usageFromDate.value = "";
    if (usageToDate) usageToDate.value = "";
    if (usageEmployeeFilter) usageEmployeeFilter.value = "";
    loadUsageSummary();
  });
}

if (deleteAllDataBtn) {
  deleteAllDataBtn.addEventListener("click", deleteAllDataExceptPending);
}

function fillSaleTicket() {
  if (!lastSaved) {
    statusEl.textContent = "Primero registra una venta.";
    return false;
  }

  ticketSaleId.textContent = lastSaved.id;
  ticketDate.textContent = formatDate(lastSaved.date);
  ticketEmployee.textContent = lastSaved.employee;

  ticketItemsBody.innerHTML = "";

  for (const item of lastSaved.items) {
    const div = document.createElement("div");
    div.className = "ticketItem";

    div.innerHTML = `
      <span class="ticketItemName">${item.name} x${item.qty}</span>
      <span class="ticketItemAmount">${money(item.subtotal)}</span>
    `;

    ticketItemsBody.appendChild(div);
  }

  ticketTotal.textContent = money(lastSaved.total);
  ticketCash.textContent = money(lastSaved.cash);
  ticketChange.textContent = money(lastSaved.change);

  return true;
}

printTicketBtn.addEventListener("click", () => {
  if (!lastSaved) {
    statusEl.textContent = "Primero registra una venta.";
    return;
  }

  const metodoPago =
    lastSaved.paymentMethod === "transferencia"
      ? "Transferencia"
      : "Efectivo";

  const fechaHora = lastSaved.created_at
    ? formatDateTime(lastSaved.created_at)
    : formatDate(lastSaved.date);

  const esTransferencia =
    lastSaved.paymentMethod === "transferencia";

  const cambioTicket = esTransferencia
    ? 0
    : Number(lastSaved.change || 0);

  const itemsHTML = lastSaved.items
    .map(
      (item) => `
        <div class="item">
          <div class="itemNombre">${item.name}</div>
          <div class="itemDatos">
            <span>${item.qty} x ${money(item.price)}</span>
            <strong>${money(item.subtotal)}</strong>
          </div>
        </div>
      `
    )
    .join("");

  const win = window.open("", "_blank", "width=300,height=650");

  if (!win) {
    alert("El navegador bloqueó la ventana.");
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">

        <title>Ticket Auto servicio</title>

        <style>
          @page {
            size: 58mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            color: black;
          }

          body {
            width: 54mm;
            padding: 1.5mm;
            font-family: monospace;
            font-size: 10px;
            line-height: 1.25;
            overflow-wrap: anywhere;
          }

          .centro {
            text-align: center;
          }

          .titulo {
            font-size: 14px;
            font-weight: bold;
          }

          .subtitulo {
            font-size: 10px;
          }

          .linea {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }

          .dato {
            margin: 2px 0;
          }

          .folio {
            overflow-wrap: anywhere;
            word-break: break-all;
          }

          .encabezadoItems {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            margin-bottom: 3px;
          }

          .item {
            margin: 4px 0;
          }

          .itemNombre {
            font-weight: bold;
          }

          .itemDatos {
            display: flex;
            justify-content: space-between;
            gap: 4px;
          }

          .resumen {
            margin-top: 3px;
          }

          .filaTotal {
            display: flex;
            justify-content: space-between;
            gap: 4px;
            margin: 2px 0;
          }

          .totalPrincipal {
            font-size: 12px;
            font-weight: bold;
          }

          .gracias {
            text-align: center;
            margin-top: 6px;
          }

          .imprimirBtn {
            width: 100%;
            padding: 8px;
            margin-top: 12px;
            font-size: 12px;
          }

          @media print {
            .imprimirBtn {
              display: none;
            }
          }
        </style>
      </head>

      <body>

        <div class="centro">
          <div class="titulo">SPEED WASH</div>
          <div class="subtitulo">Ticket de Auto servicio</div>
        </div>

        <div class="linea"></div>

        <div class="dato folio">
          <b>Folio:</b> ${lastSaved.id}
        </div>

        <div class="dato">
          <b>Fecha/Hora:</b> ${fechaHora}
        </div>

        <div class="dato">
          <b>Empleado:</b> ${lastSaved.employee}
        </div>

        <div class="dato">
          <b>Método:</b> ${metodoPago}
        </div>

        <div class="linea"></div>

        <div class="encabezadoItems">
          <span>Producto / Cant.</span>
          <span>Importe</span>
        </div>

        ${itemsHTML}

        <div class="linea"></div>

        <div class="resumen">

          <div class="filaTotal totalPrincipal">
            <span>TOTAL</span>
            <span>${money(lastSaved.total)}</span>
          </div>

          ${
            esTransferencia
              ? `
                <div class="filaTotal">
                  <span>TRANSFERENCIA</span>
                  <span>${money(lastSaved.total)}</span>
                </div>
              `
              : `
                <div class="filaTotal">
                  <span>EFECTIVO</span>
                  <span>${money(lastSaved.cash)}</span>
                </div>
              `
          }

          <div class="filaTotal">
            <span>CAMBIO</span>
            <span>${money(cambioTicket)}</span>
          </div>

        </div>

        <div class="linea"></div>

        <div class="gracias">
          Gracias por su compra
        </div>

        <button
          class="imprimirBtn"
          onclick="window.print()"
        >
          Imprimir
        </button>

      </body>
    </html>
  `);

  win.document.close();
});

async function printEncargoTicket(encargoId) {
  ensureSupabase();

  const win = window.open("", "_blank", "width=300,height=600");

  if (!win) {
    alert("El navegador bloqueó la ventana.");
    return;
  }

  const { data, error } = await supabaseClient
  .from("encargos")
  .select("*")
  .eq("id", encargoId)
  .single();

if (error) {
  win.close();
  alert("Error al cargar encargo: " + error.message);
  return;
}

const { data: articulosData, error: articulosError } = await supabaseClient
  .from("encargo_articulos")
  .select("tipo, tamano, cantidad, importe")
  .eq("encargo_id", encargoId)
  .order("created_at", { ascending: true });

if (articulosError) {
  win.close();
  alert("Error al cargar artículos: " + articulosError.message);
  return;
}

  const total = Number(data.total || 0);
  const pagado = Number(data.amount_paid || 0);
  const cambio = Math.max(pagado - total, 0);
  const resta = Math.max(total - pagado, 0);

  const estadoPagoTicket =
  resta <= 0
    ? "Pagado"
    : "Pendiente / Adelanto";
  
    const esTransferencia = data.payment_status === "transferencia";

  const metodoPagoTicket = esTransferencia
  ? "Transferencia"
  : "Efectivo";

  const cambioTicket = esTransferencia
    ? 0
    : cambio;

  const isExpress = data.is_express === true;
  const expressPrice = Number(data.express_price || 0);

  const kilos = Number(data.kilos || 0);
  const kilosBase = kilos > 0 && kilos < 4 ? 4 : kilos;
  const kilosSubtotal = kilosBase * 26;

  const lavadoras =
    Number(data.used_lavadora_16 || 0) +
    Number(data.used_lavadora_9 || 0) +
    Number(data.used_lavadora_4 || 0);

  const secadoras =
    Number(data.used_secadora_15 || 0) +
    Number(data.used_secadora_30 || 0) * 2;

    const articulosTicketHTML = (articulosData || []).map(a => {
      let nombre = a.tipo;
    
      if (nombre === "Almohada") nombre = "Almoh.";
      if (nombre === "Peluche") nombre = "Peluche";
      if (nombre === "Frazada") nombre = "Fraz.";
    
      if (
        nombre !== "Almoh." &&
        nombre !== "Peluche" &&
        nombre !== "Fraz." &&
        nombre.length > 9
      ) {
        nombre = nombre.substring(0, 8) + ".";
      }
    
      let tamano = a.tamano;
    
      if (tamano === "Chico") tamano = "Ch.";
      if (tamano === "Mediano") tamano = "Med.";
      if (tamano === "Grande") tamano = "Gr.";
    
      const subtotal = Number(a.cantidad) * Number(a.importe);
    
      return `<div>${nombre} ${tamano}${a.cantidad}x${wholeMoney(a.importe)} ${money(subtotal)}</div>`;
    }).join("");

  const serviciosHTML = `
  ${isExpress ? `
    <div style="margin:8px 0;">
      <div>Servicio Express</div>
  
      ${Number(data.express_kilos || 0) > 0
        ? `<div>Kilos: ${data.express_kilos} kg ${Number(data.express_kilos || 0) < 4 ? "(mínimo aplicado)" : ""}</div>`
        : ""}
  
      <div>${money(expressPrice)}</div>
    </div>
  ` : kilos > 0 ? `
    <div style="margin:8px 0;">
      <div>Kilos: ${kilos} kg ${kilos < 4 ? "(mínimo aplicado)" : ""}</div>
      <div>${money(kilosSubtotal)}</div>
    </div>
  ` : ""}

    ${Number(data.edredon_individual || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Edredón Individual: ${data.edredon_individual}</div>
        <div>${money(data.edredon_individual * 95)}</div>
      </div>
    ` : ""}

    ${Number(data.edredon_matrimonial || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Edredón Matrimonial: ${data.edredon_matrimonial}</div>
        <div>${money(data.edredon_matrimonial * 100)}</div>
      </div>
    ` : ""}

    ${Number(data.edredon_king || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Edredón King: ${data.edredon_king}</div>
        <div>${money(data.edredon_king * 110)}</div>
      </div>
    ` : ""}

    ${Number(data.colcha_individual || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Colcha Individual: ${data.colcha_individual}</div>
        <div>${money(data.colcha_individual * 90)}</div>
      </div>
    ` : ""}

    ${Number(data.colcha_matrimonial || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Colcha Matrimonial: ${data.colcha_matrimonial}</div>
        <div>${money(data.colcha_matrimonial * 95)}</div>
      </div>
    ` : ""}

    ${Number(data.colcha_king || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Colcha King: ${data.colcha_king}</div>
        <div>${money(data.colcha_king * 100)}</div>
      </div>
    ` : ""}

    ${Number(data.manteles_kilos || 0) > 0 ? `
      <div style="margin:8px 0;">
        <div>Manteles: ${data.manteles_kilos} kg</div>
        <div>${money(data.manteles_subtotal || 0)}</div>
      </div>
    ` : ""}

    ${articulosTicketHTML}

    ${Number(data.used_jabon || 0) > 0 ? `<div>Detergente: ${data.used_jabon}</div>` : ""}
    ${Number(data.used_suavizante || 0) > 0 ? `<div>Suavizante: ${data.used_suavizante}</div>` : ""}
  `;

  win.document.open();

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket encargo</title>
      </head>

      <body style="
  margin:0;
  padding:6px;
  font-family:monospace;
  font-size:10px;
  line-height:1.25;
  width:204px;
  max-width:204px;
  overflow-wrap:anywhere;
  word-break:normal;
  background:white;
  color:black;
">

        <div style="text-align:center;">
          <div style="font-size:14px;font-weight:bold;">Speed Wash</div>
          <div>Encargo</div>
        </div>

        <div style="border-top:1px dashed #000;margin:5px 0;"></div>

        <div><b>Folio:</b> ${data.id}</div>
        <div><b>Fecha:</b> ${formatDateTime(data.created_at)}</div>
        <div><b>Empleado:</b> ${data.employee || "-"}</div>
        <div><b>Cliente:</b> ${data.client_name || "-"}</div>

        <div style="border-top:1px dashed #000;margin:5px 0;"></div>

        ${serviciosHTML}

        <div style="border-top:1px dashed #000;margin:5px 0;"></div>

<div style="display:flex;justify-content:space-between;gap:6px;padding-right:24px;font-size:12px;font-weight:bold;">
  <span>TOTAL</span>
  <span>${money(total)}</span>
</div>

<div style="display:flex;justify-content:space-between;gap:6px;padding-right:24px;">
  <span>ADELANTO</span>
  <span>${money(pagado)}</span>
</div>

<div style="display:flex;justify-content:space-between;gap:6px;padding-right:24px;">
  <span>RESTA</span>
  <span>${money(resta)}</span>
</div>

<div style="display:flex;justify-content:space-between;gap:6px;padding-right:24px;">
  <span>CAMBIO</span>
  <span>${money(cambioTicket)}</span>
</div>

<div style="border-top:1px dashed #000;margin:5px 0;"></div>

       <div><b>Estado:</b> ${humanDeliveredStatus(data.delivered_status)}</div>
       <div><b>Pago:</b> ${estadoPagoTicket}</div>
       <div><b>Método:</b> ${metodoPagoTicket}</div>

        <div style="border-top:1px dashed #000;margin:5px 0;"></div>

        <div style="text-align:center;">Gracias por su preferencia</div>

        <br><br>

        <button onclick="window.print()" style="width:100%;padding:10px;">
          Imprimir
        </button>

      </body>
    </html>
  `);

  win.document.close();
}

