/* ===================================================================
   SALIDAS DE DONACIONES - JavaScript
   Multi-donacion, buscador AJAX, modal, paginacion, filtros, CRUD
=================================================================== */

const modalSalida = document.getElementById("modalSalida");
const formSalida = document.getElementById("formSalida");
const btnGuardarSalida = document.getElementById("btnGuardarSalida");
const accionSalidaInput = document.getElementById("accionSalida");
const idSalidaInput = document.getElementById("idSalida");
const tipoSalidaHidden = document.getElementById("tipoSalidaHidden");
const idDonacionHidden = document.getElementById("idDonacion");
const actividadDestinoSelect = document.getElementById("actividadDestino");
const buscarSalidasInput = document.getElementById("buscarSalidas");
const PAGINA_TAMANO_S = 5;

// ═══════════════════════════════════════════════════════
// MULTI-DONACION: Estado
// ═══════════════════════════════════════════════════════

let donacionesSeleccionadas = []; // [{id, donante, saldoDisponible, cantidadOriginal, montoAsignado, actividadOrigen}]
let donacionStagingData = null;   // Temp: donacion seleccionada del buscador, pendiente de agregar
let modoEdicion = false;          // true cuando se esta editando una salida existente

// ═══════════════════════════════════════════════════════
// AUTOCOMPLETADO: Buscador AJAX de donaciones
// ═══════════════════════════════════════════════════════

const buscarDonacionInput = document.getElementById("buscarDonacion");
const donacionResultados = document.getElementById("donacionResultados");
let searchTimeout = null;

function inicializarAutocompletado() {
    if (!buscarDonacionInput) return;

    buscarDonacionInput.addEventListener("input", function () {
        const query = this.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            cerrarDropdown();
            return;
        }

        searchTimeout = setTimeout(() => buscarDonacionesAjax(query), 300);
    });

    document.addEventListener("click", function (e) {
        const wrapper = document.getElementById("donacionAutocompleteWrapper");
        if (wrapper && !wrapper.contains(e.target)) {
            cerrarDropdown();
        }
    });

    buscarDonacionInput.addEventListener("keydown", function (e) {
        const items = donacionResultados.querySelectorAll(".autocomplete-item");
        const activeItem = donacionResultados.querySelector(".autocomplete-item.active");
        let idx = Array.from(items).indexOf(activeItem);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (idx < items.length - 1) idx++;
            else idx = 0;
            items.forEach(i => i.classList.remove("active"));
            if (items[idx]) { items[idx].classList.add("active"); items[idx].scrollIntoView({ block: "nearest" }); }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (idx > 0) idx--;
            else idx = items.length - 1;
            items.forEach(i => i.classList.remove("active"));
            if (items[idx]) { items[idx].classList.add("active"); items[idx].scrollIntoView({ block: "nearest" }); }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeItem) activeItem.click();
        } else if (e.key === "Escape") {
            cerrarDropdown();
        }
    });
}

async function buscarDonacionesAjax(query) {
    try {
        donacionResultados.innerHTML = '<div class="autocomplete-loading"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>';
        donacionResultados.classList.add("open");

        const resp = await fetch(`salidas-donaciones?accion=buscar_donaciones&query=${encodeURIComponent(query)}`);
        const data = await resp.json();

        if (!data.results || data.results.length === 0) {
            donacionResultados.innerHTML = '<div class="autocomplete-empty"><i class="fa-solid fa-inbox"></i> No se encontraron donaciones</div>';
            return;
        }

        // Filtrar las donaciones ya seleccionadas
        const idsSeleccionados = donacionesSeleccionadas.map(d => d.id);
        const resultadosFiltrados = data.results.filter(d => !idsSeleccionados.includes(d.id));

        if (resultadosFiltrados.length === 0) {
            donacionResultados.innerHTML = '<div class="autocomplete-empty"><i class="fa-solid fa-check-double"></i> Todas las donaciones coincidentes ya fueron agregadas</div>';
            return;
        }

        let html = "";
        resultadosFiltrados.forEach(d => {
            const donante = normalizarTextoVisual(d.donante || "");
            const actividadOrigen = normalizarTextoVisual(d.actividadOrigen || "");
            const saldoText = `S/ ${Number(d.saldoDisponible).toFixed(2)} disponible`;
            html += `
                <div class="autocomplete-item" data-donacion='${JSON.stringify(d).replace(/'/g, "&#39;")}'>
                    <div class="ac-item-header">
                        <span class="ac-item-id">#${d.id}</span>
                        <span class="ac-item-tipo tag dinero">DINERO</span>
                    </div>
                    <div class="ac-item-body">
                        <div class="ac-item-donante"><i class="fa-solid fa-user"></i> ${donante}</div>
                        <div class="ac-item-saldo"><i class="fa-solid fa-wallet"></i> ${saldoText}</div>
                    </div>
                    <div class="ac-item-footer">
                        <span class="ac-item-origen"><i class="fa-solid fa-bullhorn"></i> ${actividadOrigen}</span>
                        <span class="ac-item-original">Original: S/ ${Number(d.cantidadOriginal).toFixed(2)}</span>
                    </div>
                </div>`;
        });

        donacionResultados.innerHTML = html;

        donacionResultados.querySelectorAll(".autocomplete-item").forEach(item => {
            item.addEventListener("click", function () {
                const donData = JSON.parse(this.dataset.donacion);
                mostrarStaging(donData);
            });
        });

    } catch (err) {
        console.error("Error al buscar donaciones:", err);
        donacionResultados.innerHTML = '<div class="autocomplete-empty"><i class="fa-solid fa-triangle-exclamation"></i> Error al buscar</div>';
    }
}

