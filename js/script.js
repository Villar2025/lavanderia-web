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

const ticketCliente = $("#ticketCliente");
const ticketKilos = $("#ticketKilos");
const ticketServicios = $("#ticketServicios");
const ticketEstado = $("#ticketEstado");
const ticketAdelanto = $("#ticketAdelanto");
const ticketResta = $("#ticketResta");
const ticketPagoEstado = $("#ticketPagoEstado");

let lastTicketData = null;

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

function cleanText(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N");
}

function formatNowForTicket() {
  const now = new Date();

  return now.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildTicketFromSale(saleId, salePayload) {
  return {
    id: saleId,
    date: formatNowForTicket(),
    employee: salePayload.employee,
    items: salePayload.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      subtotal: item.subtotal
    })),
    total: salePayload.total,
    cash: salePayload.cash,
    change: salePayload.change
  };
}

function fillTicket(ticketData) {
  if (!ticketData) return;

  ticketSaleId.textContent = ticketData.id ?? "-";
  ticketDate.textContent = ticketData.date ?? "-";
  ticketEmployee.textContent = cleanText(ticketData.employee ?? "-");

  ticketItemsBody.innerHTML = "";

  for (const item of ticketData.items || []) {
    const tr = document.createElement("tr");
  
    const shortName = cleanText(item.name)
      .replace("Secadora 9 kg", "Sec. 9kg")
      .replace("Lavadora 16 kg", "Lav. 16kg")
      .replace("Lavadora 9 kg", "Lav. 9kg")
      .replace("Lavadora 4 kg", "Lav. 4kg")
      .replace("Solo secado", "Secado")
      .replace("1 medida de ", "")
      .replace("Suavizante (botella)", "Suavizante");
  
      tr.innerHTML = `
        <td colspan="3" style="text-align:left;">
          ${shortName} x${item.qty}<br>
          ${money(item.subtotal)}
        </td>
      `;
  
    ticketItemsBody.appendChild(tr);
  }

  ticketTotal.textContent = money(ticketData.total || 0);
  ticketCash.textContent = money(ticketData.cash || 0);
  ticketChange.textContent = money(ticketData.change || 0);
}

function fillEncargoTicket(row) {
  const total = Number(row.total || 0);
  const pago = Number(row.amount_paid || 0);

  const adelanto = Math.min(pago, total);
  const resta = Math.max(total - pago, 0);
  const cambio = pago > total ? (pago - total) : 0;

  let pagoEstado = "PENDIENTE";
  if (pago >= total) {
    pagoEstado = "PAGADO";
  } else if (pago > 0) {
    pagoEstado = "ADELANTO";
  }

  ticketSaleId.textContent = `ENC-${row.id}`;
  ticketDate.textContent = formatDateTime(row.created_at) || "-";
  ticketEmployee.textContent = row.employee || "-";
  ticketCliente.textContent = row.client_name || "-";

  ticketKilos.textContent = `Kilos: ${Number(row.kilos || 0)} kg`;

  ticketServicios.innerHTML = `
    Lavadoras: ${Number(row.used_lavadora_16 || 0) + Number(row.used_lavadora_9 || 0) + Number(row.used_lavadora_4 || 0)}<br>
    Secadoras: ${Number(row.used_secadora_15 || 0) + Number(row.used_secadora_30 || 0)}<br>
    Detergente: ${Number(row.used_jabon || 0)}<br>
    Suavizante: ${Number(row.used_suavizante || 0)}
  `;

  ticketTotal.textContent = money(total);
  ticketAdelanto.textContent = money(adelanto);
  ticketResta.textContent = money(resta);
  ticketChange.textContent = money(cambio);

  ticketEstado.textContent = humanDeliveredStatus(row.delivered_status);
  ticketPagoEstado.textContent = pagoEstado;

  ticketItemsBody.innerHTML = "";
}

async function printEncargoById(id) {
  ensureSupabase();

  const { data, error } = await supabaseClient
    .from("encargos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    alert(`Error al cargar encargo: ${error.message}`);
    return;
  }

  fillEncargoTicket(data);
  printTicket();
}

