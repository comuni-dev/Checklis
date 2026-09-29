import { auth, db, provisioningAuth } from './firebase-config.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, signOut, signOut as signOutProvisioning } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStoredVersion } from './version-check.js';

/* ============================================================
   TOASTS (mismo sistema del login)
   ============================================================ */
const ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

let toastContainer = document.getElementById('toastContainer');
if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
}

export function showToast(message, type = 'info', duration = 4200) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
        <div class="toast-content"><p class="toast-message">${message}</p></div>
        <button class="toast-close" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="toast-progress"></div>
    `;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-enter'));

    const progress = toast.querySelector('.toast-progress');
    progress.style.animationDuration = `${duration}ms`;

    const removeToast = () => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 350);
    };

    toast.querySelector('.toast-close').addEventListener('click', removeToast);
    const autoClose = setTimeout(removeToast, duration);
    toast.addEventListener('mouseenter', () => { clearTimeout(autoClose); progress.style.animationPlayState = 'paused'; });
    toast.addEventListener('mouseleave', () => { progress.style.animationPlayState = 'running'; setTimeout(removeToast, 1500); });
}

window.showToast = showToast;

/* ============================================================
   REFERENCIAS DOM
   ============================================================ */
const authLoader    = document.getElementById('authLoader');
const appEl         = document.getElementById('app');
const versionSpan   = document.getElementById('versionDisplay');
const logoutBtn     = document.getElementById('logoutBtn');
const menuToggle    = document.getElementById('menuToggle');
const sidebar       = document.querySelector('.sidebar');
const viewTitle     = document.getElementById('viewTitle');
const viewSubtitle  = document.getElementById('viewSubtitle');
const navItems      = document.querySelectorAll('.nav-item');

const inventoryState = { userId: null, workspaceId: 'default', sedes: [], areas: [], tipos: [], equipos: [], users: [], roles: [], checklists: [], chequeos: [], asistencias: [] };
let selectedReportAreaId = '';
let reportChequeoDate = localDayKey(new Date());
let reportAttendanceDate = localDayKey(new Date());
const INVENTORY_KEY = 'checklis_workspace_';
const CLOUDINARY_CONFIG = { cloudName: 'd1apmqkf', uploadPreset: 'checklis' };
const DEFAULT_ROLES = [
    { id: 'administrador', nombre: 'Administrador', permissions: ['inicio', 'checklists', 'inventario', 'reportes', 'usuarios', 'config'] },
    { id: 'supervisor', nombre: 'Supervisor', permissions: ['inicio', 'checklists', 'inventario', 'reportes', 'config'] },
    { id: 'inspector', nombre: 'Inspector', permissions: ['inicio', 'checklists'] }
];

// Reflejar versión
versionSpan.textContent = getStoredVersion();

/* ============================================================
   FORMATEO DE FECHAS
   ============================================================ */
function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/* ============================================================
   RENDER DE DATOS DEL USUARIO
   ============================================================ */
function renderUser(user) {
    const email   = user.email || '—';
    const uid     = user.uid || '—';
    const name    = email.split('@')[0];
    const initial = (email[0] || '?').toUpperCase();

    // Header
    document.getElementById('userEmail').textContent  = email;
    document.getElementById('userAvatar').textContent = initial;
    document.getElementById('userRole').textContent   = 'Usuario';
    document.getElementById('sidebarUserName').textContent = email;

    // Bienvenida
    document.getElementById('welcomeName').textContent = name;

    // Info cuenta
    document.getElementById('infoEmail').textContent     = email;
    document.getElementById('infoUid').textContent       = uid.slice(0, 12) + '…';
    document.getElementById('infoUid').title             = uid;
    document.getElementById('infoCreated').textContent   = formatDate(user.metadata?.creationTime);
    document.getElementById('infoLastLogin').textContent = formatDate(user.metadata?.lastSignInTime);

    const verified = document.getElementById('infoVerified');
    if (user.emailVerified) {
        verified.textContent = '✓ Sí';
        verified.className = 'info-value badge-ok';
    } else {
        verified.textContent = '⚠ Pendiente';
        verified.className = 'info-value badge-warn';
    }

    const provider = user.providerData?.[0]?.providerId || 'password';
    const providerNames = {
        'password':  'Correo / Contraseña',
        'google.com': 'Google',
        'github.com': 'GitHub'
    };
    document.getElementById('infoProvider').textContent = providerNames[provider] || provider;

    // Aquí luego: leer Firestore y actualizar userRole, roleBadge y statUsuarios
    document.getElementById('roleBadge').textContent = 'user';
    document.getElementById('statUsuarios').textContent = '—';
}

/* ============================================================
   NAVEGACIÓN ENTRE VISTAS
   ============================================================ */
const VIEW_META = {
    inicio:     { title: 'Inicio',        subtitle: 'Resumen general de tu cuenta' },
    checklists: { title: 'Checklists',    subtitle: 'Control operativo y tareas del día' },
    inventario: { title: 'Inventario',    subtitle: 'Sedes, áreas, tipos y equipos' },
    reportes:   { title: 'Reportes',      subtitle: 'Chequeos y asistencia por sede' },
    usuarios:   { title: 'Usuarios',      subtitle: 'Gestión de usuarios y roles' },
    config:     { title: 'Configuración', subtitle: 'Preferencias de la aplicación' }
};

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function normalizeRoles(roles) {
    return roles.map(role => {
        const normalizedRole = role.id === 'tecnico' ? { ...role, id: 'inspector', nombre: 'Inspector' } : role;
        const builtInRole = DEFAULT_ROLES.find(item => item.id === normalizedRole.id);
        return builtInRole ? { ...normalizedRole, nombre: builtInRole.nombre, permissions: [...builtInRole.permissions] } : normalizedRole;
    });
}
function inventorySnapshot() { return { sedes: inventoryState.sedes, areas: inventoryState.areas, tipos: inventoryState.tipos, equipos: inventoryState.equipos, users: inventoryState.users, roles: inventoryState.roles, checklists: inventoryState.checklists, chequeos: inventoryState.chequeos, asistencias: inventoryState.asistencias }; }
async function saveInventory() {
    const snapshot = inventorySnapshot(); localStorage.setItem(INVENTORY_KEY + inventoryState.workspaceId, JSON.stringify(snapshot));
    try { await setDoc(doc(db, 'workspaces', inventoryState.workspaceId), snapshot); } catch (error) { console.warn('Inventario guardado localmente; Firestore no disponible:', error); }
}
async function loadInventory(userId, authUser = {}) {
    inventoryState.userId = userId;
    inventoryState.sedes = []; inventoryState.areas = []; inventoryState.tipos = []; inventoryState.equipos = []; inventoryState.users = []; inventoryState.roles = [];
    try { Object.assign(inventoryState, JSON.parse(localStorage.getItem(INVENTORY_KEY + inventoryState.workspaceId) || localStorage.getItem('checklis_inventory_' + userId) || '{}')); } catch { showToast('No se pudieron leer los datos guardados.', 'error'); }
    ['sedes', 'areas', 'tipos', 'equipos', 'users', 'roles', 'checklists', 'chequeos', 'asistencias'].forEach(key => { if (!Array.isArray(inventoryState[key])) inventoryState[key] = []; });
    if (!inventoryState.roles.length) inventoryState.roles = DEFAULT_ROLES.map(role => ({ ...role, permissions: [...role.permissions] }));
    inventoryState.tipos.forEach(item => { if (!Array.isArray(item.campos)) item.campos = []; });
    inventoryState.roles = normalizeRoles(inventoryState.roles);
    inventoryState.users = inventoryState.users.map(user => user.roleId === 'tecnico' ? { ...user, roleId: 'inspector' } : user);
    if (!inventoryState.users.some(item => item.uid === userId)) inventoryState.users.push({ id: makeId(), uid: userId, nombre: authUser.email || userId, email: authUser.email || '', roleId: inventoryState.users.length ? 'inspector' : 'administrador', estado: inventoryState.users.length ? 'Inactivo' : 'Activo', sedeIds: [] });
    try { const remote = await getDoc(doc(db, 'workspaces', inventoryState.workspaceId)); if (remote.exists()) { Object.assign(inventoryState, remote.data()); localStorage.setItem(INVENTORY_KEY + inventoryState.workspaceId, JSON.stringify(inventorySnapshot())); } } catch (error) { console.warn('Usando inventario local:', error); }
    inventoryState.roles = normalizeRoles(inventoryState.roles);
    inventoryState.users = inventoryState.users.map(user => user.roleId === 'tecnico' ? { ...user, roleId: 'inspector' } : user);
    const current = inventoryState.users.find(item => item.uid === userId); if (current) { current.email = current.email || authUser.email || ''; current.nombre = current.nombre === userId ? (authUser.email || userId) : current.nombre; }
    if (!current || current.estado !== 'Activo') showToast('Tu cuenta aún no tiene acceso activo en esta organización.', 'warning');
    applyPermissions(); renderInventory();
}
function optionList(items, selected = '') { return items.map(item => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.nombre)}</option>`).join(''); }
function inventoryFilter(key) { return (document.querySelector(`.inventory-filter[data-target="${key}"]`)?.value || '').trim().toLowerCase(); }
function matchesInventory(item, key) { const query = inventoryFilter(key); if (!query) return true; const related = key === 'areas' ? inventoryState.sedes.find(site => site.id === item.sedeId)?.nombre : key === 'equipos' ? `${inventoryState.sedes.find(site => site.id === item.sedeId)?.nombre || ''} ${inventoryState.areas.find(area => area.id === item.areaId)?.nombre || ''} ${inventoryState.tipos.find(type => type.id === item.tipoId)?.nombre || ''}` : ''; return `${Object.values(item).join(' ')} ${related}`.toLowerCase().includes(query); }
function entityActions(entity, id) { return `<div class="entity-actions"><button type="button" class="icon-action detail-entity" data-entity="${entity}" data-id="${id}">Ver</button><button type="button" class="icon-action edit-entity" data-entity="${entity}" data-id="${id}">Editar</button><button type="button" class="icon-action danger delete-entity" data-entity="${entity}" data-id="${id}">Eliminar</button></div>`; }
function emptyEntity(message) { return `<div class="entity-empty">${message}</div>`; }
function renderInventory() {
    const sedeName = id => inventoryState.sedes.find(item => item.id === id)?.nombre || 'Sin sede';
    const areaName = id => inventoryState.areas.find(item => item.id === id)?.nombre || 'Sin área';
    const tipoName = id => inventoryState.tipos.find(item => item.id === id)?.nombre || 'Sin tipo';
    const sedes = inventoryState.sedes.filter(item => matchesInventory(item, 'sedes')); const areas = inventoryState.areas.filter(item => matchesInventory(item, 'areas')); const tipos = inventoryState.tipos.filter(item => matchesInventory(item, 'tipos')); const equipos = inventoryState.equipos.filter(item => matchesInventory(item, 'equipos'));
    document.getElementById('list-sedes').innerHTML = sedes.length ? sedes.map(item => `<article class="entity-row"><div><strong>${escapeHtml(item.nombre)}</strong><span>Código: ${escapeHtml(item.codigo)} · ${escapeHtml(item.direccion)}</span></div>${entityActions('sede', item.id)}</article>`).join('') : emptyEntity(inventoryState.sedes.length ? 'No hay sedes con ese filtro.' : 'Aún no hay sedes.');
    document.getElementById('list-areas').innerHTML = areas.length ? areas.map(item => `<article class="entity-row"><div><strong>${escapeHtml(item.nombre)}</strong><span>${escapeHtml(sedeName(item.sedeId))} · ${escapeHtml(item.descripcion || 'Sin descripción')} · ${item.chequeable === false ? 'No chequeable' : 'Chequeable'}</span></div>${entityActions('area', item.id)}</article>`).join('') : emptyEntity(inventoryState.areas.length ? 'No hay áreas con ese filtro.' : 'Aún no hay áreas.');
    document.getElementById('list-tipos').innerHTML = tipos.length ? tipos.map(item => `<article class="entity-row"><div><strong>${escapeHtml(item.nombre)}</strong><span>${item.campos.length} campo(s): ${item.campos.map(field => escapeHtml(field.nombre)).join(', ') || 'solo campos generales'}</span></div>${entityActions('tipo', item.id)}</article>`).join('') : emptyEntity(inventoryState.tipos.length ? 'No hay tipos con ese filtro.' : 'Aún no hay tipos de equipo.');
    document.getElementById('list-equipos').innerHTML = equipos.length ? equipos.map(item => `<article class="entity-row"><div><strong>${escapeHtml(item.nombre)}</strong><span>${escapeHtml(tipoName(item.tipoId))} · ${escapeHtml(sedeName(item.sedeId))} / ${escapeHtml(areaName(item.areaId))} · ${escapeHtml(item.estado)}${item.chequeable ? ' · Chequeable' : ''}</span></div>${entityActions('equipo', item.id)}</article>`).join('') : emptyEntity(inventoryState.equipos.length ? 'No hay equipos con ese filtro.' : 'Aún no hay equipos.');
    renderUsers(); renderAssignments(); renderReports(); renderChecklistModule(); renderDashboard();
}