function cerrarDropdown() {
    donacionResultados.innerHTML = "";
    donacionResultados.classList.remove("open");
}

// ═══════════════════════════════════════════════════════
// STAGING: Donacion pendiente de agregar
// ═══════════════════════════════════════════════════════

function mostrarStaging(donacion) {
    if (donacionesSeleccionadas.find(d => d.id === donacion.id)) {
        Notify.warning("Esta donacion ya fue agregada a la lista.");
        return;
    }

    donacionStagingData = donacion;
    const stagingDiv = document.getElementById("donacionStaging");
    const donante = normalizarTextoVisual(donacion.donante || "ANONIMO");

    document.getElementById("stagingId").textContent = `#${donacion.id}`;
    document.getElementById("stagingDonante").textContent = donante;
    document.getElementById("stagingSaldo").textContent = `S/ ${Number(donacion.saldoDisponible).toFixed(2)}`;

    const montoInput = document.getElementById("stagingMonto");
    montoInput.value = "";
    montoInput.max = donacion.saldoDisponible;

    stagingDiv.style.display = "flex";
    cerrarDropdown();
    buscarDonacionInput.value = "";

    setTimeout(() => montoInput.focus(), 100);
}

function agregarDonacion() {
    if (!donacionStagingData) return;

    const montoInput = document.getElementById("stagingMonto");
    const monto = parseFloat(montoInput.value);

    if (isNaN(monto) || monto <= 0) {
        Notify.warning("Ingrese un monto valido mayor a 0.");
        montoInput.focus();
        return;
    }

    const saldoDisp = parseFloat(donacionStagingData.saldoDisponible);
    if (monto > saldoDisp) {
        Notify.warning(`El monto S/ ${monto.toFixed(2)} excede el saldo disponible de S/ ${saldoDisp.toFixed(2)}.`);
        montoInput.focus();
        return;
    }

    donacionesSeleccionadas.push({
        id: donacionStagingData.id,
        donante: donacionStagingData.donante || "ANONIMO",
        saldoDisponible: saldoDisp,
        cantidadOriginal: donacionStagingData.cantidadOriginal,
        actividadOrigen: donacionStagingData.actividadOrigen || "",
        montoAsignado: monto
    });

    cancelarStaging();
    actualizarListaDonaciones();
    Notify.success("Donacion agregada correctamente");
}

function cancelarStaging() {
    donacionStagingData = null;
    document.getElementById("donacionStaging").style.display = "none";
    buscarDonacionInput.focus();
}

// ═══════════════════════════════════════════════════════
// LISTA DE DONACIONES SELECCIONADAS
// ═══════════════════════════════════════════════════════

function removerDonacion(id) {
    donacionesSeleccionadas = donacionesSeleccionadas.filter(d => d.id !== id);
    actualizarListaDonaciones();
}