function printTicket() {
  if (!lastTicketData) {
    statusEl.textContent = "Primero registra una venta para imprimir el ticket.";
    return;
  }

  fillTicket(lastTicketData);

  const ticketHtml = document.getElementById("ticketContent").innerHTML;

  const printWindow = window.open("", "_blank", "width=340,height=700");

  if (!printWindow) {
    statusEl.textContent = "No se pudo abrir la ventana del ticket.";
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Vista previa del ticket</title>
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #000000;
          font-family: Arial, sans-serif;
        }

        .ticket {
          width: 58mm;
          max-width: 58mm;
          padding: 6px;
          box-sizing: border-box;
          font-size: 12px;
          line-height: 1.35;
          color: #000;
          background: #fff;
          margin: 0 auto;
        }

        .ticketCenter {
          text-align: center;
        }

        .ticketLine {
          border: none;
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .ticketTable {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .ticketTable td {
          display: block;
          width: 100%;
          text-align: center;
        }

        .ticketTable tr {
          display: block;
          margin-bottom: 4px;
        }

        .ticketTable th:nth-child(2),
        .ticketTable td:nth-child(2),
        .ticketTable th:nth-child(3),
        .ticketTable td:nth-child(3) {
          text-align: right;
        }

        .ticketRow {
          display: block;
          text-align: center;
          font-size: 7px;
          margin: 1px 0;
         }

        .ticketRow strong {
          display: block;
          font-size: 8px;
        }

        .printBar {
          position: sticky;
          top: 0;
          background: #fff;
          border-bottom: 1px solid #ccc;
          padding: 10px;
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .printBtn {
          padding: 8px 14px;
          border: 1px solid #000;
          background: #fff;
          cursor: pointer;
        }

        @media print {
          .printBar {
            display: none;
          }

          html, body {
            width: 58mm;
            margin: 0;
            padding: 0;
          }

          .ticket {
            width: 58mm;
            max-width: 58mm;
            margin: 0;
            padding: 6px;
          }

          @page {
            size: 58mm auto;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="printBar">
        <button class="printBtn" onclick="window.print()">Imprimir</button>
      </div>

      <div class="ticket">
        ${ticketHtml}
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
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
      <td>${item.category}</td>
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
  const cash = wholeMoney(cashEl.value || 0);
  const change = cash - total;

  if (!Number.isFinite(cash) || cash <= 0) return (statusEl.textContent = "Escribe el dinero recibido.");
  if (change < 0) return (statusEl.textContent = "El dinero recibido no alcanza para cubrir el total.");

  const salePayload = {
    employee,
    date,
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
  
    lastSaved = res.id;
    lastTicketData = buildTicketFromSale(res.id, salePayload);
  
    statusEl.textContent = `✅ Venta registrada (ID: ${res.id}).`;
    newBtn.disabled = false;
    if (printTicketBtn) printTicketBtn.disabled = false;
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
  lastTicketData = null; // 👈 IMPORTANTE

  cashEl.value = "";
  statusEl.textContent = "";

  newBtn.disabled = true;

  if (printTicketBtn) {
    printTicketBtn.disabled = true; // 👈 IMPORTANTE
  }

  render();
});

if (printTicketBtn) {
  printTicketBtn.addEventListener("click", printTicket);
}

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

  if (!data || data.length === 0) {
    salesStatus.textContent = "No hay ventas con esos filtros.";
    salesSummary.style.display = "none";
    return;
  }

  salesStatus.textContent = `Listo: ${data.length} venta(s).`;

  const totalVentas = data.length;
  const totalIngreso = data.reduce((sum, v) => sum + Number(v.total), 0);

  summaryCount.textContent = totalVentas;
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

logoutBtn.addEventListener("click", () => {
  viewSalesSection.style.display = "none";

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

const edredonIndividual = $("#edredonIndividual");
const edredonMatrimonial = $("#edredonMatrimonial");
const edredonKing = $("#edredonKing");

const colchaIndividual = $("#colchaIndividual");
const colchaMatrimonial = $("#colchaMatrimonial");
const colchaKing = $("#colchaKing");

const mantelesKilos = $("#mantelesKilos");
const almohadasPeluchesQty = $("#almohadasPeluchesQty");
const almohadasPeluchesPrice = $("#almohadasPeluchesPrice");

const encargoPaymentStatus = $("#encargoPaymentStatus");
const encargoAmountPaid = $("#encargoAmountPaid");

const encargoTotal = $("#encargoTotal");
const encargoResult = $("#encargoResult");
const encargoResultLabel = $("#encargoResultLabel");
const encargoStatus = $("#encargoStatus");
const saveEncargoBtn = $("#saveEncargoBtn");
const newEncargoBtn = $("#newEncargoBtn");

function num(val) {
  return Number(val || 0);
}

function calcEncargoTotal() {
  const kilos = num(encargoKilos.value);
  const kilosSubtotal = kilos * 26;

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

  return wholeMoney(kilosSubtotal + edredonSubtotal + colchaSubtotal + mantelesSubtotal + almohadasSubtotal);
}

function updateEncargoSummary() {
  const total = calcEncargoTotal();
  const paid = wholeMoney(encargoAmountPaid.value);
  const status = encargoPaymentStatus.value;

  encargoTotal.textContent = money(total);

  if (status === "pagado") {
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
  edredonIndividual,
  edredonMatrimonial,
  edredonKing,
  colchaIndividual,
  colchaMatrimonial,
  colchaKing,
  mantelesKilos,
  almohadasPeluchesQty,
  almohadasPeluchesPrice,
  encargoAmountPaid,
  encargoPaymentStatus
].forEach((el) => {
  el.addEventListener("input", updateEncargoSummary);
  el.addEventListener("change", updateEncargoSummary);
});

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

encargoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const employee = encargoEmployee.value;
  const clientName = encargoClientName.value.trim();
  const clientPhone = encargoClientPhone.value.trim();
  const kilos = num(encargoKilos.value);

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

  if (paymentStatus === "pagado" && amountPaid < total) {
    encargoStatus.textContent = "Si está marcado como pagado, el dinero debe cubrir el total.";
    return;
  }

  const kilosSubtotal = wholeMoney(kilos * 26);
  const mantelesSubtotal = wholeMoney(num(mantelesKilos.value) * 55);
  const almohadasSubtotal = wholeMoney(almohadasPeluchesPrice.value);

  const cambio = paymentStatus === "pagado" ? wholeMoney(amountPaid - total) : 0;
  const amountDue = paymentStatus === "pendiente" ? wholeMoney(Math.max(total - amountPaid, 0)) : 0;

  const payload = {
    employee,
    client_name: clientName,
    client_phone: clientPhone,
    kilos,
    kilos_price: 26,
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

    almohadas_peluches_qty: num(almohadasPeluchesQty.value),
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

    if (!res.ok) throw new Error(res.error || "No se pudo guardar.");

    encargoStatus.textContent = `✅ Encargo registrado (ID: ${res.id}).`;
    newEncargoBtn.disabled = false;
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

  edredonIndividual.value = 0;
  edredonMatrimonial.value = 0;
  edredonKing.value = 0;

  colchaIndividual.value = 0;
  colchaMatrimonial.value = 0;
  colchaKing.value = 0;

  mantelesKilos.value = 0;

  almohadasPeluchesQty.value = 0;
  almohadasPeluchesPrice.value = 0;

  encargoPaymentStatus.value = "pagado";
  encargoAmountPaid.value = 0;

  encargoStatus.textContent = "";
  newEncargoBtn.disabled = true;

  updateEncargoSummary();
});

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

const encargoDetailPanel = $("#encargoDetailPanel");
const closeEncargoDetailBtn = $("#closeEncargoDetailBtn");
const saveEncargoUsageBtn = $("#saveEncargoUsageBtn");
const encargoDetailStatus = $("#encargoDetailStatus");

const detailEncargoId = $("#detailEncargoId");
const detailEncargoCliente = $("#detailEncargoCliente");
const detailEncargoEmpleado = $("#detailEncargoEmpleado");
const detailEncargoTotal = $("#detailEncargoTotal");

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
const detailDelivered = $("#detailDelivered");
const detailPaymentResultLabel = $("#detailPaymentResultLabel");
const detailPaymentResult = $("#detailPaymentResult");

let currentEncargoId = null;
let currentEncargoTotal = 0;
let currentEncargoPaid = 0;

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
      payment_status,
      amount_paid,
      total,
      change,
      amount_due,
      delivered_status
    `)
    .order("created_at", { ascending: false });

  if (encargoFromDate.value) {
    q = q.gte("created_at", `${encargoFromDate.value} 00:00:00`);
  }

  if (encargoToDate.value) {
    q = q.lte("created_at", `${encargoToDate.value} 23:59:59`);
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
  <td>${row.id}</td>
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
    <button type="button" class="ghost" data-print-encargo="${row.id}" style="width:auto; padding:8px 10px; margin-left:6px;">
      Imprimir
    </button>
  </td>
`;

    encargosBody.appendChild(tr);
  }
}

async function openEncargoDetail(id) {
  ensureSupabase();
  
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

  if (!currentEncargoId) {
    encargoDetailStatus.textContent = "No hay encargo seleccionado.";
    return;
  }

  const paymentStatus = detailPaymentStatus.value;
  const amountPaid = wholeMoney(Number(currentEncargoPaid || 0) + Number(detailAbonoHoy?.value || 0));
  const deliveredStatus = detailDelivered.value === "entregado" ? "entregado" : "pendiente";
  const total = Number(currentEncargoTotal || 0);

  if (paymentStatus === "pagado" && amountPaid < total) {
    encargoDetailStatus.textContent = "Si marcas como pagado, el monto debe cubrir el total.";
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
    change: paymentStatus === "pagado" ? wholeMoney(amountPaid - total) : 0,
    amount_due: paymentStatus === "pendiente" ? wholeMoney(Math.max(total - amountPaid, 0)) : 0,

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
      return;
    }

    const printId = btn.dataset.printEncargo;
    if (printId) {
      printEncargoById(printId);
      return;
    }
  });
}

if (closeEncargoDetailBtn) {
  closeEncargoDetailBtn.addEventListener("click", () => {
    encargoDetailPanel.style.display = "none";
    currentEncargoId = null;
    currentEncargoTotal = 0;
    encargoDetailStatus.textContent = "";
  });
}

if (saveEncargoUsageBtn) {
  saveEncargoUsageBtn.addEventListener("click", saveEncargoUsageAndDelivery);
}

// =====================
// Tabs
// =====================
const tabBtns = document.querySelectorAll(".tabBtn");
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
const viewEncargosSummaryPaid = $("#viewEncargosSummaryPaid");
const viewEncargosSummaryDue = $("#viewEncargosSummaryDue");
const viewEncargosSummaryCambio = $("#viewEncargosSummaryCambio");

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
  return value === "pagado" ? "Pagado" : "Pendiente / Adelanto";
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

  if (viewEncargoEmployeeFilter && viewEncargoEmployeeFilter.value) {
    q = q.eq("employee", viewEncargoEmployeeFilter.value);
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

  const totalEncargos = data.length;

  let totalVendido = 0;
  let totalCobrado = 0;
  let totalPorCobrar = 0;
  let totalCambio = 0;

  for (const row of data) {
    const total = Number(row.total || 0);
    const pagado = Number(row.amount_paid || 0);

    const porCobrar = Math.max(total - pagado, 0);
    const cambio = Math.max(pagado - total, 0);

    totalVendido += total;
    totalCobrado += pagado;
    totalPorCobrar += porCobrar;
    totalCambio += cambio;
  }

  viewEncargosSummaryCount.textContent = totalEncargos;
  viewEncargosSummaryTotal.textContent = money(totalVendido);
  viewEncargosSummaryPaid.textContent = money(totalCobrado);
  viewEncargosSummaryDue.textContent = money(totalPorCobrar);
  if (viewEncargosSummaryCambio) {
    viewEncargosSummaryCambio.textContent = money(totalCambio);
  }
  viewEncargosSummary.style.display = "block";

  viewEncargosStatus.textContent = `Listo: ${totalEncargos} encargo(s).`;

  for (const row of data) {
    const total = Number(row.total || 0);
    const pagado = Number(row.amount_paid || 0);
    const porCobrar = Math.max(total - pagado, 0);
    const cambio = Math.max(pagado - total, 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateTime(row.created_at)}</td>
      <td>${row.employee || ""}</td>
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

  if (encargosError) {
    console.error(encargosError);
    usageSummaryStatus.textContent = `❌ Error al cargar encargos: ${encargosError.message}`;
    return;
  }

  const encargosUsage = createEmptyUsageMap();

  for (const row of encargosData || []) {
    encargosUsage["Lavadora 16 kg"] += Number(row.used_lavadora_16 || 0);
    encargosUsage["Lavadora 9 kg"] += Number(row.used_lavadora_9 || 0);
    encargosUsage["Lavadora 4 kg"] += Number(row.used_lavadora_4 || 0);

    encargosUsage["Secadora 9 kg (15 min)"] += Number(row.used_secadora_15 || 0);
    encargosUsage["Secadora 9 kg (30 min)"] += Number(row.used_secadora_30 || 0) * 2;

    encargosUsage["1 medida de jabón"] += Number(row.used_jabon || 0);
    encargosUsage["1 medida de suavizante"] += Number(row.used_suavizante || 0);
    encargosUsage["1 medida de desmugrante"] += Number(row.used_desmugrante || 0);

    encargosUsage["Bolsa chica"] += Number(row.used_bolsa_chica || 0);
    encargosUsage["Bolsa mediana"] += Number(row.used_bolsa_mediana || 0);
    encargosUsage["Bolsa grande"] += Number(row.used_bolsa_grande || 0);
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