function getLatestChequeoForArea(areaId, sedeId) {
    return [...inventoryState.chequeos]
        .filter(item => item.areaId === areaId && item.sedeId === sedeId)
        .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))[0] || null;
}

function localDayKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayKey(value) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getAreaChequeoAction(areaId, sedeId) {
    const today = localDayKey(new Date());
    const latest = [...inventoryState.chequeos]
        .filter(item => item.areaId === areaId && item.sedeId === sedeId && item.realizadoPor === inventoryState.userId && localDayKey(item.fechaHora) === today)
        .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))[0] || null;
    if (!latest) {
        return { type: 'entrada', allowed: true, label: 'Guardar entrada', hint: 'Primera revisión del día.' };
    }

    const elapsedHours = (Date.now() - new Date(latest.fechaHora).getTime()) / (1000 * 60 * 60);
    if (latest.tipo === 'salida') {
        return { type: 'salida', allowed: false, label: 'Día completado', hint: 'La entrada y la salida de hoy ya quedaron registradas.' };
    }

    if (elapsedHours >= 1) {
        return { type: 'salida', allowed: true, label: 'Guardar salida', hint: `Entrada registrada: ${formatDate(latest.fechaHora)}. Ya puede registrar la salida.` };
    }

    const salidaDisponible = new Date(new Date(latest.fechaHora).getTime() + 60 * 60 * 1000);
    return { type: 'salida', allowed: false, label: 'Esperar salida', hint: `Entrada registrada: ${formatDate(latest.fechaHora)}. Podrá registrar la salida desde ${formatDate(salidaDisponible.toISOString())}.` };
}

function readImageAsDataUrl(file) {
    if (!file) return Promise.resolve('');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        reader.readAsDataURL(file);
    });
}

function renderChecklistModule() {
    const board = document.getElementById('checklistBoard');
    const sedeSelect = document.getElementById('checklistSede');
    const metaBox = document.getElementById('checklistMetaBox');
    if (!board || !sedeSelect || !metaBox) return;

    const selectedSedeId = sedeSelect.value || '';
    const sedes = inventoryState.sedes || [];
    sedeSelect.innerHTML = '<option value="">Selecciona una sede</option>' + sedes.map(site => `<option value="${site.id}" ${site.id === selectedSedeId ? 'selected' : ''}>${escapeHtml(site.nombre)}</option>`).join('');
    if (!selectedSedeId) {
        metaBox.textContent = 'Sin sede seleccionada';
        board.innerHTML = sedes.length
            ? '<div class="entity-empty checklist-empty">Selecciona una sede para revisar los equipos chequeables.</div>'
            : '<div class="entity-empty checklist-empty">Aún no hay sedes creadas. <button type="button" class="btn-primary checklist-go-inventory">Crear primera sede</button></div>';
        return;
    }

    const selectedSede = sedes.find(site => site.id === selectedSedeId);
    const areas = (inventoryState.areas || []).filter(area => area.sedeId === selectedSedeId && area.chequeable !== false);
    const summaryLabel = selectedSede ? `${selectedSede.nombre} · ${areas.length} área(s)` : 'Sede seleccionada';
    metaBox.textContent = summaryLabel;

    if (!areas.length) {
        board.innerHTML = '<div class="entity-empty checklist-empty">No hay áreas chequeables registradas para esta sede.</div>';
        return;
    }

    board.innerHTML = areas.map(area => {
        const action = getAreaChequeoAction(area.id, selectedSedeId);
        const last = getLatestChequeoForArea(area.id, selectedSedeId);
        const equipmentCount = (inventoryState.equipos || []).filter(equipo => equipo.sedeId === selectedSedeId && equipo.areaId === area.id && equipo.chequeable !== false).length;

        return `
            <button class="checklist-area-card" type="button" data-checklist-area="${area.id}" data-sede-id="${selectedSedeId}">
                <span class="checklist-area-icon">⌂</span>
                <span class="checklist-area-content">
                    <strong>${escapeHtml(area.nombre)}</strong>
                    <span>${equipmentCount} equipo(s) chequeable(s)</span>
                    <small>${last ? `Último chequeo: ${formatDate(last.fechaHora)}` : 'Sin chequeo registrado'}</small>
                </span>
                <span class="checklist-area-action">${escapeHtml(action.label.replace('Guardar ', ''))} <span aria-hidden="true">›</span></span>
            </button>
        `;
    }).join('');
}