function actualizarListaDonaciones() {
    const container = document.getElementById("donacionesListaContainer");
    const itemsDiv = document.getElementById("donacionesItems");
    const totalSpan = document.getElementById("totalDonaciones");

    if (donacionesSeleccionadas.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";

    let html = "";
    let total = 0;
    donacionesSeleccionadas.forEach(d => {
        total += d.montoAsignado;
        const donante = normalizarTextoVisual(d.donante || "ANONIMO");
        html += `
            <div class="donacion-item">
                <div class="donacion-item-info">
                    <span class="donacion-item-id">#${d.id}</span>
                    <span class="donacion-item-donante">${donante}</span>
                    <span class="donacion-item-saldo">Saldo: S/ ${Number(d.saldoDisponible).toFixed(2)}</span>
                </div>
                <div class="donacion-item-monto">S/ ${d.montoAsignado.toFixed(2)}</div>
                <button type="button" class="donacion-item-remove" onclick="removerDonacion(${d.id})" title="Quitar donacion">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>`;
    });

    itemsDiv.innerHTML = html;
    totalSpan.textContent = `Total: S/ ${total.toFixed(2)}`;
}

function obtenerTotalDonaciones() {
    return donacionesSeleccionadas.reduce((sum, d) => sum + d.montoAsignado, 0);
}

function limpiarMultiDonacion() {
    donacionesSeleccionadas = [];
    donacionStagingData = null;
    document.getElementById("donacionStaging").style.display = "none";
    document.getElementById("donacionesListaContainer").style.display = "none";
    document.getElementById("donacionesItems").innerHTML = "";
    if (buscarDonacionInput) {
        buscarDonacionInput.value = "";
        buscarDonacionInput.disabled = false;
    }
}

// ═══════════════════════════════════════════════════════
// MODAL: Abrir / Cerrar
// ═══════════════════════════════════════════════════════

function abrirModalSalida() {
    formSalida.reset();
    idSalidaInput.value = "";
    idDonacionHidden.value = "";
    accionSalidaInput.value = "registrar";
    modoEdicion = false;

    document.getElementById("tituloModalSalida").innerHTML =
        '<i class="fa-solid fa-arrow-right-from-bracket"></i> Registrar Salida';
    btnGuardarSalida.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Registrar Salida';

    tipoSalidaHidden.value = "DINERO";

    // Mostrar modo creacion (multi-donacion)
    document.getElementById("createDonacionSection").style.display = "block";
    document.getElementById("editDonacionSection").style.display = "none";
    document.getElementById("montoSalidaGroup").style.display = "none";

    limpiarMultiDonacion();
    cargarActividadesDestino();

    modalSalida.style.display = "flex";
    setTimeout(() => buscarDonacionInput.focus(), 200);
}

function cerrarModalSalida() {
    modalSalida.style.display = "none";
    cerrarDropdown();
}

if (modalSalida) {
    modalSalida.addEventListener("click", function (e) {
        if (e.target === modalSalida) cerrarModalSalida();
    });
}

// ═══════════════════════════════════════════════════════
// CARGAR DATOS: Actividades destino
// ═══════════════════════════════════════════════════════

async function cargarActividadesDestino() {
    try {
        const resp = await fetch("salidas-donaciones?accion=actividades");
        const actividades = await resp.json();

        actividadDestinoSelect.innerHTML = '<option value="">Seleccione campana destino</option>';
        actividades.forEach(a => {
            const opt = document.createElement("option");
            opt.value = a.idActividad;
            opt.textContent = normalizarTextoVisual(a.nombre || "");
            actividadDestinoSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Error al cargar actividades:", err);
    }
}

// ═══════════════════════════════════════════════════════
// EDITAR SALIDA (modo single-donacion)
// ═══════════════════════════════════════════════════════

async function editarSalida(id) {
    try {
        const resp = await fetch(`salidas-donaciones?accion=obtener&id=${id}`);
        const data = await resp.json();

        if (data.ok === false) {
            Notify.error(data.message || "Salida no encontrada");
            return;
        }

        if (data.estado && data.estado.toUpperCase() !== "PENDIENTE") {
            Notify.warning("Solo se pueden editar salidas con estado PENDIENTE.");
            return;
        }

        formSalida.reset();
        accionSalidaInput.value = "editar";
        idSalidaInput.value = data.idSalida;
        modoEdicion = true;

        document.getElementById("tituloModalSalida").innerHTML =
            '<i class="fa-solid fa-pen-to-square"></i> Editar Salida';
        btnGuardarSalida.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';

        await cargarActividadesDestino();

        // Obtener saldo disponible de la donacion origen
        let saldoData = null;
        try {
            const saldoResp = await fetch(`salidas-donaciones?accion=saldo_donacion&id=${data.idDonacion}`);
            saldoData = await saldoResp.json();
        } catch (e) {
            console.warn("No se pudo obtener saldo:", e);
        }

        const saldoDisp = saldoData ? (Number(saldoData.saldoDisponible) + data.cantidad) : data.donacionCantidad;
        const donante = normalizarTextoVisual(data.donanteNombre || "ANONIMO");

        // Configurar idDonacion para el POST del form
        idDonacionHidden.value = data.idDonacion;

        // Mostrar modo edicion (single-donacion)
        document.getElementById("createDonacionSection").style.display = "none";
        document.getElementById("editDonacionSection").style.display = "block";
        document.getElementById("montoSalidaGroup").style.display = "block";

        document.getElementById("editDonInfo").textContent = `#${data.idDonacion} - ${donante}`;
        document.getElementById("editDonSaldo").textContent = `S/ ${Number(saldoDisp).toFixed(2)} disponible`;
        document.getElementById("editDonDonante").textContent = donante;

        // Llenar campos
        actividadDestinoSelect.value = data.idActividad;
        document.getElementById("cantidadSalida").value = data.cantidad;
        document.getElementById("cantidadSalida").max = saldoDisp;
        document.getElementById("cantidadSalida").required = true;
        document.getElementById("descripcionSalida").value = data.descripcion || "";

        limpiarMultiDonacion();
        modalSalida.style.display = "flex";
    } catch (err) {
        console.error("Error al obtener salida:", err);
        Notify.error("Error al cargar la informacion de la salida.");
    }
}

// ═══════════════════════════════════════════════════════
// ANULAR SALIDA
// ═══════════════════════════════════════════════════════

async function anularSalida(id) {
    const motivo = prompt("Motivo de anulacion:", "Anulacion manual");
    if (motivo === null) return;

    try {
        const resp = await fetch("salidas-donaciones?accion=anular", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `idSalida=${id}&motivo=${encodeURIComponent(motivo)}`
        });
        const data = await resp.json();
        if (data.ok) {
            Notify.success("Salida anulada correctamente");
            setTimeout(() => location.reload(), 1200);
        } else {
            Notify.error(data.message || "No se pudo anular la salida");
        }
    } catch (err) {
        console.error("Error al anular salida:", err);
        Notify.error("Error de conexion al anular la salida.");
    }
}

// ═══════════════════════════════════════════════════════
// CAMBIAR ESTADO
// ═══════════════════════════════════════════════════════

async function cambiarEstadoSalida(id, estado) {
    const ok = await Notify.confirm(`Cambiar estado a "${estado}"?`, "", { variant: "info", okText: "Si, confirmar" });
    if (!ok) return;

    try {
        const resp = await fetch("salidas-donaciones?accion=cambiar_estado", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `idSalida=${id}&estado=${encodeURIComponent(estado)}`
        });
        const data = await resp.json();
        if (data.ok) {
            Notify.success("Estado actualizado correctamente");
            setTimeout(() => location.reload(), 1200);
        } else {
            Notify.error(data.message || "No se pudo cambiar el estado");
        }
    } catch (err) {
        console.error("Error al cambiar estado:", err);
        Notify.error("Error de conexion al cambiar el estado.");
    }
}

// ═══════════════════════════════════════════════════════
// FILTROS Y BUSQUEDA (tabla principal)
// ═══════════════════════════════════════════════════════

function filtrarSalidas() {
    const texto = (buscarSalidasInput?.value || "").toLowerCase().trim();
    const filtroEstado = document.getElementById("filtroEstado")?.value || "";
    const filas = document.querySelectorAll("#tbodySalidas .salida-row");

    filas.forEach(fila => {
        const contenido = fila.textContent.toLowerCase();
        const estado = fila.dataset.estado || "";

        let visible = true;
        if (texto && !contenido.includes(texto)) visible = false;
        if (filtroEstado && estado !== filtroEstado) visible = false;

        fila.dataset.filtroVisible = visible ? "1" : "0";
    });

    paginaActualS = 1;
    paginacionSalidas();
}

if (buscarSalidasInput) {
    buscarSalidasInput.addEventListener("input", filtrarSalidas);
}

// ═══════════════════════════════════════════════════════
// PAGINACION CLIENT-SIDE
// ═══════════════════════════════════════════════════════

let paginaActualS = 1;

function paginacionSalidas() {
    const todasLasFilas = Array.from(document.querySelectorAll("#tbodySalidas .salida-row"));
    const filasVisibles = todasLasFilas.filter(f => (f.dataset.filtroVisible || "1") === "1");
    const totalPaginas = Math.ceil(filasVisibles.length / PAGINA_TAMANO_S) || 1;
    const paginacionDiv = document.getElementById("salidasPaginacion");
    const textoEl = document.getElementById("textoPaginacionSalidas");

    if (paginaActualS > totalPaginas) paginaActualS = totalPaginas;

    todasLasFilas.forEach(fila => {
        fila.style.display = "none";
    });

    filasVisibles.forEach((fila, i) => {
        const pagina = Math.floor(i / PAGINA_TAMANO_S) + 1;
        fila.style.display = pagina === paginaActualS ? "" : "none";
    });

    if (filasVisibles.length > PAGINA_TAMANO_S) {
        paginacionDiv.style.display = "flex";
        textoEl.textContent = `Pagina ${paginaActualS} de ${totalPaginas}`;
        document.getElementById("btnPaginaAnteriorS").disabled = paginaActualS <= 1;
        document.getElementById("btnPaginaSiguienteS").disabled = paginaActualS >= totalPaginas;
    } else {
        paginacionDiv.style.display = "none";
    }
}

function normalizarTextoVisual(texto) {
    if (!texto) return texto;
    let limpio = texto;
    limpio = limpio
        .replace(/AN.{0,3}NIMO/gi, "ANONIMO")
        .replace(/campa.{0,3}a/gi, "campana")
        .replace(/Ã¡/g, "a")
        .replace(/Ã©/g, "e")
        .replace(/Ã­/g, "i")
        .replace(/Ã³/g, "o")
        .replace(/Ãº/g, "u")
        .replace(/Ã±/g, "n")
        .replace(/Â/g, "")
        .replace(/�/g, "");
    return limpio;
}

function corregirTextosRotos() {
    const selectoresSeguros = [
        "#tbodySalidas .origin-donante",
        "#tbodySalidas .origin-monto",
        "#tbodySalidas .campana-destino span",
        "#tbodySalidas .desc-text",
        "#tbodySalidas td:nth-child(5)",
        "#tbodySalidas td:nth-child(6)",
        "#actividadDestino option"
    ];

    document.querySelectorAll(selectoresSeguros.join(",")).forEach(el => {
        el.textContent = normalizarTextoVisual(el.textContent);
    });
}

document.getElementById("btnPaginaAnteriorS")?.addEventListener("click", () => {
    if (paginaActualS > 1) { paginaActualS--; paginacionSalidas(); }
});
document.getElementById("btnPaginaSiguienteS")?.addEventListener("click", () => {
    paginaActualS++;
    paginacionSalidas();
});

// ═══════════════════════════════════════════════════════
// SUBMIT: Registrar (AJAX multi-donacion) / Editar (form POST)
// ═══════════════════════════════════════════════════════

if (formSalida) {
    formSalida.addEventListener("submit", async function (e) {
        e.preventDefault();

        const accion = accionSalidaInput.value;

        // -- MODO EDICION: form POST normal --
        if (accion === "editar" || modoEdicion) {
            const donacionId = idDonacionHidden.value;
            const actividad = actividadDestinoSelect.value;
            const cantidad = parseFloat(document.getElementById("cantidadSalida").value || 0);

            if (!donacionId) {
                Notify.warning("Falta la donacion origen.");
                return;
            }
            if (!actividad) {
                Notify.warning("Debe seleccionar una campana/actividad destino.");
                return;
            }
            if (cantidad <= 0) {
                Notify.warning("La cantidad debe ser mayor a 0.");
                return;
            }

            // Enviar como form POST
            this.submit();
            return;
        }

        // -- MODO CREACION: AJAX multi-donacion --
        if (donacionesSeleccionadas.length === 0) {
            Notify.warning("Debe agregar al menos una donacion origen.");
            buscarDonacionInput.focus();
            return;
        }

        const actividad = actividadDestinoSelect.value;
        if (!actividad) {
            Notify.warning("Debe seleccionar una campana/actividad destino.");
            return;
        }

        const descripcion = document.getElementById("descripcionSalida").value.trim();
        const donaciones = donacionesSeleccionadas.map(d => ({
            idDonacion: d.id,
            monto: d.montoAsignado
        }));

        const totalAsignado = obtenerTotalDonaciones();
        if (totalAsignado <= 0) {
            Notify.warning("El monto total debe ser mayor a 0.");
            return;
        }

        try {
            btnGuardarSalida.disabled = true;
            btnGuardarSalida.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';

            const resp = await fetch("salidas-donaciones?accion=registrar_multiple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    donaciones: donaciones,
                    actividad: parseInt(actividad),
                    descripcion: descripcion
                })
            });

            const result = await resp.json();

            if (result.ok) {
                Notify.success(result.message || "Salidas registradas correctamente");
                setTimeout(() => location.reload(), 1200);
            } else {
                Notify.error(result.message || "Error al registrar las salidas");
            }
        } catch (err) {
            console.error("Error al registrar salidas:", err);
            Notify.error("Error de conexion al registrar las salidas.");
        } finally {
            btnGuardarSalida.disabled = false;
            btnGuardarSalida.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Registrar Salida';
        }
    });
}

// ═══════════════════════════════════════════════════════
// INICIALIZACION
// ═══════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function () {
    inicializarAutocompletado();
    filtrarSalidas();
    corregirTextosRotos();
});

