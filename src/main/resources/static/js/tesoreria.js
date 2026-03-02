/* ============================================================
   TESORERÍA.JS — Sistema de Voluntariado
   CRUD, filtros, balance y gráficos
   ============================================================ */

const modal = document.getElementById("modalMovimiento");
const form  = document.getElementById("formMovimiento");
let editingId = null;
let chartMensual = null;
let chartCampana = null;

// ── Donación search state ──
let donacionesCache = [];
let donacionSeleccionada = null;

// ====================== INICIALIZACIÓN ======================
document.addEventListener("DOMContentLoaded", () => {
    cargarBalance();
    cargarMovimientos();
    cargarGraficos();
    cargarActividades();

    // Fecha por defecto = hoy
    document.getElementById("fechaMovimiento").valueAsDate = new Date();
});

// ====================== BALANCE ======================
async function cargarBalance() {
    try {
        const resp = await fetch("tesoreria?accion=balance");
        const data = await resp.json();

        document.getElementById("totalIngresos").textContent   = "S/ " + parseFloat(data.ingresos).toFixed(2);
        document.getElementById("totalGastos").textContent     = "S/ " + parseFloat(data.gastos).toFixed(2);
        document.getElementById("saldoDisponible").textContent = "S/ " + parseFloat(data.saldo).toFixed(2);

        // Color del saldo
        const saldoEl = document.getElementById("saldoDisponible");
        saldoEl.style.color = data.saldo >= 0 ? "#10b981" : "#ef4444";
    } catch (e) {
        console.error("Error al cargar balance:", e);
    }
}