function renderChequeoRecords(records) {
    return groupChequeos(records).map(group => {
        const record = group.latest;
        const siteName = record.sedeNombre || inventoryState.sedes.find(site => site.id === record.sedeId)?.nombre || 'Sede eliminada';
        const areaName = record.areaNombre || inventoryState.areas.find(area => area.id === record.areaId)?.nombre || 'Área eliminada';
        const author = inventoryState.users.find(user => user.uid === record.realizadoPor);
        const userName = record.realizadoPorNombre || author?.nombre || author?.email || record.realizadoPor || 'Usuario';
        const signature = record.firmaRealizador || author?.signatureUrl || '';
        return `
            <article class="checklist-history-item">
                <div class="checklist-history-heading">
                    <strong>${escapeHtml(siteName)} · ${escapeHtml(areaName)}</strong>
                    <time datetime="${escapeHtml(record.fechaHora)}">${escapeHtml(formatDate(record.fechaHora))}</time>
                </div>
                <div class="checklist-history-user"><span>Chequeo de ${escapeHtml(userName)}</span>${signature ? `<a class="checklist-history-signature-link" href="${escapeHtml(signature)}" target="_blank" rel="noopener noreferrer"><img class="checklist-history-signature" src="${escapeHtml(signature)}" alt="Firma de ${escapeHtml(userName)}"></a>` : '<span class="checklist-signature-missing">Sin firma registrada</span>'}</div>
                <div class="checklist-history-phases">${group.entrada ? renderChequeoPhase(group.salida ? 'Entrada' : 'Solo entrada', group.entrada) : group.salida ? renderChequeoPhase('Entrada', null) : ''}${group.salida ? renderChequeoPhase('Salida', group.salida) : ''}</div>
            </article>
        `;
    }).join('');
}

function groupChequeos(records) {
    const groups = new Map();
    records.forEach(record => {
        const day = localDayKey(record.fechaHora);
        const key = [record.sedeId, record.areaId, record.realizadoPor, day].join('|');
        if (!groups.has(key)) groups.set(key, { entrada: null, salida: null, latest: record });
        const group = groups.get(key);
        const phase = record.tipo === 'salida' ? 'salida' : 'entrada';
        if (!group[phase] || new Date(record.fechaHora) > new Date(group[phase].fechaHora)) group[phase] = record;
        if (new Date(record.fechaHora) > new Date(group.latest.fechaHora)) group.latest = record;
    });
    return [...groups.values()].sort((a, b) => new Date(b.latest.fechaHora) - new Date(a.latest.fechaHora));
}

function renderDashboard() {
    const checksTodayElement = document.getElementById('dashboardChecksToday');
    const pendingAreasElement = document.getElementById('dashboardAreasPending');
    const siteSummary = document.getElementById('dashboardSiteSummary');
    const recentChecks = document.getElementById('dashboardRecentChecks');
    if (!checksTodayElement || !pendingAreasElement || !siteSummary || !recentChecks) return;

    const today = localDayKey(new Date());
    const currentUser = inventoryState.users.find(user => user.uid === inventoryState.userId);
    const assignedSiteIds = currentUser?.roleId === 'administrador' ? null : new Set(currentUser?.sedeIds || []);
    const visibleSites = inventoryState.sedes.filter(site => !assignedSiteIds || assignedSiteIds.has(site.id));
    const visibleSiteIds = new Set(visibleSites.map(site => site.id));
    const visibleAreas = inventoryState.areas.filter(area => area.chequeable !== false && visibleSiteIds.has(area.sedeId));
    const todayRecords = inventoryState.chequeos.filter(record => localDayKey(record.fechaHora) === today && visibleSiteIds.has(record.sedeId));
    const checkedAreaIds = new Set(todayRecords.map(record => record.areaId));

    checksTodayElement.textContent = checkedAreaIds.size;
    pendingAreasElement.textContent = visibleAreas.filter(area => !checkedAreaIds.has(area.id)).length;
    document.getElementById('statUsuarios').textContent = inventoryState.users.filter(user => user.estado === 'Activo').length;
    document.getElementById('dashboardCoverageDate').textContent = `Cobertura · ${formatDayKey(today)}`;

    siteSummary.innerHTML = visibleSites.length ? visibleSites.map(site => {
        const areas = visibleAreas.filter(area => area.sedeId === site.id);
        const checked = areas.filter(area => checkedAreaIds.has(area.id)).length;
        const percentage = areas.length ? Math.round((checked / areas.length) * 100) : 0;
        return `<article class="dashboard-site-row"><div class="dashboard-site-heading"><strong>${escapeHtml(site.nombre)}</strong><span>${checked} / ${areas.length} áreas</span></div>${areas.length ? `<div class="dashboard-progress" role="progressbar" aria-label="Cobertura de ${escapeHtml(site.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><span style="width:${percentage}%"></span></div>` : '<span class="dashboard-site-empty">Sin áreas chequeables</span>'}</article>`;
    }).join('') : emptyEntity('No hay sedes asignadas a tu usuario.');

    const recent = inventoryState.chequeos.filter(record => visibleSiteIds.has(record.sedeId)).sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora)).slice(0, 5);
    recentChecks.innerHTML = recent.length ? recent.map(record => {
        const siteName = record.sedeNombre || inventoryState.sedes.find(site => site.id === record.sedeId)?.nombre || 'Sede eliminada';
        const areaName = record.areaNombre || inventoryState.areas.find(area => area.id === record.areaId)?.nombre || 'Área eliminada';
        const author = record.realizadoPorNombre || inventoryState.users.find(user => user.uid === record.realizadoPor)?.nombre || record.realizadoPor || 'Usuario';
        const phase = record.tipo === 'salida' ? 'Salida' : 'Entrada';
        return `<article class="dashboard-recent-item"><span class="dashboard-recent-mark ${record.tipo === 'salida' ? 'is-exit' : ''}" aria-hidden="true"></span><div class="dashboard-recent-main"><strong>${escapeHtml(areaName)} · ${escapeHtml(siteName)}</strong><span>${phase} · ${escapeHtml(author)}</span></div><time datetime="${escapeHtml(record.fechaHora)}">${escapeHtml(formatDate(record.fechaHora))}</time></article>`;
    }).join('') : emptyEntity('Aún no hay chequeos registrados.');
}

function renderChequeoPhase(label, record) {
    if (!record) return `<section class="checklist-history-phase pending"><strong>${label}</strong><span>Pendiente</span></section>`;
    const equipmentRows = (record.equipos || []).map(equipment => `
        <li>
            <div class="checklist-history-equipment-info"><strong>${escapeHtml(equipment.nombre)}</strong><span class="equipment-state">${escapeHtml(equipment.estado || 'Sin estado')}</span>${equipment.observacion ? `<p>${escapeHtml(equipment.observacion)}</p>` : ''}</div>
            ${equipment.foto ? `<a class="checklist-history-photo-link" href="${escapeHtml(equipment.foto)}" target="_blank" rel="noopener noreferrer"><img class="checklist-history-photo" src="${escapeHtml(equipment.foto)}" alt="Foto de ${escapeHtml(equipment.nombre)}"></a>` : ''}
        </li>
    `).join('');
    return `
        <section class="checklist-history-phase completed">
            <div class="checklist-history-phase-heading"><strong>${label}</strong><span>Registrada · ${escapeHtml(formatDate(record.fechaHora))}</span></div>
            ${record.observaciones ? `<p>${escapeHtml(record.observaciones)}</p>` : ''}
            ${equipmentRows ? `<ul>${equipmentRows}</ul>` : ''}
        </section>
    `;
}

function showAreaReportModal(area) {
    const siteName = inventoryState.sedes.find(site => site.id === area.sedeId)?.nombre || 'Sede eliminada';
    const records = inventoryState.chequeos
        .filter(record => record.areaId === area.id && localDayKey(record.fechaHora) === reportChequeoDate)
        .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    modal.querySelector('.modal-card')?.classList.add('checklist-modal-wide');
    document.getElementById('detailModalTitle').textContent = `${siteName} · ${area.nombre} · ${formatDayKey(reportChequeoDate)}`;
    body.innerHTML = `${records.length
        ? `<div class="report-chequeo-list">${renderChequeoRecords(records)}</div>`
        : emptyEntity(`Este consultorio no tiene chequeos registrados el ${escapeHtml(formatDayKey(reportChequeoDate))}.`)}<div class="form-actions"><button class="btn-secondary close-modal" type="button">Cerrar</button></div>`;
    modal.classList.remove('hidden');
    body.querySelector('.close-modal').addEventListener('click', closeDetailModal);
}

