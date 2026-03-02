/* ═══════════════════════════════════════════════════════════
   recursos-campana.js — Gestión de Stock de Recursos
   CRUD sobre tabla recurso con cálculo de disponibilidad
   ═══════════════════════════════════════════════════════════ */

const BASE = "recursos-campana";
let _recursos   = [];
let _editingId  = null;
let _paginaActual = 1;
let _porPagina    = 10;

/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", () => {
    cargarTipos();
    cargarRecursos();
});

/* ═══════════════════ CARGA DE DATOS ═══════════════════ */

async function cargarTipos() {
    try {
        const resp = await fetch(`${BASE}?accion=tipos`);
        const tipos = await resp.json();
        const sel = document.getElementById("filtroTipo");
        sel.innerHTML = '<option value="">Todos</option>';
        tipos.forEach(t => {
            if (t) sel.innerHTML += `<option value="${escHtml(t)}">${escHtml(t)}</option>`;
        });
    } catch (e) {
        console.error("Error cargando tipos:", e);
    }
}

async function cargarRecursos() {
    try {
        const resp = await fetch(`${BASE}?accion=listar`);
        _recursos = await resp.json();
        renderTabla();
        actualizarKpis();
    } catch (e) {
        console.error("Error cargando recursos:", e);
        document.getElementById("tbodyRecursos").innerHTML =
            '<tr><td colspan="8" class="empty-msg"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos</td></tr>';
    }
}

/* ═══════════════════ UTILIDADES DE ESTADO ═══════════════════ */

function calcEstadoStock(r) {
    if (r.cantidadTotal <= 0) return "AGOTADO";
    if (r.disponible <= 0) return "AGOTADO";
    const pctUsado = (r.asignado || 0) / r.cantidadTotal;
    if (pctUsado >= 0.8) return "BAJO";
    return "DISPONIBLE";
}

function badgeEstado(estado) {
    const config = {
        DISPONIBLE: { clase: "badge-disponible", icon: "fa-circle-check", text: "Disponible" },
        BAJO:       { clase: "badge-bajo",       icon: "fa-triangle-exclamation", text: "Bajo Stock" },
        AGOTADO:    { clase: "badge-agotado",    icon: "fa-ban", text: "Agotado" }
    };
    const c = config[estado] || config.DISPONIBLE;
    return `<span class="badge ${c.clase}"><i class="fa-solid ${c.icon}"></i> ${c.text}</span>`;
}

/* ═══════════════════ RENDER TABLA ═══════════════════ */

