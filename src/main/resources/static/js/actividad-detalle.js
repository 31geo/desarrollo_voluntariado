// ══════════════════════════════════════════════════
//  ACTIVIDAD DETALLE — JS
// ══════════════════════════════════════════════════

const ID_ACT = document.getElementById('idActividad').value;
const BASE = 'actividad-detalle';
let CUPO_MAX = parseInt(document.getElementById('cupoMaximo').value) || 0;
let INSCRITOS = parseInt(document.getElementById('inscritos').value) || 0;

// ── TABS ───────────────────────────────────────
function cambiarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelector(`.tab-btn[onclick="cambiarTab('${tab}')"]`).classList.add('active');

    if (tab === 'recursos') cargarRecursos();
    if (tab === 'participantes') cargarParticipantes();
    if (tab === 'beneficiarios') cargarBeneficiarios();
    if (tab === 'localidades') cargarLocalidades();
}

// ══════════════════════════════════════
//  RECURSOS
// ══════════════════════════════════════
function cargarRecursos() {
    fetch(`${BASE}?action=recursos&id=${ID_ACT}`)
        .then(r => r.json())
        .then(lista => {
            _recursosAsignadosIds = lista.map(ar => ar.idRecurso);
            const tbody = document.getElementById('tbody-recursos');
            if (!lista.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No hay recursos asignados aún</td></tr>';
                return;
            }
            tbody.innerHTML = lista.map(ar => {
                const prioClass = ar.prioridad === 'ALTA' ? 'prio-alta' : ar.prioridad === 'BAJA' ? 'prio-baja' : 'prio-media';
                return `<tr>
                    <td><strong>${ar.nombreRecurso || 'Recurso #' + ar.idRecurso}</strong><br><small>${ar.unidadMedida || ''}</small></td>
                    <td>${ar.tipoRecurso || '—'}</td>
                    <td>${formatNumDetalle(ar.cantidadRequerida)}</td>
                    <td><span class="badge-prio ${prioClass}">${ar.prioridad || 'MEDIA'}</span></td>
                    <td>
                        <button class="btn-icon edit" onclick="abrirEditarRecurso(${ar.idActividadRecurso}, '${(ar.nombreRecurso || '').replace(/'/g,"\\'")}', ${ar.cantidadRequerida}, '${ar.prioridad || 'MEDIA'}', '${(ar.observacion || '').replace(/'/g,"\\'")}')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="eliminarRecurso(${ar.idActividadRecurso})" title="Quitar"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }).catch(() => {
            document.getElementById('tbody-recursos').innerHTML = '<tr><td colspan="5" class="empty-msg">Error al cargar recursos</td></tr>';
        });
}

let _listaRecursos = [];
let _recursoSeleccionado = null;
let _editandoRecursoId = null; // null = agregar, number = editar
let _recursosAsignadosIds = []; // IDs de recursos ya vinculados a esta actividad

function abrirModalRecurso() {
    _editandoRecursoId = null;
    _recursoSeleccionado = null;
    document.getElementById('modalRecursoTitulo').textContent = 'Agregar Recurso';
    document.getElementById('btnGuardarRecurso').textContent = 'Agregar';
    document.getElementById('recursoSearchWrap').style.display = '';
    document.getElementById('recursoNombreReadonly').style.display = 'none';
    document.getElementById('selRecurso').value = '';
    document.getElementById('buscarRecursoInput').value = '';
    document.getElementById('clearRecursoBtn').style.display = 'none';
    document.getElementById('recursoDropdown').innerHTML = '';
    document.getElementById('recursoDropdown').classList.remove('open');
    document.getElementById('cantidadRequerida').value = '';
    document.getElementById('prioridadRecurso').value = 'MEDIA';
    document.getElementById('obsRecurso').value = '';

    // Cargar lista de recursos disponibles
    fetch(`${BASE}?action=catalogoRecursos`)
        .then(r => r.json()).then(lista => {
            _listaRecursos = Array.isArray(lista) ? lista : [];
        }).catch(() => { _listaRecursos = []; });

    document.getElementById('modalRecurso').style.display = 'flex';
    setTimeout(() => document.getElementById('buscarRecursoInput').focus(), 200);
}
function cerrarModalRecurso() {
    document.getElementById('modalRecurso').style.display = 'none';
    document.getElementById('recursoDropdown').classList.remove('open');
    _editandoRecursoId = null;
}

function abrirEditarRecurso(idAR, nombre, cantidad, prioridad, obs) {
    _editandoRecursoId = idAR;
    _recursoSeleccionado = null;
    document.getElementById('modalRecursoTitulo').textContent = 'Editar Recurso';
    document.getElementById('btnGuardarRecurso').textContent = 'Guardar';
    // Ocultar buscador y mostrar nombre fijo
    document.getElementById('recursoSearchWrap').style.display = 'none';
    document.getElementById('recursoNombreReadonly').style.display = '';
    document.getElementById('recursoNombreReadonly').textContent = nombre;
    document.getElementById('selRecurso').value = '';
    document.getElementById('cantidadRequerida').value = cantidad;
    document.getElementById('prioridadRecurso').value = prioridad;
    document.getElementById('obsRecurso').value = obs || '';
    document.getElementById('modalRecurso').style.display = 'flex';
}

function renderRecursoDropdown(lista) {
    const dropdown = document.getElementById('recursoDropdown');
    if (!lista || lista.length === 0) {
        dropdown.innerHTML = '<div class="search-select-empty">No se encontraron recursos</div>';
        dropdown.classList.add('open');
        return;
    }
    dropdown.innerHTML = lista.map(r => {
        const disponible = r.disponible != null ? r.disponible : r.cantidadTotal || 0;
        const total = r.cantidadTotal || 0;
        const agotado = disponible <= 0;
        const bajo = !agotado && total > 0 && (disponible / total) <= 0.2;
        const yaAsignado = _recursosAsignadosIds.includes(r.idRecurso);
        const estadoClass = yaAsignado ? 'recurso-asignado' : agotado ? 'recurso-agotado' : bajo ? 'recurso-bajo' : '';
        const estadoLabel = yaAsignado
            ? '<span style="color:#6366f1;font-weight:600;font-size:.78rem"><i class="fas fa-check-circle"></i> Ya asignado a esta actividad</span>'
            : agotado
            ? '<span style="color:#c53030;font-weight:600;font-size:.78rem">Sin disponibilidad</span>'
            : bajo
                ? `<span style="color:#b45309;font-weight:600;font-size:.78rem">Bajo stock: ${formatNumDetalle(disponible)} de ${formatNumDetalle(total)}</span>`
                : `<span style="color:#047857;font-weight:600;font-size:.78rem">Disponible: ${formatNumDetalle(disponible)} de ${formatNumDetalle(total)}</span>`;

        return `
            <div class="search-select-option ${estadoClass}" data-id="${r.idRecurso}" data-nombre="${r.nombre}" data-unidad="${r.unidadMedida || 'Unidad'}" data-disponible="${disponible}" ${agotado ? 'data-agotado="true"' : ''} ${yaAsignado ? 'data-asignado="true"' : ''}>
                <div class="search-opt-name">${r.nombre}</div>
                <div class="search-opt-dni">${r.tipoRecurso || '—'} — ${r.unidadMedida || 'Unidad'}</div>
                <div>${estadoLabel}</div>
            </div>
        `;
    }).join('');
    dropdown.querySelectorAll('.search-select-option').forEach(opt => {
        opt.addEventListener('click', function() {
            if (this.dataset.asignado === 'true') {
                mostrarToast('Este recurso ya está asignado a esta actividad', 'warning');
                return;
            }
            if (this.dataset.agotado === 'true') {
                alert('Este recurso no tiene disponibilidad. Registre más stock en Gestión de Stock.');
                return;
            }
            seleccionarRecurso(this.dataset.id, this.dataset.nombre, this.dataset.unidad);
        });
    });
    dropdown.classList.add('open');
}

function formatNumDetalle(n) {
    if (n == null) return "0";
    return Number(n) % 1 === 0 ? String(Math.round(Number(n))) : Number(n).toFixed(2);
}

function seleccionarRecurso(id, nombre, unidad) {
    _recursoSeleccionado = id;
    document.getElementById('selRecurso').value = id;
    document.getElementById('buscarRecursoInput').value = nombre + ' (' + unidad + ')';
    document.getElementById('clearRecursoBtn').style.display = 'flex';
    document.getElementById('recursoDropdown').classList.remove('open');
}

function limpiarSeleccionRecurso() {
    _recursoSeleccionado = null;
    document.getElementById('selRecurso').value = '';
    document.getElementById('buscarRecursoInput').value = '';
    document.getElementById('clearRecursoBtn').style.display = 'none';
    document.getElementById('recursoDropdown').innerHTML = '';
    document.getElementById('recursoDropdown').classList.remove('open');
    document.getElementById('buscarRecursoInput').focus();
}

// Eventos de búsqueda de recursos
document.addEventListener('DOMContentLoaded', function() {
    const inputR = document.getElementById('buscarRecursoInput');
    if (inputR) {
        inputR.addEventListener('input', function() {
            _recursoSeleccionado = null;
            document.getElementById('selRecurso').value = '';
            const q = this.value.trim().toLowerCase();
            document.getElementById('clearRecursoBtn').style.display = q ? 'flex' : 'none';
            if (!q) {
                document.getElementById('recursoDropdown').innerHTML = '';
                document.getElementById('recursoDropdown').classList.remove('open');
                return;
            }
            const filtrados = _listaRecursos.filter(r => {
                const texto = ((r.nombre || '') + ' ' + (r.tipoRecurso || '') + ' ' + (r.unidadMedida || '')).toLowerCase();
                return texto.includes(q);
            });
            renderRecursoDropdown(filtrados);
        });
        inputR.addEventListener('focus', function() {
            const q = this.value.trim().toLowerCase();
            if (!_recursoSeleccionado && q && _listaRecursos.length > 0) {
                const filtrados = _listaRecursos.filter(r => {
                    const texto = ((r.nombre || '') + ' ' + (r.tipoRecurso || '') + ' ' + (r.unidadMedida || '')).toLowerCase();
                    return texto.includes(q);
                });
                renderRecursoDropdown(filtrados);
            }
        });
    }
    const clearBtnR = document.getElementById('clearRecursoBtn');
    if (clearBtnR) clearBtnR.addEventListener('click', limpiarSeleccionRecurso);
    document.addEventListener('click', function(e) {
        const cR = document.getElementById('recursoSearchContainer');
        if (cR && !cR.contains(e.target)) {
            document.getElementById('recursoDropdown').classList.remove('open');
        }
    });
});

let _guardandoRecurso = false;
function guardarRecurso(e) {
    e.preventDefault();
    if (_guardandoRecurso) return;
    _guardandoRecurso = true;
    const btn = document.getElementById('btnGuardarRecurso');
    btn.disabled = true;

    const params = new URLSearchParams();

    if (_editandoRecursoId) {
        params.append('action', 'actualizarRecurso');
        params.append('idActividadRecurso', _editandoRecursoId);
    } else {
        const idRecurso = document.getElementById('selRecurso').value;
        if (!idRecurso) {
            mostrarToast('Seleccione un recurso de la lista', 'warning');
            _guardandoRecurso = false; btn.disabled = false;
            return;
        }
        params.append('action', 'agregarRecurso');
        params.append('idActividad', ID_ACT);
        params.append('idRecurso', idRecurso);
    }
    params.append('cantidadRequerida', document.getElementById('cantidadRequerida').value);
    params.append('prioridad', document.getElementById('prioridadRecurso').value);
    params.append('observacion', document.getElementById('obsRecurso').value);

    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cerrarModalRecurso(); cargarRecursos(); mostrarToast(res.message, 'success'); }
            else mostrarToast(res.message, 'error');
        }).catch(() => mostrarToast('Error al guardar recurso', 'error'))
        .finally(() => { _guardandoRecurso = false; btn.disabled = false; });
}

function eliminarRecurso(idAR) {
    if (!confirm('¿Eliminar este recurso de la actividad?')) return;
    const params = new URLSearchParams();
    params.append('action', 'eliminarRecurso');
    params.append('idActividadRecurso', idAR);
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cargarRecursos(); mostrarToast('Recurso eliminado', 'success'); }
            else mostrarToast(res.message, 'error');
        });
}

// ── Modal inline: Nuevo Recurso en Stock ──
function abrirModalNuevoRecursoStock() {
    document.getElementById('formNuevoRecursoStock').reset();
    document.getElementById('modalNuevoRecursoStock').style.display = 'flex';
}
function cerrarModalNuevoRecursoStock() {
    document.getElementById('modalNuevoRecursoStock').style.display = 'none';
}
let _guardandoStock = false;
function guardarNuevoRecursoStock(e) {
    e.preventDefault();
    if (_guardandoStock) return;
    _guardandoStock = true;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    const params = new URLSearchParams();
    params.append('accion', 'registrar');
    params.append('nombre', document.getElementById('stockNombre').value);
    params.append('tipoRecurso', document.getElementById('stockTipoRecurso').value);
    params.append('unidadMedida', document.getElementById('stockUnidadMedida').value);
    params.append('cantidadTotal', document.getElementById('stockCantidadTotal').value);
    params.append('descripcion', document.getElementById('stockDescripcion').value);

    fetch('recursos-campana', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) {
                cerrarModalNuevoRecursoStock();
                mostrarToast('Recurso creado en stock', 'success');
                fetch(`${BASE}?action=catalogoRecursos`)
                    .then(r => r.json()).then(lista => { _listaRecursos = Array.isArray(lista) ? lista : []; })
                    .catch(() => {});
            } else {
                mostrarToast(res.message, 'error');
            }
        }).catch(() => mostrarToast('Error al registrar recurso', 'error'))
        .finally(() => { _guardandoStock = false; if (btn) btn.disabled = false; });
}

// ══════════════════════════════════════
//  PARTICIPANTES
// ══════════════════════════════════════
function cargarParticipantes() {
    fetch(`${BASE}?action=participantes&id=${ID_ACT}`)
        .then(r => r.json())
        .then(lista => {
            const tbody = document.getElementById('tbody-participantes');
            INSCRITOS = lista.length;
            if (!lista.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No hay voluntarios asignados aún</td></tr>';
                return;
            }
            tbody.innerHTML = lista.map(p => `<tr>
                <td><strong>${p.nombreVoluntario}</strong></td>
                <td>${p.dniVoluntario || '—'}</td>
                <td>${p.carreraVoluntario || '—'}</td>
                <td><button class="btn-icon delete" onclick="eliminarParticipante(${p.idParticipacion})" title="Quitar"><i class="fas fa-trash"></i></button></td>
            </tr>`).join('');
        }).catch(() => {
            document.getElementById('tbody-participantes').innerHTML = '<tr><td colspan="4" class="empty-msg">Error al cargar participantes</td></tr>';
        });
}

let _listaVoluntarios = [];
let _voluntarioSeleccionado = null;

function abrirModalParticipante() {
    if (CUPO_MAX > 0 && INSCRITOS >= CUPO_MAX) {
        mostrarToast('No hay cupos disponibles (' + INSCRITOS + '/' + CUPO_MAX + ')', 'warning');
        return;
    }
    _voluntarioSeleccionado = null;
    document.getElementById('selVoluntario').value = '';
    const input = document.getElementById('buscarVoluntarioInput');
    input.value = '';
    document.getElementById('clearVoluntarioBtn').style.display = 'none';
    document.getElementById('voluntarioDropdown').innerHTML = '';
    document.getElementById('voluntarioDropdown').classList.remove('open');
    const btnAsignar = document.getElementById('btnAsignarVol');
    btnAsignar.disabled = true; btnAsignar.style.opacity = '0.5';

    fetch('voluntarios?action=listar')
        .then(r => r.json()).then(lista => {
            const activos = lista.filter(v => v.estado === 'ACTIVO');
            // Deduplicar por DNI (queda el de menor id = más antiguo)
            const vistos = new Set();
            _listaVoluntarios = activos.filter(v => {
                const clave = v.dni || ('id-' + v.idVoluntario);
                if (vistos.has(clave)) return false;
                vistos.add(clave);
                return true;
            });
            // No mostrar dropdown hasta que el usuario escriba algo
        });
    document.getElementById('modalParticipante').style.display = 'flex';
    setTimeout(() => input.focus(), 200);
}

function cerrarModalParticipante() {
    document.getElementById('modalParticipante').style.display = 'none';
    document.getElementById('voluntarioDropdown').classList.remove('open');
}

function renderVoluntarioDropdown(lista) {
    const dropdown = document.getElementById('voluntarioDropdown');
    if (!lista || lista.length === 0) {
        dropdown.innerHTML = '<div class="search-select-empty">No se encontraron voluntarios</div>';
        dropdown.classList.add('open');
        return;
    }
    dropdown.innerHTML = lista.map(v => `
        <div class="search-select-option" data-id="${v.idVoluntario}" data-nombre="${v.nombres} ${v.apellidos}" data-dni="${v.dni || ''}">
            <div class="search-opt-name">${v.nombres} ${v.apellidos}</div>
            <div class="search-opt-dni">DNI: ${v.dni || 'Sin DNI'}</div>
        </div>
    `).join('');
    dropdown.querySelectorAll('.search-select-option').forEach(opt => {
        opt.addEventListener('click', function () {
            seleccionarVoluntario(this.dataset.id, this.dataset.nombre, this.dataset.dni);
        });
    });
    dropdown.classList.add('open');
}

function seleccionarVoluntario(id, nombre, dni) {
    _voluntarioSeleccionado = id;
    document.getElementById('selVoluntario').value = id;
    const input = document.getElementById('buscarVoluntarioInput');
    input.value = nombre + (dni ? ' — ' + dni : '');
    document.getElementById('clearVoluntarioBtn').style.display = 'flex';
    document.getElementById('voluntarioDropdown').classList.remove('open');
    const btnAsignar = document.getElementById('btnAsignarVol');
    btnAsignar.disabled = false; btnAsignar.style.opacity = '1';
}

function limpiarSeleccionVoluntario() {
    _voluntarioSeleccionado = null;
    document.getElementById('selVoluntario').value = '';
    const input = document.getElementById('buscarVoluntarioInput');
    input.value = '';
    document.getElementById('clearVoluntarioBtn').style.display = 'none';
    const btnAsignar = document.getElementById('btnAsignarVol');
    btnAsignar.disabled = true; btnAsignar.style.opacity = '0.5';
    document.getElementById('voluntarioDropdown').innerHTML = '';
    document.getElementById('voluntarioDropdown').classList.remove('open');
    input.focus();
}

document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('buscarVoluntarioInput');
    if (input) {
        input.addEventListener('input', function () {
            _voluntarioSeleccionado = null;
            document.getElementById('selVoluntario').value = '';
            const btnAsignar = document.getElementById('btnAsignarVol');
            btnAsignar.disabled = true; btnAsignar.style.opacity = '0.5';
            const q = this.value.trim().toLowerCase();
            document.getElementById('clearVoluntarioBtn').style.display = q ? 'flex' : 'none';
            if (!q) {
                document.getElementById('voluntarioDropdown').innerHTML = '';
                document.getElementById('voluntarioDropdown').classList.remove('open');
                return;
            }
            const filtrados = _listaVoluntarios.filter(v => {
                const texto = (v.nombres + ' ' + v.apellidos + ' ' + (v.dni || '')).toLowerCase();
                return texto.includes(q);
            });
            renderVoluntarioDropdown(filtrados);
        });
        input.addEventListener('focus', function () {
            const q = this.value.trim().toLowerCase();
            if (!_voluntarioSeleccionado && q && _listaVoluntarios.length > 0) {
                const filtrados = _listaVoluntarios.filter(v => {
                    const texto = (v.nombres + ' ' + v.apellidos + ' ' + (v.dni || '')).toLowerCase();
                    return texto.includes(q);
                });
                renderVoluntarioDropdown(filtrados);
            }
        });
    }
    const clearBtn = document.getElementById('clearVoluntarioBtn');
    if (clearBtn) clearBtn.addEventListener('click', limpiarSeleccionVoluntario);

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function (e) {
        const container = document.getElementById('voluntarioSearchContainer');
        if (container && !container.contains(e.target)) {
            document.getElementById('voluntarioDropdown').classList.remove('open');
        }
    });
});

function guardarParticipante(e) {
    e.preventDefault();
    const idVol = document.getElementById('selVoluntario').value;
    if (!idVol) {
        mostrarToast('Seleccione un voluntario de la lista', 'warning');
        return;
    }
    const params = new URLSearchParams();
    params.append('action', 'agregarParticipante');
    params.append('idActividad', ID_ACT);
    params.append('idVoluntario', idVol);
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cerrarModalParticipante(); cargarParticipantes(); mostrarToast(res.message, 'success'); }
            else mostrarToast(res.message, 'error');
        }).catch(() => mostrarToast('Error al asignar voluntario', 'error'));
}

function eliminarParticipante(id) {
    if (!confirm('¿Quitar a este voluntario de la actividad?')) return;
    const params = new URLSearchParams();
    params.append('action', 'eliminarParticipante');
    params.append('idParticipacion', id);
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cargarParticipantes(); mostrarToast('Participante removido', 'success'); }
            else mostrarToast(res.message, 'error');
        });
}

// ══════════════════════════════════════
//  BENEFICIARIOS
// ══════════════════════════════════════
function cargarBeneficiarios() {
    fetch(`${BASE}?action=beneficiarios&id=${ID_ACT}`)
        .then(r => r.json())
        .then(lista => {
            const tbody = document.getElementById('tbody-beneficiarios');
            if (!lista.length) {
                tbody.innerHTML = '<tr><td colspan="10" class="empty-msg">No hay beneficiarios vinculados aún</td></tr>';
                return;
            }
            tbody.innerHTML = lista.map(ab => `<tr>
                <td>${ab.organizacion || '—'}</td>
                <td>${ab.direccion || '—'}</td>
                <td>${ab.distrito || '—'}</td>
                <td>${ab.necesidadPrincipal || '—'}</td>
                <td>${ab.observaciones || '—'}</td>
                <td>${ab.nombreResponsable || '—'}</td>
                <td>${ab.apellidosResponsable || '—'}</td>
                <td>${ab.dni || '—'}</td>
                <td>${ab.telefono || '—'}</td>
                <td><button class="btn-icon delete" onclick="eliminarBeneficiario(${ab.idActividadBeneficiario})" title="Desvincular"><i class="fas fa-trash"></i></button></td>
            </tr>`).join('');
        }).catch(() => {
            document.getElementById('tbody-beneficiarios').innerHTML = '<tr><td colspan="10" class="empty-msg">Error al cargar beneficiarios</td></tr>';
        });
}

let _listaBeneficiarios = [];
let _beneficiarioSeleccionado = null;

function abrirModalBeneficiario() {
    _beneficiarioSeleccionado = null;
    document.getElementById('selBeneficiario').value = '';
    document.getElementById('buscarBeneficiarioInput').value = '';
    document.getElementById('clearBeneficiarioBtn').style.display = 'none';
    document.getElementById('beneficiarioDropdown').innerHTML = '';
    document.getElementById('beneficiarioDropdown').classList.remove('open');
    document.getElementById('obsBeneficiario').value = '';
    const btnVincular = document.getElementById('btnVincularBen');
    btnVincular.disabled = true; btnVincular.style.opacity = '0.5';

    cargarListaBeneficiarios();
    document.getElementById('modalBeneficiario').style.display = 'flex';
    setTimeout(() => document.getElementById('buscarBeneficiarioInput').focus(), 200);
}

function cargarListaBeneficiarios() {
    fetch('beneficiarios?action=listar')
        .then(r => r.json()).then(lista => {
            _listaBeneficiarios = (Array.isArray(lista) ? lista : []).filter(b => b.estado === 'ACTIVO');
            // No mostrar dropdown hasta que el usuario escriba algo
        });
}

function renderBeneficiarioDropdown(lista) {
    const dropdown = document.getElementById('beneficiarioDropdown');
    if (!lista || lista.length === 0) {
        dropdown.innerHTML = '<div class="search-select-empty">No se encontraron beneficiarios</div>';
        dropdown.classList.add('open');
        return;
    }
    dropdown.innerHTML = lista.map(b => `
        <div class="search-select-option" data-id="${b.idBeneficiario}" data-nombre="${b.nombreResponsable} ${b.apellidosResponsable}" data-dni="${b.dni || ''}">
            <div class="search-opt-name">${b.organizacion || '—'} (${b.nombreResponsable || ''} ${b.apellidosResponsable || ''})</div>
            <div class="search-opt-dni">DNI: ${b.dni || 'Sin DNI'} — ${b.distrito || ''}</div>
        </div>
    `).join('');
    dropdown.querySelectorAll('.search-select-option').forEach(opt => {
        opt.addEventListener('click', function() {
            seleccionarBeneficiario(this.dataset.id, this.dataset.nombre, this.dataset.dni);
        });
    });
    dropdown.classList.add('open');
}

function seleccionarBeneficiario(id, nombre, dni) {
    _beneficiarioSeleccionado = id;
    document.getElementById('selBeneficiario').value = id;
    document.getElementById('buscarBeneficiarioInput').value = nombre + (dni ? ' — ' + dni : '');
    document.getElementById('clearBeneficiarioBtn').style.display = 'flex';
    document.getElementById('beneficiarioDropdown').classList.remove('open');
    const btnVincular = document.getElementById('btnVincularBen');
    btnVincular.disabled = false; btnVincular.style.opacity = '1';
}

function limpiarSeleccionBeneficiario() {
    _beneficiarioSeleccionado = null;
    document.getElementById('selBeneficiario').value = '';
    document.getElementById('buscarBeneficiarioInput').value = '';
    document.getElementById('clearBeneficiarioBtn').style.display = 'none';
    const btnVincular = document.getElementById('btnVincularBen');
    btnVincular.disabled = true; btnVincular.style.opacity = '0.5';
    document.getElementById('beneficiarioDropdown').innerHTML = '';
    document.getElementById('beneficiarioDropdown').classList.remove('open');
    document.getElementById('buscarBeneficiarioInput').focus();
}

function cerrarModalBeneficiario() {
    document.getElementById('modalBeneficiario').style.display = 'none';
    document.getElementById('beneficiarioDropdown').classList.remove('open');
}

// — Búsqueda de beneficiarios —
document.addEventListener('DOMContentLoaded', function() {
    const inputB = document.getElementById('buscarBeneficiarioInput');
    if (inputB) {
        inputB.addEventListener('input', function() {
            _beneficiarioSeleccionado = null;
            document.getElementById('selBeneficiario').value = '';
            const btnV = document.getElementById('btnVincularBen');
            btnV.disabled = true; btnV.style.opacity = '0.5';
            const q = this.value.trim().toLowerCase();
            document.getElementById('clearBeneficiarioBtn').style.display = q ? 'flex' : 'none';
            if (!q) {
                document.getElementById('beneficiarioDropdown').innerHTML = '';
                document.getElementById('beneficiarioDropdown').classList.remove('open');
                return;
            }
            const filtrados = _listaBeneficiarios.filter(b => {
                const texto = (
                    (b.organizacion || '') + ' ' +
                    (b.direccion || '') + ' ' +
                    (b.distrito || '') + ' ' +
                    (b.necesidadPrincipal || '') + ' ' +
                    (b.observaciones || '') + ' ' +
                    (b.nombreResponsable || '') + ' ' +
                    (b.apellidosResponsable || '') + ' ' +
                    (b.dni || '') + ' ' +
                    (b.telefono || '')
                ).toLowerCase();
                return texto.includes(q);
            });
            renderBeneficiarioDropdown(filtrados);
        });
        inputB.addEventListener('focus', function() {
            const q = this.value.trim().toLowerCase();
            if (!_beneficiarioSeleccionado && q && _listaBeneficiarios.length > 0) {
                const filtrados = _listaBeneficiarios.filter(b => {
                    const texto = (
                        (b.organizacion || '') + ' ' +
                        (b.direccion || '') + ' ' +
                        (b.distrito || '') + ' ' +
                        (b.necesidadPrincipal || '') + ' ' +
                        (b.observaciones || '') + ' ' +
                        (b.nombreResponsable || '') + ' ' +
                        (b.apellidosResponsable || '') + ' ' +
                        (b.dni || '') + ' ' +
                        (b.telefono || '')
                    ).toLowerCase();
                    return texto.includes(q);
                });
                if (filtrados.length > 0) renderBeneficiarioDropdown(filtrados);
            }
        });
    }
    const clearBtnB = document.getElementById('clearBeneficiarioBtn');
    if (clearBtnB) clearBtnB.addEventListener('click', limpiarSeleccionBeneficiario);

    document.addEventListener('click', function(e) {
        const cB = document.getElementById('beneficiarioSearchContainer');
        if (cB && !cB.contains(e.target)) {
            document.getElementById('beneficiarioDropdown').classList.remove('open');
        }
    });
});

// — Modal Nuevo Beneficiario —
function abrirModalNuevoBeneficiario() {
    document.getElementById('formNuevoBeneficiario').reset();
    document.getElementById('modalNuevoBeneficiario').style.display = 'flex';
    setTimeout(() => document.getElementById('nbDni').focus(), 200);
}

// Buscar DNI en API y llenar nombres/apellidos
async function buscarDniBeneficiario() {
    const dniVal = document.getElementById('nbDni').value.trim();
    if (!dniVal || dniVal.length !== 8) {
        mostrarToast('Ingresa un DNI válido de 8 dígitos', 'warning');
        return;
    }
    const btn = document.querySelector('#modalNuevoBeneficiario .btn-search-dni');
    if (btn) { btn.disabled = true; btn.textContent = 'Buscando...'; }

    try {
        const datos = await buscarDNIEnAPI(dniVal);
        if (datos) {
            // Nombres
            if (datos.nombres) {
                document.getElementById('nbNombres').value = datos.nombres;
            }
            // Apellidos
            let apellido = '';
            if ((datos.apellido_paterno || datos.apellidoPaterno) || (datos.apellido_materno || datos.apellidoMaterno)) {
                const a1 = datos.apellido_paterno || datos.apellidoPaterno || '';
                const a2 = datos.apellido_materno || datos.apellidoMaterno || '';
                apellido = (a1 + ' ' + a2).trim();
            } else if (datos.apellidos) {
                apellido = datos.apellidos;
            }
            if (apellido) {
                document.getElementById('nbApellidos').value = apellido;
            }
            mostrarToast('DNI encontrado', 'success');
        }
    } catch (err) {
        console.error('Error buscando DNI:', err);
        mostrarToast('Error al buscar DNI', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔍 Buscar'; }
    }
}

function cerrarModalNuevoBeneficiario() {
    document.getElementById('modalNuevoBeneficiario').style.display = 'none';
}

async function guardarNuevoBeneficiario(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.append('action', 'crear');
    params.append('organizacion', document.getElementById('nbOrganizacion').value.trim());
    params.append('direccion', document.getElementById('nbDireccion').value.trim());
    params.append('distrito', document.getElementById('nbDistrito').value.trim());
    params.append('necesidadPrincipal', document.getElementById('nbNecesidad').value.trim());
    params.append('observaciones', document.getElementById('nbObservaciones').value.trim());
    params.append('nombreResponsable', document.getElementById('nbNombreResponsable').value.trim());
    params.append('apellidosResponsable', document.getElementById('nbApellidosResponsable').value.trim());
    params.append('dni', document.getElementById('nbDni').value.trim());
    params.append('telefono', document.getElementById('nbTelefono').value.trim());

    try {
        const response = await fetch('beneficiarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await response.json();
        if (data.success) {
            mostrarToast('Beneficiario registrado correctamente', 'success');
            cerrarModalNuevoBeneficiario();
            // Recargar lista y auto-seleccionar el nuevo
            const lista = await fetch('beneficiarios?action=listar').then(r => r.json());
            _listaBeneficiarios = (Array.isArray(lista) ? lista : []).filter(b => b.estado === 'ACTIVO');
            if (data.idBeneficiario) {
                const nuevo = _listaBeneficiarios.find(b => b.idBeneficiario == data.idBeneficiario);
                if (nuevo) {
                    seleccionarBeneficiario(nuevo.idBeneficiario, nuevo.nombres + ' ' + nuevo.apellidos, nuevo.dni);
                }
            }
        } else {
            mostrarToast(data.message || 'Error al registrar beneficiario', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error de conexión', 'error');
    }
}

function guardarBeneficiario(e) {
    e.preventDefault();
    const idBen = document.getElementById('selBeneficiario').value;
    if (!idBen) {
        mostrarToast('Seleccione un beneficiario de la lista', 'warning');
        return;
    }
    const params = new URLSearchParams();
    params.append('action', 'agregarBeneficiario');
    params.append('idActividad', ID_ACT);
    params.append('idBeneficiario', idBen);
    params.append('observacion', document.getElementById('obsBeneficiario').value);
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cerrarModalBeneficiario(); cargarBeneficiarios(); mostrarToast(res.message, 'success'); }
            else mostrarToast(res.message, 'error');
        }).catch(() => mostrarToast('Error al vincular beneficiario', 'error'));
}

function eliminarBeneficiario(id) {
    if (!confirm('¿Desvincular a este beneficiario de la actividad?')) return;
    const params = new URLSearchParams();
    params.append('action', 'eliminarBeneficiario');
    params.append('idActividadBeneficiario', id);
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cargarBeneficiarios(); mostrarToast('Beneficiario desvinculado', 'success'); }
            else mostrarToast(res.message, 'error');
        });
}

// ══════════════════════════════════════
//  LOCALIDADES
// ══════════════════════════════════════
function cargarLocalidades() {
    fetch(`${BASE}?action=catalogoLugares`)
        .then(r => r.json())
        .then(lista => {
            const container = document.getElementById('lista-localidades');
            if (!lista.length) {
                container.innerHTML = '<div class="empty-msg">No hay localidades registradas. Registre una nueva.</div>';
                return;
            }
            container.innerHTML = lista.map(l => `
                <div class="localidad-card">
                    <div class="localidad-icon"><i class="fas fa-map-marker-alt"></i></div>
                    <div class="localidad-body">
                        <strong>${l.distrito || ''}</strong>
                        <span>${l.provincia || ''}, ${l.departamento || ''}</span>
                        ${l.direccionReferencia ? '<small>' + l.direccionReferencia + '</small>' : ''}
                    </div>
                </div>
            `).join('');
        }).catch(() => {
            document.getElementById('lista-localidades').innerHTML = '<div class="empty-msg">Error al cargar localidades</div>';
        });
}

function abrirModalLugar() {
    document.getElementById('formLugar').reset();
    document.getElementById('modalLugar').style.display = 'flex';
}
function cerrarModalLugar() { document.getElementById('modalLugar').style.display = 'none'; }

function guardarLugar(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.append('action', 'crearLugar');
    params.append('departamento', document.getElementById('lugarDepartamento').value);
    params.append('provincia', document.getElementById('lugarProvincia').value);
    params.append('distrito', document.getElementById('lugarDistrito').value);
    params.append('direccionReferencia', document.getElementById('lugarDireccion').value);
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
        .then(r => r.json()).then(res => {
            if (res.success) { cerrarModalLugar(); cargarLocalidades(); mostrarToast(res.message, 'success'); }
            else mostrarToast(res.message, 'error');
        }).catch(() => mostrarToast('Error al registrar localidad', 'error'));
}

// ══════════════════════════════════════
//  TOAST  (delegado al sistema global Notify)
// ══════════════════════════════════════
function mostrarToast(msg, tipo) {
    if (typeof Notify !== 'undefined') {
        if (tipo === 'success') Notify.success(msg);
        else if (tipo === 'error') Notify.error(msg);
        else if (tipo === 'warning') Notify.warning(msg);
        else Notify.info(msg);
    }
}
// Alias para dni-api.js que usa mostrarNotificacion
function mostrarNotificacion(msg, tipo) { mostrarToast(msg, tipo); }

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    cargarRecursos();
});

// ── Cerrar modales con Escape ──
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    }
});
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.style.display = 'none';
});