function showAreaChequeoModal(sedeId, areaId) {
    const area = inventoryState.areas.find(item => item.id === areaId);
    const selectedSede = inventoryState.sedes.find(item => item.id === sedeId);
    if (!area || !selectedSede) return;

    const equipments = (inventoryState.equipos || []).filter(equipo => equipo.sedeId === sedeId && equipo.areaId === areaId && equipo.chequeable !== false);
    const action = getAreaChequeoAction(areaId, sedeId);
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    modal.querySelector('.modal-card')?.classList.add('checklist-modal-wide');
    document.getElementById('detailModalTitle').textContent = `Chequeo · ${area.nombre}`;

    body.innerHTML = `
        <form class="checklist-form-area checklist-modal-form" data-sede-id="${sedeId}" data-area-id="${areaId}">
            <div class="checklist-modal-intro">
                <strong>${escapeHtml(selectedSede.nombre)} · ${escapeHtml(area.nombre)}</strong>
                <span>${escapeHtml(action.hint)}</span>
            </div>
            <div class="checklist-equipment">
                ${equipments.length ? equipments.map(equipo => `
                    <div class="checklist-equipment-row">
                        <div>
                            <strong>${escapeHtml(equipo.nombre)}</strong>
                            <span class="checklist-meta">${escapeHtml(equipo.codigo || 'Sin código')}</span>
                        </div>
                        <label>
                            <span class="checklist-label">Estado del equipo</span>
                            <select name="equipoEstado_${equipo.id}">
                                <option value="Optimo">Óptimo</option>
                                <option value="Regular">Regular</option>
                                <option value="Defectuoso">Defectuoso</option>
                            </select>
                        </label>
                        <label>
                            <span class="checklist-label">Observación del equipo</span>
                            <textarea name="equipoObs_${equipo.id}" placeholder="Escribe la observación de este equipo..."></textarea>
                        </label>
                        <div class="checklist-photo-control">
                            <span class="checklist-label">Foto (opcional)</span>
                            <div class="checklist-photo-actions">
                                <button class="checklist-photo-button" type="button" data-photo-select="${escapeHtml(equipo.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h-4l-2 2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg><span>Adjuntar foto</span></button>
                                <button class="checklist-photo-remove" type="button" data-photo-remove="${escapeHtml(equipo.id)}" aria-label="Quitar foto" title="Quitar foto" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>
                                <span class="checklist-photo-filename">Sin foto seleccionada</span>
                            </div>
                            <input class="checklist-photo-input" id="checklist-photo-${escapeHtml(equipo.id)}" name="equipoImage_${equipo.id}" type="file" accept="image/*" tabindex="-1" aria-label="Adjuntar foto de ${escapeHtml(equipo.nombre)}">
                            <img class="checklist-photo-preview" alt="Vista previa de ${escapeHtml(equipo.nombre)}" hidden>
                        </div>
                    </div>
                `).join('') : '<div class="entity-empty">No hay equipos chequeables en esta área.</div>'}
            </div>
            <label>
                <span class="checklist-label">Observación general del área</span>
                <textarea name="observaciones" placeholder="Agrega una observación general..."></textarea>
            </label>
            <div class="form-actions checklist-modal-actions">
                <button type="button" class="btn-secondary close-modal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg><span>Cancelar</span></button>
                <button type="submit" class="btn-primary" ${action.allowed ? '' : 'disabled'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>${escapeHtml(action.label)}</span></button>
            </div>
        </form>
    `;

    modal.classList.remove('hidden');
    body.querySelector('.close-modal').addEventListener('click', closeDetailModal);
    const form = body.querySelector('form');
    form.addEventListener('submit', handleChecklistSubmit);
    form.querySelectorAll('.checklist-photo-input').forEach(input => input.addEventListener('change', () => updateChecklistPhotoPreview(input)));
    form.querySelectorAll('[data-photo-select]').forEach(button => button.addEventListener('click', () => document.getElementById(`checklist-photo-${button.dataset.photoSelect}`)?.click()));
    form.querySelectorAll('[data-photo-remove]').forEach(button => button.addEventListener('click', () => clearChecklistPhotoPreview(document.getElementById(`checklist-photo-${button.dataset.photoRemove}`))));
}

function updateChecklistPhotoPreview(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Selecciona un archivo de imagen.', 'warning');
        clearChecklistPhotoPreview(input);
        return;
    }
    clearChecklistPhotoPreview(input, false);
    const previewUrl = URL.createObjectURL(file);
    input.dataset.previewUrl = previewUrl;
    const control = input.closest('.checklist-photo-control');
    const preview = control.querySelector('.checklist-photo-preview');
    preview.src = previewUrl;
    preview.hidden = false;
    control.querySelector('.checklist-photo-filename').textContent = file.name;
    control.querySelector('[data-photo-remove]').hidden = false;
}