function renderTabla() {
    const tbody = document.getElementById("tbodyRecursos");
    const filtroTexto = document.getElementById("filtroBuscar").value.toLowerCase().trim();
    const filtroTipo  = document.getElementById("filtroTipo").value;
    const filtroDisp  = document.getElementById("filtroDisponibilidad").value;

    let datos = _recursos;

    // Filtro tipo
    if (filtroTipo) {
        datos = datos.filter(r => (r.tipoRecurso || "") === filtroTipo);
    }

    // Filtro disponibilidad
    if (filtroDisp) {
        datos = datos.filter(r => calcEstadoStock(r) === filtroDisp);
    }

    // Filtro texto libre
    if (filtroTexto) {
        datos = datos.filter(r =>
            (r.nombre || "").toLowerCase().includes(filtroTexto) ||
            (r.tipoRecurso || "").toLowerCase().includes(filtroTexto) ||
            (r.unidadMedida || "").toLowerCase().includes(filtroTexto) ||
            (r.descripcion || "").toLowerCase().includes(filtroTexto)
        );
    }

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-msg"><i class="fa-solid fa-box-open"></i> No se encontraron recursos</td></tr>';
        renderPaginacion(0);
        return;
    }

    // ── Paginación ──
    const totalFiltrado = datos.length;
    const inicio = (_paginaActual - 1) * _porPagina;
    const fin    = inicio + _porPagina;
    datos = datos.slice(inicio, fin);
    renderPaginacion(totalFiltrado);

    tbody.innerHTML = datos.map(r => {
        const estado = calcEstadoStock(r);
        const pctDisp = r.cantidadTotal > 0 ? Math.round((r.disponible / r.cantidadTotal) * 100) : 0;
        const barClass = estado === "AGOTADO" ? "agotado" : estado === "BAJO" ? "bajo" : "disponible";

        return `<tr>
            <td>
                <strong>${escHtml(r.nombre)}</strong>
                ${r.descripcion ? `<div style="font-size:.78rem;color:#6b7280;margin-top:2px">${escHtml(r.descripcion)}</div>` : ""}
            </td>
            <td><span class="badge-tipo">${escHtml(r.tipoRecurso || "-")}</span></td>
            <td style="text-align:center">${escHtml(r.unidadMedida || "-")}</td>
            <td style="text-align:center;font-weight:600">${formatNum(r.cantidadTotal)}</td>
            <td style="text-align:center;font-weight:600;color:#6366f1">${formatNum(r.asignado)}</td>
            <td>
                <div class="stock-disponible">
                    <span class="stock-num ${barClass}">${formatNum(r.disponible)}</span>
                    <div class="stock-bar">
                        <div class="stock-bar-fill ${barClass}" style="width:${pctDisp}%"></div>
                    </div>
                </div>
            </td>
            <td>${badgeEstado(estado)}</td>
            <td>
                <div class="acciones-cell">
                    <button class="btn-icon edit" title="Editar" onclick="abrirModalEditar(${r.idRecurso})">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon delete" title="Eliminar" onclick="eliminarRecurso(${r.idRecurso})">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function filtrarTabla() {
    _paginaActual = 1;
    renderTabla();
}

/* ═══════════════════ PAGINACIÓN ═══════════════════ */

function renderPaginacion(total) {
    const totalPaginas = Math.max(1, Math.ceil(total / _porPagina));
    if (_paginaActual > totalPaginas) _paginaActual = totalPaginas;

    const inicio = total === 0 ? 0 : (_paginaActual - 1) * _porPagina + 1;
    const fin    = Math.min(_paginaActual * _porPagina, total);

    document.getElementById("paginaInfo").textContent =
        total === 0 ? "Sin resultados" : `Mostrando ${inicio}–${fin} de ${total} registros`;

    // Botón anterior
    const btnPrev = document.getElementById("btnPrev");
    btnPrev.disabled = (_paginaActual <= 1);

    // Botón siguiente
    const btnNext = document.getElementById("btnNext");
    btnNext.disabled = (_paginaActual >= totalPaginas);

    // Números de página
    const numeros = document.getElementById("paginaNumeros");
    numeros.innerHTML = "";

    // Rango de páginas a mostrar (máx 5)
    let desde = Math.max(1, _paginaActual - 2);
    let hasta = Math.min(totalPaginas, desde + 4);
    if (hasta - desde < 4) desde = Math.max(1, hasta - 4);

    for (let i = desde; i <= hasta; i++) {
        const btn = document.createElement("button");
        btn.className = "pag-num" + (i === _paginaActual ? " active" : "");
        btn.textContent = i;
        btn.onclick = () => cambiarPagina(i);
        numeros.appendChild(btn);
    }
}

function cambiarPagina(p) {
    _paginaActual = p;
    renderTabla();
}

function cambiarPorPagina(val) {
    _porPagina    = parseInt(val);
    _paginaActual = 1;
    renderTabla();
}

/* ═══════════════════ KPIs ═══════════════════ */

function actualizarKpis() {
    let conStock = 0, bajoStock = 0, agotados = 0;
    _recursos.forEach(r => {
        const est = calcEstadoStock(r);
        if (est === "DISPONIBLE") conStock++;
        else if (est === "BAJO") bajoStock++;
        else agotados++;
    });

    document.getElementById("kpiTotal").textContent    = _recursos.length;
    document.getElementById("kpiConStock").textContent  = conStock;
    document.getElementById("kpiBajoStock").textContent = bajoStock;
    document.getElementById("kpiAgotados").textContent  = agotados;
}

/* ═══════════════════ MODAL ═══════════════════ */

function abrirModalRegistrar() {
    _editingId = null;
    document.getElementById("modalTitulo").textContent = "Nuevo Recurso";
    document.getElementById("btnGuardar").textContent  = "Registrar";
    document.getElementById("idRecurso").value         = "";
    document.getElementById("nombre").value            = "";
    document.getElementById("tipoRecurso").value       = "";
    document.getElementById("unidadMedida").value      = "";
    document.getElementById("cantidadTotal").value     = "";
    document.getElementById("descripcion").value       = "";

    document.getElementById("modalRecurso").style.display = "flex";
}

async function abrirModalEditar(id) {
    try {
        const resp = await fetch(`${BASE}?accion=obtener&id=${id}`);
        const r = await resp.json();

        if (r.error) {
            mostrarToast(r.error, "error");
            return;
        }

        _editingId = r.idRecurso;
        document.getElementById("modalTitulo").textContent = "Editar Recurso";
        document.getElementById("btnGuardar").textContent  = "Actualizar";
        document.getElementById("idRecurso").value         = r.idRecurso;
        document.getElementById("nombre").value            = r.nombre || "";
        document.getElementById("tipoRecurso").value       = r.tipoRecurso || "";
        document.getElementById("unidadMedida").value      = r.unidadMedida || "";
        document.getElementById("cantidadTotal").value     = r.cantidadTotal || 0;
        document.getElementById("descripcion").value       = r.descripcion || "";

        document.getElementById("modalRecurso").style.display = "flex";
    } catch (e) {
        console.error(e);
        mostrarToast("Error al obtener recurso", "error");
    }
}

function cerrarModal() {
    document.getElementById("modalRecurso").style.display = "none";
}

/* ═══════════════════ GUARDAR ═══════════════════ */

async function guardarRecurso(e) {
    e.preventDefault();

    const nombre       = document.getElementById("nombre").value.trim();
    const tipoRecurso  = document.getElementById("tipoRecurso").value;
    const unidadMedida = document.getElementById("unidadMedida").value;
    const cantidadTotal= document.getElementById("cantidadTotal").value;
    const descripcion  = document.getElementById("descripcion").value.trim();

    if (!nombre) {
        mostrarToast("Ingrese el nombre del recurso", "error");
        return;
    }
    if (!tipoRecurso) {
        mostrarToast("Seleccione el tipo de recurso", "error");
        return;
    }
    if (!unidadMedida) {
        mostrarToast("Seleccione la unidad de medida", "error");
        return;
    }
    if (!cantidadTotal || parseFloat(cantidadTotal) < 0) {
        mostrarToast("Ingrese un stock válido", "error");
        return;
    }

    const params = new URLSearchParams();
    params.append("nombre", nombre);
    params.append("tipoRecurso", tipoRecurso);
    params.append("unidadMedida", unidadMedida);
    params.append("cantidadTotal", cantidadTotal);
    params.append("descripcion", descripcion);

    if (_editingId) {
        params.append("accion", "actualizar");
        params.append("idRecurso", _editingId);
    } else {
        params.append("accion", "registrar");
    }

    try {
        const resp = await fetch(BASE, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, "success");
            cerrarModal();
            cargarRecursos();
            cargarTipos();
        } else {
            mostrarToast(data.message || "Error al guardar", "error");
        }
    } catch (e) {
        console.error(e);
        mostrarToast("Error de conexión", "error");
    }
}

/* ═══════════════════ ELIMINAR ═══════════════════ */

async function eliminarRecurso(id) {
    if (!confirm("¿Está seguro de eliminar este recurso? Se eliminarán también todas sus asignaciones a actividades.")) return;

    const params = new URLSearchParams();
    params.append("accion", "eliminar");
    params.append("idRecurso", id);

    try {
        const resp = await fetch(BASE, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });
        const data = await resp.json();
        if (data.success) {
            mostrarToast(data.message, "success");
            cargarRecursos();
        } else {
            mostrarToast(data.message || "Error al eliminar", "error");
        }
    } catch (e) {
        console.error(e);
        mostrarToast("Error de conexión", "error");
    }
}

/* ═══════════════════ TOAST ═══════════════════ */

function mostrarToast(msg, tipo = "info") {
    const container = document.getElementById("toastContainer");
    const icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<i class="fa-solid ${icons[tipo] || icons.info}"></i> ${escHtml(msg)}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; toast.style.transition = "opacity .3s"; }, 3000);
    setTimeout(() => toast.remove(), 3400);
}

/* ═══════════════════ UTILIDADES ═══════════════════ */

function escHtml(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function formatNum(n) {
    if (n == null) return "0";
    return Number(n) % 1 === 0 ? String(Math.round(n)) : Number(n).toFixed(2);
}