// ====================== CARGAR ACTIVIDADES ======================
async function cargarActividades() {
    try {
        const resp = await fetch("actividades?action=listar");
        const actividades = await resp.json();

        const select = document.getElementById("idActividad");
        select.innerHTML = '<option value="0">Ninguna</option>';

        actividades.forEach(act => {
            const opt = document.createElement("option");
            opt.value = act.idActividad;
            opt.textContent = act.nombre;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Error al cargar actividades:", e);
    }
}

// ====================== MODAL ======================
function abrirModal() {
    modal.style.display = "flex";
    form.reset();
    editingId = null;
    donacionSeleccionada = null;
    document.getElementById("idDonacionSeleccionada").value = "0";
    document.getElementById("tipo").value = "GASTO";
    document.getElementById("tituloModal").textContent = "Registrar Gasto";
    document.getElementById("fechaMovimiento").valueAsDate = new Date();

    // Reset donación UI
    document.getElementById("buscarDonacion").value = "";
    document.getElementById("donacionDropdown").innerHTML = "";
    document.getElementById("donacionDropdown").classList.remove("show");
    document.getElementById("donacionInfoCard").style.display = "none";
    document.getElementById("donacionValidacionMsg").style.display = "none";
    document.getElementById("btnClearDonacion").style.display = "none";
    document.getElementById("seccionDonacion").style.display = "";

    cargarActividades();
    cargarDonacionesDisponibles();
}

function cerrarModal() {
    modal.style.display = "none";
}

// ====================== GUARDAR / ACTUALIZAR ======================
async function guardarMovimiento(event) {
    event.preventDefault();

    const montoVal = parseFloat(document.getElementById("monto").value) || 0;
    const idDonacion = parseInt(document.getElementById("idDonacionSeleccionada").value) || 0;

    // Validar contra saldo de donación si hay una seleccionada
    if (idDonacion > 0 && donacionSeleccionada) {
        if (montoVal > donacionSeleccionada.saldoDisponible) {
            Notify.error("El monto (S/ " + montoVal.toFixed(2) + ") excede el saldo disponible de la donación (S/ " + donacionSeleccionada.saldoDisponible.toFixed(2) + ")");
            return;
        }
    }

    const params = new URLSearchParams();
    params.append("tipo", document.getElementById("tipo").value);
    params.append("monto", document.getElementById("monto").value);
    params.append("descripcion", document.getElementById("descripcion").value);
    params.append("categoria", document.getElementById("categoria").value);
    params.append("comprobante", document.getElementById("comprobante").value);
    params.append("fechaMovimiento", document.getElementById("fechaMovimiento").value);
    params.append("idActividad", document.getElementById("idActividad").value);
    if (idDonacion > 0) params.append("idDonacion", idDonacion);

    if (editingId) {
        params.append("accion", "actualizar");
        params.append("idMovimiento", editingId);
    } else {
        params.append("accion", "registrar");
    }

    try {
        const resp = await fetch("tesoreria", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });

        const result = await resp.json();
        if (result.success) {
            cerrarModal();
            cargarMovimientos();
            cargarBalance();
            cargarGraficos();
        } else {
            Notify.error(result.message || "Error al guardar el movimiento");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

// ====================== EDITAR ======================
async function editarMovimiento(id) {
    abrirModal();
    editingId = id;
    // Ocultar sección donación al editar
    document.getElementById("seccionDonacion").style.display = "none";

    await cargarActividades();

    try {
        const resp = await fetch("tesoreria?accion=obtener&id=" + id);
        const m = await resp.json();

        document.getElementById("tipo").value = m.tipo;
        document.getElementById("monto").value = m.monto;
        document.getElementById("descripcion").value = m.descripcion;
        document.getElementById("categoria").value = m.categoria;
        document.getElementById("comprobante").value = m.comprobante || "";
        document.getElementById("fechaMovimiento").value = m.fechaMovimiento;
        document.getElementById("idActividad").value = m.idActividad || 0;

        document.getElementById("tituloModal").textContent = "Editar Gasto";
    } catch (e) {
        console.error("Error al obtener movimiento:", e);
    }
}

// ====================== ELIMINAR ======================
async function eliminarMovimiento(id) {
    const ok = await Notify.confirm("¿Eliminar este gasto?", "Esta acción no se puede deshacer.", { variant: 'danger', okText: 'Sí, eliminar' });
    if (!ok) return;

    try {
        const resp = await fetch("tesoreria?accion=eliminar&id=" + id);
        const result = await resp.json();

        if (result.success) {
            cargarMovimientos();
            cargarBalance();
            cargarGraficos();
        }
    } catch (e) {
        console.error("Error al eliminar:", e);
    }
}

// ====================== CARGAR TABLA ======================
async function cargarMovimientos() {
    try {
        const resp = await fetch("tesoreria?accion=listar");
        const data = await resp.json();
        renderTabla(data);
    } catch (e) {
        console.error("Error al cargar movimientos:", e);
    }
}

// ====================== FILTRAR ======================
async function filtrarMovimientos() {
    const tipo      = document.getElementById("filtroTipo").value;
    const categoria = document.getElementById("filtroCategoria").value;
    const fechaIni  = document.getElementById("filtroFechaIni").value;
    const fechaFin  = document.getElementById("filtroFechaFin").value;
    const busqueda  = (document.getElementById("filtroBusqueda").value || "").trim();

    const params = new URLSearchParams();
    params.append("accion", "filtrar");
    if (tipo)      params.append("tipo", tipo);
    if (categoria) params.append("categoria", categoria);
    if (fechaIni)  params.append("fechaInicio", fechaIni);
    if (fechaFin)  params.append("fechaFin", fechaFin);
    if (busqueda)  params.append("busqueda", busqueda);

    try {
        const resp = await fetch("tesoreria?" + params.toString());
        const data = await resp.json();
        renderTabla(data);
    } catch (e) {
        console.error("Error al filtrar:", e);
    }
}

function limpiarFiltros() {
    document.getElementById("filtroTipo").value = "";
    document.getElementById("filtroCategoria").value = "";
    document.getElementById("filtroFechaIni").value = "";
    document.getElementById("filtroFechaFin").value = "";
    document.getElementById("filtroBusqueda").value = "";
    cargarMovimientos();
}

// ====================== RENDER TABLA ======================
function renderTabla(data) {
    const tbody = document.getElementById("tbodyMovimientos");

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">No hay movimientos registrados</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(m => `
        <tr>
            <td>
                <span class="tag ${m.tipo === 'INGRESO' ? 'tag-ingreso' : 'tag-gasto'}">
                    ${m.tipo}
                </span>
            </td>
            <td><strong>S/ ${parseFloat(m.monto).toFixed(2)}</strong></td>
            <td>${m.descripcion}</td>
            <td>${m.categoria}</td>
            <td>${m.comprobante || '—'}</td>
            <td>${m.fechaMovimiento}</td>
            <td>${m.actividad || '—'}</td>
            <td>${m.usuarioRegistro}</td>
            <td class="acciones-cell">
                <button class="btn-icon edit" onclick="editarMovimiento(${m.idMovimiento})" title="Editar">✎</button>
                <button class="btn-icon delete" onclick="eliminarMovimiento(${m.idMovimiento})" title="Eliminar">🗑</button>
            </td>
        </tr>
    `).join("");
}

// ====================== GRÁFICOS ======================
async function cargarGraficos() {
    await cargarGraficoMensual();
    await cargarGraficoCampana();
}

async function cargarGraficoMensual() {
    try {
        const resp = await fetch("tesoreria?accion=resumenMensual");
        const data = await resp.json();

        const mesesRaw = data.map(d => d.mes).reverse();
        const ingresos = data.map(d => d.ingresos).reverse();
        const gastos   = data.map(d => d.gastos).reverse();

        // Formatear meses: "2026-03" → "Mar 2026"
        const nombresMes = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const meses = mesesRaw.map(m => {
            const [anio, mes] = m.split("-");
            return `${nombresMes[parseInt(mes) - 1]} ${anio}`;
        });

        if (chartMensual) chartMensual.destroy();

        const ctx = document.getElementById("chartMensual").getContext("2d");

        // Gradientes
        const gradIngreso = ctx.createLinearGradient(0, 0, 0, 350);
        gradIngreso.addColorStop(0, "rgba(16, 185, 129, 0.9)");
        gradIngreso.addColorStop(1, "rgba(16, 185, 129, 0.3)");

        const gradGasto = ctx.createLinearGradient(0, 0, 0, 350);
        gradGasto.addColorStop(0, "rgba(239, 68, 68, 0.9)");
        gradGasto.addColorStop(1, "rgba(239, 68, 68, 0.3)");

        chartMensual = new Chart(ctx, {
            type: "bar",
            data: {
                labels: meses,
                datasets: [
                    {
                        label: "Ingresos",
                        data: ingresos,
                        backgroundColor: gradIngreso,
                        borderColor: "#10b981",
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    },
                    {
                        label: "Gastos",
                        data: gastos,
                        backgroundColor: gradGasto,
                        borderColor: "#ef4444",
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            usePointStyle: true,
                            pointStyle: "rectRounded",
                            padding: 20,
                            font: { size: 13, weight: "500" }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        titleFont: { size: 14, weight: "600" },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        displayColors: true,
                        boxPadding: 6,
                        callbacks: {
                            label: c => ` ${c.dataset.label}: S/ ${c.parsed.y.toLocaleString("es-PE", {minimumFractionDigits: 2})}`,
                            footer: items => {
                                const total = items.reduce((s, i) => s + i.parsed.y, 0);
                                return `──────────\nNeto: S/ ${(items[0].parsed.y - (items[1]?.parsed.y || 0)).toLocaleString("es-PE", {minimumFractionDigits: 2})}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: "rgba(0,0,0,0.05)", drawBorder: false },
                        border: { display: false },
                        ticks: {
                            callback: v => "S/ " + v.toLocaleString(),
                            font: { size: 12 },
                            padding: 8
                        }
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            font: { size: 12, weight: "500" },
                            padding: 8
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Error gráfico mensual:", e);
    }
}

async function cargarGraficoCampana() {
    try {
        const resp = await fetch("tesoreria?accion=donacionesPorCampana");
        const data = await resp.json();

        const campanas    = data.map(d => d.campana);
        const confirmados = data.map(d => d.montoConfirmado);
        const pendientes  = data.map(d => d.montoPendiente);

        if (chartCampana) chartCampana.destroy();

        const ctx = document.getElementById("chartCampana").getContext("2d");
        chartCampana = new Chart(ctx, {
            type: "bar",
            data: {
                labels: campanas,
                datasets: [
                    {
                        label: "Confirmado",
                        data: confirmados,
                        backgroundColor: "rgba(16,185,129,0.8)",
                        borderColor: "#10b981",
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: "Pendiente",
                        data: pendientes,
                        backgroundColor: "rgba(245,158,11,0.8)",
                        borderColor: "#f59e0b",
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: S/ ${ctx.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => "S/ " + v.toLocaleString()
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Error gráfico campaña:", e);
    }
}

// ============================================================
// DONACIÓN DISPONIBLE — BUSCADOR DINÁMICO
// ============================================================

async function cargarDonacionesDisponibles() {
    try {
        const resp = await fetch("tesoreria?accion=donacionesDisponibles");
        donacionesCache = await resp.json();
    } catch (e) {
        console.error("Error al cargar donaciones disponibles:", e);
        donacionesCache = [];
    }
}

// Inicializar buscador
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("buscarDonacion");
    if (!input) return;

    let debounceTimer;
    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => filtrarDonaciones(input.value), 200);
    });

    input.addEventListener("focus", () => {
        if (!donacionSeleccionada) filtrarDonaciones(input.value);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener("click", (e) => {
        const wrapper = document.querySelector(".donacion-search-wrapper");
        if (wrapper && !wrapper.contains(e.target)) {
            document.getElementById("donacionDropdown").classList.remove("show");
        }
    });

    // Validar monto en tiempo real contra saldo de donación
    const montoInput = document.getElementById("monto");
    if (montoInput) {
        montoInput.addEventListener("input", validarMontoContraDonacion);
    }
});

function filtrarDonaciones(query) {
    const dropdown = document.getElementById("donacionDropdown");
    const q = (query || "").toLowerCase().trim();

    let filtradas = donacionesCache;
    if (q) {
        filtradas = donacionesCache.filter(d => {
            const texto = [
                "#" + d.idDonacion,
                d.donante,
                d.dni || "",
                d.ruc || "",
                d.actividadOrigen || ""
            ].join(" ").toLowerCase();
            return texto.includes(q);
        });
    }

    if (filtradas.length === 0) {
        dropdown.innerHTML = '<div class="donacion-dropdown-empty">No se encontraron donaciones disponibles</div>';
        dropdown.classList.add("show");
        return;
    }

    dropdown.innerHTML = filtradas.map(d => `
        <div class="donacion-dropdown-item" onclick="seleccionarDonacion(${d.idDonacion})">
            <div class="donacion-item-main">
                <span class="donacion-item-id">#${d.idDonacion}</span>
                <span class="donacion-item-donante">${d.donante}</span>
            </div>
            <div class="donacion-item-saldo">Disponible: S/ ${parseFloat(d.saldoDisponible).toFixed(2)}</div>
        </div>
    `).join("");

    dropdown.classList.add("show");
}

function seleccionarDonacion(idDonacion) {
    const d = donacionesCache.find(x => x.idDonacion === idDonacion);
    if (!d) return;

    donacionSeleccionada = d;
    document.getElementById("idDonacionSeleccionada").value = d.idDonacion;
    document.getElementById("buscarDonacion").value = `#${d.idDonacion} - ${d.donante} — S/ ${parseFloat(d.saldoDisponible).toFixed(2)}`;
    document.getElementById("btnClearDonacion").style.display = "flex";
    document.getElementById("donacionDropdown").classList.remove("show");

    // Mostrar info card
    const card = document.getElementById("donacionInfoCard");
    card.style.display = "block";
    document.getElementById("infoDonMontoOriginal").textContent = "S/ " + parseFloat(d.montoOriginal).toFixed(2);
    document.getElementById("infoDonSaldoDisp").textContent = "S/ " + parseFloat(d.saldoDisponible).toFixed(2);
    document.getElementById("infoDonDonante").textContent = d.donante;
    document.getElementById("infoDonActividad").textContent = d.actividadOrigen || "Sin actividad";

    validarMontoContraDonacion();
}

function limpiarDonacionSeleccionada() {
    donacionSeleccionada = null;
    document.getElementById("idDonacionSeleccionada").value = "0";
    document.getElementById("buscarDonacion").value = "";
    document.getElementById("btnClearDonacion").style.display = "none";
    document.getElementById("donacionInfoCard").style.display = "none";
    document.getElementById("donacionValidacionMsg").style.display = "none";
}

function validarMontoContraDonacion() {
    const msg = document.getElementById("donacionValidacionMsg");
    if (!donacionSeleccionada) {
        msg.style.display = "none";
        return;
    }

    const monto = parseFloat(document.getElementById("monto").value) || 0;
    if (monto > donacionSeleccionada.saldoDisponible) {
        msg.style.display = "block";
        msg.className = "donacion-validacion-msg donacion-val-error";
        msg.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> El monto (S/ ' + monto.toFixed(2) + ') excede el saldo disponible (S/ ' + donacionSeleccionada.saldoDisponible.toFixed(2) + ')';
    } else if (monto > 0) {
        msg.style.display = "block";
        msg.className = "donacion-validacion-msg donacion-val-ok";
        const restante = donacionSeleccionada.saldoDisponible - monto;
        msg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saldo restante después del gasto: S/ ' + restante.toFixed(2);
    } else {
        msg.style.display = "none";
    }
}