function clearChecklistPhotoPreview(input, clearFile = true) {
    if (!input) return;
    if (input.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
    delete input.dataset.previewUrl;
    if (clearFile) input.value = '';
    const control = input.closest('.checklist-photo-control');
    if (!control) return;
    const preview = control.querySelector('.checklist-photo-preview');
    preview.removeAttribute('src');
    preview.hidden = true;
    control.querySelector('.checklist-photo-filename').textContent = 'Sin foto seleccionada';
    control.querySelector('[data-photo-remove]').hidden = true;
}

async function handleChecklistSubmit(event) {
    const form = event.target.closest('.checklist-form-area');
    if (!form) return;
    event.preventDefault();

    const sedeId = form.dataset.sedeId;
    const areaId = form.dataset.areaId;
    const action = getAreaChequeoAction(areaId, sedeId);
    if (!action.allowed) {
        showToast(action.hint, 'warning');
        return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;

    try {
        const area = inventoryState.areas.find(item => item.id === areaId);
        const selectedSede = inventoryState.sedes.find(item => item.id === sedeId);
        const author = inventoryState.users.find(item => item.uid === inventoryState.userId);
        const equipments = (inventoryState.equipos || []).filter(equipo => equipo.sedeId === sedeId && equipo.areaId === areaId && equipo.chequeable !== false);

        const chequeoEquipos = await Promise.all(equipments.map(async (equipo) => {
            const estado = form.elements[`equipoEstado_${equipo.id}`]?.value || 'Operativo';
            const observacion = form.elements[`equipoObs_${equipo.id}`]?.value?.trim() || '';
            const imageFile = form.querySelector(`[name="equipoImage_${equipo.id}"]`)?.files?.[0];
            const foto = imageFile ? await readImageAsDataUrl(imageFile) : '';

            return { equipoId: equipo.id, nombre: equipo.nombre, estado, observacion, foto };
        }));

        const record = {
            id: makeId(),
            sedeId,
            sedeNombre: selectedSede?.nombre || 'Sede',
            areaId,
            tipo: action.type,
            fechaHora: new Date().toISOString(),
            observaciones: form.elements.observaciones?.value?.trim() || '',
            realizadoPor: inventoryState.userId || 'local',
            realizadoPorNombre: author?.nombre || author?.email || 'Usuario',
            firmaRealizador: author?.signatureUrl || '',
            areaNombre: area?.nombre || 'Área',
            equipos: chequeoEquipos
        };
        inventoryState.chequeos.push(record);

        try {
            await saveInventory();
        } catch (error) {
            inventoryState.chequeos = inventoryState.chequeos.filter(item => item.id !== record.id);
            throw error;
        }

        renderChecklistModule();
        renderReports();
        renderDashboard();
        closeDetailModal();
        showToast(`${action.type === 'entrada' ? 'Entrada' : 'Salida'} registrada en ${area?.nombre || 'el área'}.`, 'success');
    } catch (error) {
        console.error('No se pudo guardar el chequeo:', error);
        showToast('No se pudo guardar el chequeo. Intenta de nuevo.', 'error');
        submitButton.disabled = false;
    }
}

function handleChecklistAction(event) {
    const areaButton = event.target.closest('[data-checklist-area]');
    if (!areaButton) return;
    showAreaChequeoModal(areaButton.dataset.sedeId, areaButton.dataset.checklistArea);
}

function handleChecklistToggle() {
    return null;
}

function showInventoryForm(entity, id = '') {
    const collection = `${entity}s`; const current = id ? inventoryState[collection].find(item => item.id === id) : null;
    const form = document.getElementById(`form-${entity}`); const value = key => escapeHtml(current?.[key] || ''); let fields = '';
    const modal = document.getElementById('detailModal'); const modalBody = document.getElementById('detailModalBody'); const parent = form.parentElement;
    document.getElementById('detailModalTitle').textContent = `${id ? 'Editar' : 'Crear'} ${entity === 'sede' ? 'sede' : entity === 'area' ? 'área' : entity === 'tipo' ? 'tipo de equipo' : 'equipo'}`;
    form.dataset.returnParentId = parent.id; modalBody.innerHTML = ''; modalBody.appendChild(form); modal.classList.remove('hidden');
    if (entity === 'sede') fields = `<label>Nombre<input name="nombre" required value="${value('nombre')}" placeholder="Sede principal"></label><label>Código<input name="codigo" required value="${value('codigo')}" placeholder="SEDE-001"></label><label class="full">Dirección<input name="direccion" required value="${value('direccion')}" placeholder="Dirección completa"></label>`;
    if (entity === 'area') fields = `<label>Nombre<input name="nombre" required value="${value('nombre')}" placeholder="Mantenimiento"></label><label>Sede<select name="sedeId" required><option value="">Selecciona una sede</option>${optionList(inventoryState.sedes, current?.sedeId)}</select></label><label class="full">Descripción<input name="descripcion" value="${value('descripcion')}" placeholder="Descripción opcional"></label><label class="check-control full"><input name="chequeable" type="checkbox" ${current?.chequeable !== false ? 'checked' : ''}> <span>Área chequeable</span></label>`;
    if (entity === 'tipo') fields = `<label>Nombre<input name="nombre" required value="${value('nombre')}" placeholder="Báscula"></label><label class="full">Descripción<input name="descripcion" value="${value('descripcion')}" placeholder="Descripción opcional"></label><div class="dynamic-fields full"><div class="dynamic-fields-head"><span>Campos particulares</span><button type="button" class="add-field">+ Añadir campo</button></div><div class="field-definitions">${(current?.campos || []).map(field => fieldDefinition(field)).join('')}</div></div>`;
    if (entity === 'equipo') fields = `<label>Nombre<input name="nombre" required value="${value('nombre')}" placeholder="Báscula recepción"></label><label>Código / inventario<input name="codigo" required value="${value('codigo')}" placeholder="EQ-001"></label><label>Área<select name="areaId" required><option value="">Selecciona un área</option>${optionList(inventoryState.areas, current?.areaId)}</select></label><label>Sede<div class="derived-value" id="derived-sede">${escapeHtml(inventoryState.sedes.find(item => item.id === current?.sedeId)?.nombre || 'Se asigna automáticamente')}</div></label><label>Tipo de equipo<select name="tipoId" required><option value="">Selecciona un tipo</option>${optionList(inventoryState.tipos, current?.tipoId)}</select></label><label>Estado<select name="estado"><option ${current?.estado === 'Activo' || !current ? 'selected' : ''}>Activo</option><option ${current?.estado === 'En mantenimiento' ? 'selected' : ''}>En mantenimiento</option><option ${current?.estado === 'Fuera de servicio' ? 'selected' : ''}>Fuera de servicio</option></select></label><label>Número de serie<input name="serial" value="${value('serial')}" placeholder="Serie del fabricante"></label><label>Imagen del equipo<input name="imageFile" type="file" accept="image/*"><input name="imageUrl" type="hidden" value="${value('imageUrl')}"></label><label class="check-control full"><input name="chequeable" type="checkbox" ${current?.chequeable !== false ? 'checked' : ''}> <span>Es chequeable</span></label><div id="dynamic-equipment-fields" class="dynamic-fields full"></div>`;
    form.innerHTML = `<form data-entity-form="${entity}" data-id="${id}"><div class="form-grid">${fields}</div><div class="form-actions"><button type="button" class="btn-secondary cancel-form">Cancelar</button><button class="btn-primary" type="submit">${id ? 'Guardar cambios' : 'Crear'}</button></div></form>`; form.classList.remove('hidden');
    if (entity === 'tipo') form.querySelector('.add-field').addEventListener('click', () => form.querySelector('.field-definitions').insertAdjacentHTML('beforeend', fieldDefinition()));
    if (entity === 'equipo') { const legacyCustom = Object.fromEntries(Object.entries(current || {}).filter(([key]) => key.startsWith('custom_')).map(([key, fieldValue]) => [key.slice(7), fieldValue])); const customData = current?.datos && Object.keys(current.datos).length ? current.datos : legacyCustom; const equipmentForm = form.querySelector('form'); equipmentForm.dataset.custom = JSON.stringify(customData); equipmentForm.dataset.originalTipoId = current?.tipoId || ''; equipmentForm.querySelector('[name="areaId"]').addEventListener('change', updateDerivedSite); equipmentForm.querySelector('[name="tipoId"]').addEventListener('change', updateEquipmentFields); updateDerivedSite(); updateEquipmentFields(); }
    form.querySelectorAll('.remove-field').forEach(button => button.addEventListener('click', () => button.parentElement.remove())); form.querySelector('.cancel-form').addEventListener('click', closeDetailModal); form.querySelector('form').addEventListener('submit', event => submitInventoryForm(event, entity, id));
}
function fieldDefinition(field = {}) { return `<div class="field-definition"><input type="hidden" name="fieldId" value="${escapeHtml(field.id || '')}"><input name="fieldName" required value="${escapeHtml(field.nombre || '')}" placeholder="Nombre del campo"><select name="fieldType"><option value="text" ${field.tipo === 'text' ? 'selected' : ''}>Texto</option><option value="number" ${field.tipo === 'number' ? 'selected' : ''}>Número</option><option value="date" ${field.tipo === 'date' ? 'selected' : ''}>Fecha</option></select><button type="button" class="remove-field">×</button></div>`; }
function updateDerivedSite() { const form = document.querySelector('#form-equipo form'); if (!form) return; const area = inventoryState.areas.find(item => item.id === form.querySelector('[name="areaId"]').value); const sede = inventoryState.sedes.find(item => item.id === area?.sedeId); document.getElementById('derived-sede').textContent = sede?.nombre || 'Se asigna automáticamente'; form.dataset.sedeId = sede?.id || ''; }
function updateEquipmentFields() { const form = document.querySelector('#form-equipo form'); if (!form) return; const tipo = inventoryState.tipos.find(item => item.id === form.querySelector('[name="tipoId"]').value); let custom = {}; try { custom = JSON.parse(form.dataset.custom || '{}'); } catch { custom = {}; } const customEntries = Object.entries(custom); document.getElementById('dynamic-equipment-fields').innerHTML = tipo?.campos?.length ? `<h4>Datos de ${escapeHtml(tipo.nombre)}</h4>${tipo.campos.map((field, index) => { const namedValue = custom[field.id] ?? custom[`custom_${field.id}`] ?? custom[field.nombre] ?? customEntries.find(([key]) => key.replace(/^custom_/, '').toLowerCase() === field.nombre.toLowerCase())?.[1]; const legacyValue = form.dataset.originalTipoId === tipo.id ? customEntries[index]?.[1] : undefined; return `<label>${escapeHtml(field.nombre)}<input type="${field.tipo}" name="custom_${field.id}" value="${escapeHtml(namedValue ?? legacyValue ?? '')}" required></label>`; }).join('')}` : ''; }
async function submitInventoryForm(event, entity, id) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries()); const collection = `${entity}s`; const record = { ...(id ? inventoryState[collection].find(item => item.id === id) : {}), id: id || makeId(), ...data };
    if (entity === 'equipo') { record.sedeId = form.dataset.sedeId || ''; record.chequeable = form.elements.chequeable.checked; delete record.imageFile; }
    if (entity === 'area') record.chequeable = form.elements.chequeable.checked;
    Object.keys(record).filter(key => key.startsWith('custom_')).forEach(key => delete record[key]);
    if (entity === 'tipo') record.campos = [...form.querySelectorAll('.field-definition')].map(field => ({ id: field.querySelector('[name="fieldId"]').value || makeId(), nombre: field.querySelector('[name="fieldName"]').value.trim(), tipo: field.querySelector('[name="fieldType"]').value }));
    if (entity === 'equipo') { record.datos = {}; const tipo = inventoryState.tipos.find(item => item.id === record.tipoId); tipo?.campos?.forEach(field => { record.datos[field.id] = data[`custom_${field.id}`] || ''; }); const imageFile = form.querySelector('[name="imageFile"]')?.files?.[0]; if (imageFile) { try { record.imageUrl = await uploadToCloudinary(imageFile); } catch (error) { showToast(error.message, 'warning'); return; } } }
    const index = inventoryState[collection].findIndex(item => item.id === record.id); if (index >= 0) inventoryState[collection][index] = record; else inventoryState[collection].push(record); saveInventory(); renderInventory(); closeDetailModal(); showToast(id ? 'Cambios guardados.' : 'Registro creado.', 'success');
}
function deleteInventory(entity, id) { const dependencies = entity === 'sede' ? inventoryState.areas.some(item => item.sedeId === id) || inventoryState.equipos.some(item => item.sedeId === id) : entity === 'area' ? inventoryState.equipos.some(item => item.areaId === id) : entity === 'tipo' ? inventoryState.equipos.some(item => item.tipoId === id) : false; if (dependencies) return showToast('No se puede eliminar: primero elimina o reasigna los elementos dependientes.', 'warning'); if (!confirm('¿Eliminar este registro?')) return; inventoryState[`${entity}s`] = inventoryState[`${entity}s`].filter(item => item.id !== id); saveInventory(); renderInventory(); showToast('Registro eliminado.', 'success'); }

function roleName(roleId) { return inventoryState.roles.find(role => role.id === roleId)?.nombre || 'Sin rol'; }
function hasPermission(viewKey) { const current = inventoryState.users.find(user => user.uid === inventoryState.userId); if (current?.estado !== 'Activo') return false; const role = inventoryState.roles.find(item => item.id === current?.roleId); return !role || role.permissions.includes(viewKey); }
function applyPermissions() { const current = inventoryState.users.find(user => user.uid === inventoryState.userId); const role = inventoryState.roles.find(item => item.id === current?.roleId); navItems.forEach(item => { item.classList.toggle('hidden', Boolean(role && !role.permissions.includes(item.dataset.view))); }); }
function renderUsers() {
    const list = document.getElementById('usersList'); if (!list) return;
    const search = (document.getElementById('userSearch')?.value || '').toLowerCase(); const role = document.getElementById('userRoleFilter')?.value || ''; const status = document.getElementById('userStatusFilter')?.value || '';
    const roleFilter = document.getElementById('userRoleFilter'); if (roleFilter && roleFilter.options.length === 1) roleFilter.insertAdjacentHTML('beforeend', inventoryState.roles.map(item => `<option value="${item.id}">${escapeHtml(item.nombre)}</option>`).join(''));
    const users = inventoryState.users.filter(user => (!search || `${user.nombre} ${user.email}`.toLowerCase().includes(search)) && (!role || user.roleId === role) && (!status || user.estado === status));
    list.innerHTML = users.length ? users.map(user => `<article class="entity-row"><div><strong>${escapeHtml(user.nombre || user.email || 'Usuario')}</strong><span>${escapeHtml(user.email || 'Perfil local')} · ${escapeHtml(roleName(user.roleId))} · ${escapeHtml(user.estado)}</span></div><div class="entity-actions"><button class="icon-action detail-user" data-id="${user.id}" type="button">Ver</button><button class="icon-action edit-user" data-id="${user.id}" type="button">Editar</button><button class="icon-action ${user.estado === 'Activo' ? 'danger' : ''} toggle-user" data-id="${user.id}" type="button">${user.estado === 'Activo' ? 'Inactivar' : 'Activar'}</button></div></article>`).join('') : emptyEntity('No hay usuarios con estos filtros.');
    const current = inventoryState.users.find(user => user.uid === inventoryState.userId); if (current) { document.getElementById('userRole').textContent = roleName(current.roleId); document.getElementById('sidebarUserRole').textContent = roleName(current.roleId); document.getElementById('roleBadge').textContent = current.roleId; document.getElementById('statUsuarios').textContent = inventoryState.users.length; }
}
function showUserModal(id = '') {
    const current = inventoryState.users.find(user => user.id === id); const modal = document.getElementById('detailModal'); const body = document.getElementById('detailModalBody'); document.getElementById('detailModalTitle').textContent = id ? 'Editar usuario' : 'Nuevo usuario';
    body.innerHTML = `<form id="userForm"><div class="form-grid"><label>Nombre<input name="nombre" required value="${escapeHtml(current?.nombre || '')}" placeholder="Nombre completo"></label><label>Correo<input name="email" type="email" required value="${escapeHtml(current?.email || '')}" placeholder="persona@empresa.com"></label>${id ? '' : '<label>Contraseña inicial<input name="password" type="password" minlength="6" required placeholder="Mínimo 6 caracteres"></label>'}<label>Rol<select name="roleId" required>${inventoryState.roles.map(role => `<option value="${role.id}" ${role.id === (current?.roleId || 'inspector') ? 'selected' : ''}>${escapeHtml(role.nombre)} · ${role.permissions.length} módulos</option>`).join('')}</select></label><label>Estado<select name="estado"><option ${current?.estado !== 'Inactivo' ? 'selected' : ''}>Activo</option><option ${current?.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></label><label class="full">Firma del usuario<input name="signatureFile" type="file" accept="image/*"><input name="signatureUrl" type="hidden" value="${escapeHtml(current?.signatureUrl || '')}"></label></div><div class="form-actions"><button type="button" class="btn-secondary close-modal">Cancelar</button><button class="btn-primary" type="submit">${id ? 'Guardar cambios' : 'Crear usuario'}</button></div></form>`;
    modal.classList.remove('hidden'); body.querySelector('.close-modal').addEventListener('click', closeDetailModal); body.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries()); let uid = current?.uid || ''; const signatureFile = form.querySelector('[name="signatureFile"]')?.files?.[0]; if (signatureFile) { try { data.signatureUrl = await uploadToCloudinary(signatureFile); } catch (error) { showToast(error.message, 'warning'); return; } } if (!id) { try { const credential = await createUserWithEmailAndPassword(provisioningAuth, data.email, data.password); uid = credential.user.uid; await signOutProvisioning(provisioningAuth); } catch (error) { showToast(error.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear la cuenta Firebase.', 'error'); return; } } delete data.password; delete data.signatureFile; const record = { ...(current || {}), id: current?.id || makeId(), uid, ...data, sedeIds: current?.sedeIds || [] }; const index = inventoryState.users.findIndex(user => user.id === record.id); if (index >= 0) inventoryState.users[index] = record; else inventoryState.users.push(record); saveInventory(); renderInventory(); closeDetailModal(); showToast('Usuario guardado.', 'success'); });
}
function renderAssignments() {
    const userSelect = document.getElementById('assignmentUser'); const sites = document.getElementById('assignmentSites'); if (!userSelect || !sites) return;
    const selected = userSelect.value || inventoryState.users[0]?.id || ''; userSelect.innerHTML = inventoryState.users.map(user => `<option value="${user.id}" ${user.id === selected ? 'selected' : ''}>${escapeHtml(user.nombre || user.email)}</option>`).join(''); const user = inventoryState.users.find(item => item.id === userSelect.value) || inventoryState.users[0];
    sites.innerHTML = inventoryState.sedes.length ? inventoryState.sedes.map(site => `<label class="site-check"><input type="checkbox" value="${site.id}" ${user?.sedeIds?.includes(site.id) ? 'checked' : ''}>${escapeHtml(site.nombre)}</label>`).join('') : emptyEntity('Crea una sede para poder asignarla.');
}
function renderReports() {
    const officeList = document.getElementById('reportOfficeList');
    const attendanceList = document.getElementById('reportAttendanceList');
    const chequeoDateInput = document.getElementById('reportChequeoDate');
    const attendanceDateInput = document.getElementById('reportAttendanceDate');
    if (!officeList || !attendanceList || !chequeoDateInput || !attendanceDateInput) return;

    chequeoDateInput.value = reportChequeoDate;
    attendanceDateInput.value = reportAttendanceDate;

    const areas = inventoryState.areas;
    if (!areas.some(area => area.id === selectedReportAreaId)) selectedReportAreaId = areas[0]?.id || '';
    officeList.innerHTML = areas.length ? areas.map(area => {
        const siteName = inventoryState.sedes.find(site => site.id === area.sedeId)?.nombre || 'Sede eliminada';
        const count = groupChequeos(inventoryState.chequeos.filter(record => record.areaId === area.id && localDayKey(record.fechaHora) === reportChequeoDate)).length;
        return `<button class="report-office-button ${area.id === selectedReportAreaId ? 'active' : ''}" type="button" data-report-area="${escapeHtml(area.id)}"><strong>${escapeHtml(area.nombre)}</strong><span>${escapeHtml(siteName)} · ${count} chequeo(s)</span></button>`;
    }).join('') : emptyEntity('Aún no hay consultorios o áreas registradas.');

    const isToday = reportAttendanceDate === localDayKey(new Date());
    document.getElementById('reportAttendanceDateLabel').textContent = isToday
        ? `Registro del día · ${formatDayKey(reportAttendanceDate)}`
        : `Consulta histórica · ${formatDayKey(reportAttendanceDate)}`;
    attendanceList.innerHTML = inventoryState.sedes.length ? inventoryState.sedes.map(site => {
        const inspectors = inventoryState.users.filter(user => user.roleId === 'inspector' && (user.sedeIds || []).includes(site.id));
        const rows = inspectors.map(user => {
            const attendance = inventoryState.asistencias.find(item => item.sedeId === site.id && item.usuarioUid === user.uid && item.fecha === reportAttendanceDate);
            const userChecks = inventoryState.chequeos.filter(record => record.sedeId === site.id && record.realizadoPor === user.uid && localDayKey(record.fechaHora) === reportAttendanceDate);
            const checkGroups = new Map();
            userChecks.forEach(record => {
                const area = inventoryState.areas.find(item => item.id === record.areaId);
                if (!checkGroups.has(record.areaId)) checkGroups.set(record.areaId, { areaName: area?.nombre || record.areaNombre || 'Consultorio', entrada: false, salida: false });
                checkGroups.get(record.areaId)[record.tipo === 'salida' ? 'salida' : 'entrada'] = true;
            });
            const checkSummary = checkGroups.size
                ? `Chequeos: ${[...checkGroups.values()].map(group => `${group.areaName} (${group.entrada ? 'entrada' : ''}${group.entrada && group.salida ? ' y ' : ''}${group.salida ? 'salida' : ''})`).join(' · ')}`
                : 'Sin chequeos en esta fecha';
            const attendanceControl = isToday
                ? `<div class="attendance-control"><span>Registrar asistencia de hoy</span><div class="attendance-actions" role="group" aria-label="Asistencia de ${escapeHtml(user.nombre || user.email || 'Inspector')}"><button class="attendance-mark-button ${attendance?.estado === 'asistio' ? 'active' : ''}" type="button" data-attendance-user="${escapeHtml(user.uid)}" data-attendance-site="${escapeHtml(site.id)}" data-attendance-state="asistio" aria-pressed="${attendance?.estado === 'asistio' ? 'true' : 'false'}">Asistió</button><button class="attendance-mark-button ${attendance?.estado === 'no_asistio' ? 'active' : ''}" type="button" data-attendance-user="${escapeHtml(user.uid)}" data-attendance-site="${escapeHtml(site.id)}" data-attendance-state="no_asistio" aria-pressed="${attendance?.estado === 'no_asistio' ? 'true' : 'false'}">No asistió</button></div></div>`
                : `<div class="attendance-control"><span>Asistencia registrada</span><strong class="attendance-readonly-status ${attendance ? `status-${escapeHtml(attendance.estado)}` : 'status-empty'}">${attendance?.estado === 'asistio' ? 'Asistió' : attendance?.estado === 'no_asistio' ? 'No asistió' : 'Sin registro'}</strong></div>`;
            return `
                <div class="attendance-row">
                    <div class="attendance-inspector"><strong>${escapeHtml(user.nombre || user.email || 'Inspector')}</strong><span>${escapeHtml(user.email || '')}${user.estado === 'Inactivo' ? ' · Inactivo' : ''}</span></div>
                    ${attendanceControl}
                    <span class="attendance-check-status ${userChecks.length ? 'has-checks' : ''}">${escapeHtml(checkSummary)}</span>
                </div>
            `;
        }).join('');
        return `<section class="attendance-site"><h4>${escapeHtml(site.nombre)}</h4>${rows || emptyEntity('No hay inspectores asignados a esta sede.')}</section>`;
    }).join('') : emptyEntity('Aún no hay sedes registradas.');
}

async function saveAttendance(event) {
    const button = event.target.closest('[data-attendance-user][data-attendance-state]');
    if (!button) return;

    const { attendanceUser: usuarioUid, attendanceSite: sedeId, attendanceState: estado } = button.dataset;
    const today = localDayKey(new Date());
    const previousAttendance = inventoryState.asistencias.map(item => ({ ...item }));
    const existing = inventoryState.asistencias.find(item => item.sedeId === sedeId && item.usuarioUid === usuarioUid && item.fecha === today);
    const inspector = inventoryState.users.find(user => user.uid === usuarioUid);
    const currentUser = inventoryState.users.find(user => user.uid === inventoryState.userId);
    const attendanceRecord = {
        id: existing?.id || makeId(),
        sedeId,
        usuarioUid,
        usuarioNombre: inspector?.nombre || inspector?.email || 'Inspector',
        fecha: today,
        estado,
        marcadoPor: inventoryState.userId,
        actualizadoEn: new Date().toISOString(),
        actualizadoPorNombre: currentUser?.nombre || currentUser?.email || 'Usuario'
    };
    if (existing) Object.assign(existing, attendanceRecord);
    else inventoryState.asistencias.push(attendanceRecord);

    try {
        await saveInventory();
    } catch (error) {
        inventoryState.asistencias = previousAttendance;
        console.error('No se pudo guardar la asistencia:', error);
        renderReports();
        showToast('No se pudo guardar la asistencia. Intenta de nuevo.', 'error');
        return;
    }
    renderReports();
    showToast('Asistencia de hoy guardada.', 'success');
}
function downloadFile(filename, content, type) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
function exportExcel() { const rows = [['Equipo', 'Código', 'Tipo', 'Sede', 'Área', 'Estado', 'Número de serie', 'Imagen']]; inventoryState.equipos.forEach(item => { const area = inventoryState.areas.find(areaItem => areaItem.id === item.areaId); rows.push([item.nombre, item.codigo, inventoryState.tipos.find(type => type.id === item.tipoId)?.nombre || '', inventoryState.sedes.find(site => site.id === item.sedeId)?.nombre || '', area?.nombre || '', item.estado, item.serial || '', item.imageUrl || '']); }); downloadFile('reporte-inventario.xls', rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join('\t')).join('\n'), 'application/vnd.ms-excel'); }
function exportPdf() { const rows = inventoryState.equipos.map(item => `<tr><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.codigo)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(inventoryState.sedes.find(site => site.id === item.sedeId)?.nombre || '')}</td></tr>`).join(''); const reportWindow = window.open('', '_blank'); if (!reportWindow) return showToast('Permite ventanas emergentes para exportar el PDF.', 'warning'); reportWindow.document.write(`<html><head><title>Reporte de inventario</title><style>body{font-family:Arial;padding:30px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5d0;padding:8px;text-align:left}th{background:#dce9e2}</style></head><body><h1>Reporte de inventario</h1><p>Generado el ${new Date().toLocaleString('es-CO')}</p><table><thead><tr><th>Equipo</th><th>Código</th><th>Estado</th><th>Sede</th></tr></thead><tbody>${rows}</tbody></table></body></html>`); reportWindow.document.close(); reportWindow.focus(); reportWindow.print(); }
function detailLabel(key) { return { uid: 'UID', nombre: 'Nombre', email: 'Correo', roleId: 'Rol', estado: 'Estado', sedeIds: 'Sedes asignadas', sedeId: 'Sede', areaId: 'Área', tipoId: 'Tipo de equipo', codigo: 'Código', direccion: 'Dirección', serial: 'Número de serie', descripcion: 'Descripción', chequeable: 'Chequeable', imageUrl: 'Imagen', signatureUrl: 'Firma' }[key] || key; }
function detailValue(key, value) { if (key === 'roleId') return roleName(value); if (key === 'sedeIds') return (value || []).map(id => inventoryState.sedes.find(site => site.id === id)?.nombre || id).join(', ') || 'Sin sedes asignadas'; if (key === 'sedeId') return inventoryState.sedes.find(site => site.id === value)?.nombre || 'Sin sede'; if (key === 'areaId') return inventoryState.areas.find(area => area.id === value)?.nombre || 'Sin área'; if (key === 'tipoId') return inventoryState.tipos.find(type => type.id === value)?.nombre || 'Sin tipo'; if (key === 'chequeable') return value ? 'Sí' : 'No'; return value; }
function showDetail(entity, id) { const item = inventoryState[`${entity}s`].find(record => record.id === id); if (!item) return; const modal = document.getElementById('detailModal'); document.getElementById('detailModalTitle').textContent = item.nombre || item.email || 'Detalle'; const visibleEntries = Object.entries(item).filter(([key]) => !['id', 'datos', 'campos', 'imageUrl', 'signatureUrl'].includes(key) && !key.startsWith('custom_')); const storedCustom = item.datos && Object.keys(item.datos).length ? item.datos : Object.fromEntries(Object.entries(item).filter(([key]) => key.startsWith('custom_')).map(([key, value]) => [key.slice(7), value])); const typeFields = inventoryState.tipos.find(type => type.id === item.tipoId)?.campos || []; const customEntries = Object.entries(storedCustom); const customFields = entity === 'equipo' ? typeFields.map((field, index) => [field.nombre, storedCustom[field.id] ?? storedCustom[field.nombre] ?? customEntries.find(([key]) => key.toLowerCase() === field.nombre.toLowerCase())?.[1] ?? (customEntries.length === typeFields.length ? customEntries[index][1] : '')]) : []; document.getElementById('detailModalBody').innerHTML = `<dl class="detail-list">${visibleEntries.map(([key, value]) => `<div><dt>${escapeHtml(detailLabel(key))}</dt><dd>${escapeHtml(detailValue(key, value))}</dd></div>`).join('')}${customFields.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>${item.imageUrl ? `<a class="equipment-image-link" href="${escapeHtml(item.imageUrl)}" target="_blank" rel="noopener noreferrer"><img class="equipment-image" src="${escapeHtml(item.imageUrl)}" alt="Abrir imagen de ${escapeHtml(item.nombre)}"></a>` : ''}${item.signatureUrl ? `<a class="equipment-image-link" href="${escapeHtml(item.signatureUrl)}" target="_blank" rel="noopener noreferrer"><img class="equipment-image" src="${escapeHtml(item.signatureUrl)}" alt="Abrir firma de ${escapeHtml(item.nombre || item.email)}"></a>` : ''}<button class="btn-secondary close-modal" type="button">Cerrar</button>`; modal.classList.remove('hidden'); modal.querySelector('.close-modal').addEventListener('click', closeDetailModal); }
function closeDetailModal() { const modal = document.getElementById('detailModal'); modal.querySelectorAll('.checklist-photo-input').forEach(input => clearChecklistPhotoPreview(input)); const form = modal.querySelector('.entity-form'); if (form?.dataset.returnParentId) { const parent = document.getElementById(form.dataset.returnParentId); if (parent) parent.appendChild(form); form.classList.add('hidden'); delete form.dataset.returnParentId; } modal.querySelector('.modal-card')?.classList.remove('checklist-modal-wide'); modal.classList.add('hidden'); document.getElementById('detailModalBody').innerHTML = ''; }
function uploadToCloudinary(file) { if (!file) return Promise.resolve(''); if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.uploadPreset) return Promise.reject(new Error('Cloudinary aún no está configurado.')); const data = new FormData(); data.append('file', file); data.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset); return fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: data }).then(response => { if (!response.ok) throw new Error('No se pudo subir la imagen.'); return response.json(); }).then(result => result.secure_url); }
document.querySelectorAll('.inventory-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.inventory-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.inventory-panel').forEach(panel => panel.classList.toggle('active', panel.id === `inventory-panel-${tab.dataset.inventoryTab}`)); }));
document.querySelectorAll('.inventory-filter').forEach(input => input.addEventListener('input', renderInventory));
document.querySelectorAll('.inventory-add').forEach(button => button.addEventListener('click', () => showInventoryForm(button.dataset.entity)));
document.getElementById('view-inventario').addEventListener('click', event => { const button = event.target.closest('.detail-entity, .edit-entity, .delete-entity'); if (!button) return; if (button.classList.contains('detail-entity')) showDetail(button.dataset.entity, button.dataset.id); else if (button.classList.contains('edit-entity')) showInventoryForm(button.dataset.entity, button.dataset.id); else deleteInventory(button.dataset.entity, button.dataset.id); });
document.getElementById('newUserBtn').addEventListener('click', () => showUserModal());
const checklistBoard = document.getElementById('checklistBoard');
const checklistSede = document.getElementById('checklistSede');
if (checklistBoard) {
    checklistBoard.addEventListener('click', handleChecklistAction);
    checklistBoard.addEventListener('submit', handleChecklistAction);
    checklistBoard.addEventListener('change', handleChecklistToggle);
}
if (checklistSede) {
    checklistSede.addEventListener('change', renderChecklistModule);
}
if (checklistBoard) {
    checklistBoard.addEventListener('click', event => {
        if (!event.target.closest('.checklist-go-inventory')) return;
        switchView('inventario');
        document.querySelector('.inventory-tab[data-inventory-tab="sedes"]')?.click();
        document.querySelector('.inventory-add[data-entity="sede"]')?.click();
    });
}
document.getElementById('usersList').addEventListener('click', event => { const button = event.target.closest('.detail-user, .edit-user, .toggle-user'); if (!button) return; const user = inventoryState.users.find(item => item.id === button.dataset.id); if (!user) return; if (button.classList.contains('detail-user')) showDetail('user', button.dataset.id); else if (button.classList.contains('edit-user')) showUserModal(button.dataset.id); else { user.estado = user.estado === 'Activo' ? 'Inactivo' : 'Activo'; saveInventory(); renderInventory(); showToast(`Usuario ${user.estado.toLowerCase()}.`, 'success'); } });
document.getElementById('userSearch').addEventListener('input', renderUsers); document.getElementById('userRoleFilter').addEventListener('change', renderUsers); document.getElementById('userStatusFilter').addEventListener('change', renderUsers);
document.getElementById('assignmentUser').addEventListener('change', renderAssignments); document.getElementById('saveAssignmentBtn').addEventListener('click', () => { const user = inventoryState.users.find(item => item.id === document.getElementById('assignmentUser').value); if (!user) return; user.sedeIds = [...document.querySelectorAll('#assignmentSites input:checked')].map(input => input.value); saveInventory(); renderAssignments(); showToast('Asignación guardada.', 'success'); });
const reportView = document.getElementById('view-reportes');
document.addEventListener('click', event => {
    const photoLink = event.target.closest('.checklist-history-photo-link');
    if (!photoLink?.href.startsWith('data:')) return;
    event.preventDefault();
    const imageWindow = window.open('about:blank', '_blank');
    if (!imageWindow) return;
    imageWindow.opener = null;
    const image = imageWindow.document.createElement('img');
    image.src = photoLink.href;
    image.alt = photoLink.querySelector('img')?.alt || 'Foto del chequeo';
    image.style.cssText = 'display:block;max-width:100%;max-height:100vh;margin:auto';
    imageWindow.document.body.style.margin = '0';
    imageWindow.document.body.appendChild(image);
});
if (reportView) {
    document.getElementById('reportChequeoDate').addEventListener('change', event => {
        reportChequeoDate = event.target.value || localDayKey(new Date());
        renderReports();
    });
    document.getElementById('reportAttendanceDate').addEventListener('change', event => {
        reportAttendanceDate = event.target.value || localDayKey(new Date());
        renderReports();
    });
    reportView.addEventListener('click', event => {
        const reportTab = event.target.closest('[data-report-tab]');
        if (reportTab) {
            reportView.querySelectorAll('[data-report-tab]').forEach(tab => {
                const active = tab === reportTab;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', String(active));
            });
            reportView.querySelectorAll('[data-report-panel]').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.reportPanel === reportTab.dataset.reportTab);
            });
            return;
        }

        const officeButton = event.target.closest('[data-report-area]');
        if (!officeButton) return;
        selectedReportAreaId = officeButton.dataset.reportArea;
        renderReports();
        const area = inventoryState.areas.find(item => item.id === selectedReportAreaId);
        if (area) showAreaReportModal(area);
    });
    reportView.addEventListener('click', saveAttendance);
}
document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal); document.getElementById('detailModal').addEventListener('click', event => { if (event.target.id === 'detailModal') closeDetailModal(); });

function switchView(viewKey) {
    if (!hasPermission(viewKey)) { showToast('Tu rol no tiene acceso a este módulo.', 'warning'); return; }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewKey}`);
    if (target) target.classList.add('active');
    if (viewKey === 'reportes') renderReports();

    navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewKey));

    const meta = VIEW_META[viewKey];
    if (meta) {
        viewTitle.textContent    = meta.title;
        viewSubtitle.textContent = meta.subtitle;
    }

    // Cerrar sidebar en móvil
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.view);
    });
});

/* ============================================================
   MENÚ MÓVIL
   ============================================================ */
menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});

/* ============================================================
   LOGOUT
   ============================================================ */
async function handleLogout() {
    const buttons = [logoutBtn, document.getElementById('logoutTopbarBtn')].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; button.style.opacity = '0.6'; });
    try {
        await signOut(auth);
        showToast('Sesión cerrada correctamente', 'success', 1500);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showToast('No se pudo cerrar sesión. Intenta de nuevo.', 'error');
        buttons.forEach(button => { button.disabled = false; button.style.opacity = ''; });
    }
}
logoutBtn.addEventListener('click', handleLogout);
document.getElementById('logoutTopbarBtn').addEventListener('click', handleLogout);

/* ============================================================
   PROTECCIÓN DE RUTA + CARGA DE DATOS
   ============================================================ */
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('✅ Usuario autenticado:', user.email);
        renderUser(user);
        loadInventory(user.uid, user);

        // Mostrar app con transición suave
        authLoader.style.opacity = '0';
        setTimeout(() => {
            authLoader.classList.add('hidden');
            appEl.classList.remove('hidden');
            showToast(`¡Bienvenido de nuevo, ${user.email}!`, 'success', 3500);
        }, 300);
    } else {
        console.log('🔒 Sin sesión. Redirigiendo al login...');
        authLoader.querySelector('p').textContent = 'Redirigiendo al login...';
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
    }
});