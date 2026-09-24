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

const inventoryState = { userId: null, workspaceId: 'default', sedes: [], areas: [], tipos: [], equipos: [], users: [], roles: [] };
const INVENTORY_KEY = 'checklis_workspace_';
const CLOUDINARY_CONFIG = { cloudName: '', uploadPreset: '' };
const DEFAULT_ROLES = [
    { id: 'administrador', nombre: 'Administrador', permissions: ['inicio', 'checklists', 'inventario', 'reportes', 'usuarios', 'config'] },
    { id: 'supervisor', nombre: 'Supervisor', permissions: ['inicio', 'inventario', 'reportes', 'config'] },
    { id: 'inspector', nombre: 'Inspector', permissions: ['inicio', 'inventario'] }
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
    checklists: { title: 'Checklists',    subtitle: 'Módulo próximamente disponible' },
    inventario: { title: 'Inventario',    subtitle: 'Sedes, áreas, tipos y equipos' },
    reportes:   { title: 'Reportes',      subtitle: 'Estadísticas y exportación' },
    usuarios:   { title: 'Usuarios',      subtitle: 'Gestión de usuarios y roles' },
    config:     { title: 'Configuración', subtitle: 'Preferencias de la aplicación' }
};

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function inventorySnapshot() { return { sedes: inventoryState.sedes, areas: inventoryState.areas, tipos: inventoryState.tipos, equipos: inventoryState.equipos, users: inventoryState.users, roles: inventoryState.roles }; }
async function saveInventory() {
    const snapshot = inventorySnapshot(); localStorage.setItem(INVENTORY_KEY + inventoryState.workspaceId, JSON.stringify(snapshot));
    try { await setDoc(doc(db, 'workspaces', inventoryState.workspaceId), snapshot); } catch (error) { console.warn('Inventario guardado localmente; Firestore no disponible:', error); }
}
async function loadInventory(userId, authUser = {}) {
    inventoryState.userId = userId;
    inventoryState.sedes = []; inventoryState.areas = []; inventoryState.tipos = []; inventoryState.equipos = []; inventoryState.users = []; inventoryState.roles = [];
    try { Object.assign(inventoryState, JSON.parse(localStorage.getItem(INVENTORY_KEY + inventoryState.workspaceId) || localStorage.getItem('checklis_inventory_' + userId) || '{}')); } catch { showToast('No se pudieron leer los datos guardados.', 'error'); }
    ['sedes', 'areas', 'tipos', 'equipos', 'users', 'roles'].forEach(key => { if (!Array.isArray(inventoryState[key])) inventoryState[key] = []; });
    if (!inventoryState.roles.length) inventoryState.roles = DEFAULT_ROLES.map(role => ({ ...role, permissions: [...role.permissions] }));
    inventoryState.tipos.forEach(item => { if (!Array.isArray(item.campos)) item.campos = []; });
    inventoryState.roles = inventoryState.roles.map(role => role.id === 'tecnico' ? { ...role, id: 'inspector', nombre: 'Inspector' } : role).map(role => role.id === 'administrador' && !role.permissions.includes('checklists') ? { ...role, permissions: [...role.permissions, 'checklists'] } : role);
    inventoryState.users = inventoryState.users.map(user => user.roleId === 'tecnico' ? { ...user, roleId: 'inspector' } : user);
    if (!inventoryState.users.some(item => item.uid === userId)) inventoryState.users.push({ id: makeId(), uid: userId, nombre: authUser.email || userId, email: authUser.email || '', roleId: inventoryState.users.length ? 'inspector' : 'administrador', estado: inventoryState.users.length ? 'Inactivo' : 'Activo', sedeIds: [] });
    try { const remote = await getDoc(doc(db, 'workspaces', inventoryState.workspaceId)); if (remote.exists()) { Object.assign(inventoryState, remote.data()); localStorage.setItem(INVENTORY_KEY + inventoryState.workspaceId, JSON.stringify(inventorySnapshot())); } } catch (error) { console.warn('Usando inventario local:', error); }
    inventoryState.roles = inventoryState.roles.map(role => role.id === 'tecnico' ? { ...role, id: 'inspector', nombre: 'Inspector' } : role).map(role => role.id === 'administrador' && !role.permissions.includes('checklists') ? { ...role, permissions: [...role.permissions, 'checklists'] } : role);
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
    renderUsers(); renderAssignments(); renderReports();
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
    if (entity === 'equipo') { const legacyCustom = Object.fromEntries(Object.entries(current || {}).filter(([key]) => key.startsWith('custom_')).map(([key, fieldValue]) => [key.slice(7), fieldValue])); const customData = current?.datos && Object.keys(current.datos).length ? current.datos : legacyCustom; form.dataset.custom = JSON.stringify(customData); form.querySelector('[name="areaId"]').addEventListener('change', updateDerivedSite); form.querySelector('[name="tipoId"]').addEventListener('change', updateEquipmentFields); updateDerivedSite(); updateEquipmentFields(); }
    form.querySelectorAll('.remove-field').forEach(button => button.addEventListener('click', () => button.parentElement.remove())); form.querySelector('.cancel-form').addEventListener('click', closeDetailModal); form.querySelector('form').addEventListener('submit', event => submitInventoryForm(event, entity, id));
}
function fieldDefinition(field = {}) { return `<div class="field-definition"><input name="fieldName" required value="${escapeHtml(field.nombre || '')}" placeholder="Nombre del campo"><select name="fieldType"><option value="text" ${field.tipo === 'text' ? 'selected' : ''}>Texto</option><option value="number" ${field.tipo === 'number' ? 'selected' : ''}>Número</option><option value="date" ${field.tipo === 'date' ? 'selected' : ''}>Fecha</option></select><button type="button" class="remove-field">×</button></div>`; }
function updateDerivedSite() { const form = document.querySelector('#form-equipo form'); if (!form) return; const area = inventoryState.areas.find(item => item.id === form.querySelector('[name="areaId"]').value); const sede = inventoryState.sedes.find(item => item.id === area?.sedeId); document.getElementById('derived-sede').textContent = sede?.nombre || 'Se asigna automáticamente'; form.dataset.sedeId = sede?.id || ''; }
function updateEquipmentFields() { const form = document.querySelector('#form-equipo form'); if (!form) return; const tipo = inventoryState.tipos.find(item => item.id === form.querySelector('[name="tipoId"]').value); let custom = {}; try { custom = JSON.parse(form.dataset.custom || '{}'); } catch { custom = {}; } document.getElementById('dynamic-equipment-fields').innerHTML = tipo?.campos?.length ? `<h4>Datos de ${escapeHtml(tipo.nombre)}</h4>${tipo.campos.map(field => `<label>${escapeHtml(field.nombre)}<input type="${field.tipo}" name="custom_${field.id}" value="${escapeHtml(custom[field.id] || '')}" required></label>`).join('')}` : ''; }
async function submitInventoryForm(event, entity, id) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries()); const collection = `${entity}s`; const record = { ...(id ? inventoryState[collection].find(item => item.id === id) : {}), id: id || makeId(), ...data };
    if (entity === 'equipo') { record.sedeId = form.dataset.sedeId || ''; record.chequeable = form.elements.chequeable.checked; delete record.imageFile; }
    if (entity === 'area') record.chequeable = form.elements.chequeable.checked;
    Object.keys(record).filter(key => key.startsWith('custom_')).forEach(key => delete record[key]);
    if (entity === 'tipo') record.campos = [...form.querySelectorAll('.field-definition')].map(field => ({ id: makeId(), nombre: field.querySelector('[name="fieldName"]').value.trim(), tipo: field.querySelector('[name="fieldType"]').value }));
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
    body.innerHTML = `<form id="userForm"><div class="form-grid"><label>Nombre<input name="nombre" required value="${escapeHtml(current?.nombre || '')}" placeholder="Nombre completo"></label><label>Correo<input name="email" type="email" required value="${escapeHtml(current?.email || '')}" placeholder="persona@empresa.com"></label>${id ? '' : '<label>Contraseña inicial<input name="password" type="password" minlength="6" required placeholder="Mínimo 6 caracteres"></label>'}<label>Rol<select name="roleId" required>${inventoryState.roles.map(role => `<option value="${role.id}" ${role.id === (current?.roleId || 'inspector') ? 'selected' : ''}>${escapeHtml(role.nombre)} · ${role.permissions.length} módulos</option>`).join('')}</select></label><label>Estado<select name="estado"><option ${current?.estado !== 'Inactivo' ? 'selected' : ''}>Activo</option><option ${current?.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></label></div><div class="form-actions"><button type="button" class="btn-secondary close-modal">Cancelar</button><button class="btn-primary" type="submit">${id ? 'Guardar cambios' : 'Crear usuario'}</button></div></form>`;
    modal.classList.remove('hidden'); body.querySelector('.close-modal').addEventListener('click', closeDetailModal); body.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); let uid = current?.uid || ''; if (!id) { try { const credential = await createUserWithEmailAndPassword(provisioningAuth, data.email, data.password); uid = credential.user.uid; await signOutProvisioning(provisioningAuth); } catch (error) { showToast(error.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear la cuenta Firebase.', 'error'); return; } } delete data.password; const record = { ...(current || {}), id: current?.id || makeId(), uid, ...data, sedeIds: current?.sedeIds || [] }; const index = inventoryState.users.findIndex(user => user.id === record.id); if (index >= 0) inventoryState.users[index] = record; else inventoryState.users.push(record); saveInventory(); renderInventory(); closeDetailModal(); showToast('Usuario guardado.', 'success'); });
}
function renderAssignments() {
    const userSelect = document.getElementById('assignmentUser'); const sites = document.getElementById('assignmentSites'); if (!userSelect || !sites) return;
    const selected = userSelect.value || inventoryState.users[0]?.id || ''; userSelect.innerHTML = inventoryState.users.map(user => `<option value="${user.id}" ${user.id === selected ? 'selected' : ''}>${escapeHtml(user.nombre || user.email)}</option>`).join(''); const user = inventoryState.users.find(item => item.id === userSelect.value) || inventoryState.users[0];
    sites.innerHTML = inventoryState.sedes.length ? inventoryState.sedes.map(site => `<label class="site-check"><input type="checkbox" value="${site.id}" ${user?.sedeIds?.includes(site.id) ? 'checked' : ''}>${escapeHtml(site.nombre)}</label>`).join('') : emptyEntity('Crea una sede para poder asignarla.');
}
function renderReports() {
    const stats = document.getElementById('reportStats'); const chart = document.getElementById('reportStatusChart'); if (!stats || !chart) return;
    const statusCounts = inventoryState.equipos.reduce((counts, item) => { counts[item.estado || 'Sin estado'] = (counts[item.estado || 'Sin estado'] || 0) + 1; return counts; }, {}); const cards = [['Sedes', inventoryState.sedes.length], ['Áreas', inventoryState.areas.length], ['Equipos', inventoryState.equipos.length], ['Usuarios activos', inventoryState.users.filter(user => user.estado === 'Activo').length]];
    stats.innerHTML = cards.map(([label, value]) => `<div class="report-stat"><span>${label}</span><strong>${value}</strong></div>`).join(''); chart.innerHTML = Object.keys(statusCounts).length ? Object.entries(statusCounts).map(([label, value]) => `<div class="status-row"><span>${escapeHtml(label)}</span><div class="status-track"><i style="width:${inventoryState.equipos.length ? (value / inventoryState.equipos.length) * 100 : 0}%"></i></div><strong>${value}</strong></div>`).join('') : emptyEntity('Aún no hay equipos para mostrar.');
}
function downloadFile(filename, content, type) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
function exportExcel() { const rows = [['Equipo', 'Código', 'Tipo', 'Sede', 'Área', 'Estado', 'Número de serie', 'Imagen']]; inventoryState.equipos.forEach(item => { const area = inventoryState.areas.find(areaItem => areaItem.id === item.areaId); rows.push([item.nombre, item.codigo, inventoryState.tipos.find(type => type.id === item.tipoId)?.nombre || '', inventoryState.sedes.find(site => site.id === item.sedeId)?.nombre || '', area?.nombre || '', item.estado, item.serial || '', item.imageUrl || '']); }); downloadFile('reporte-inventario.xls', rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join('\t')).join('\n'), 'application/vnd.ms-excel'); }
function exportPdf() { const rows = inventoryState.equipos.map(item => `<tr><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.codigo)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(inventoryState.sedes.find(site => site.id === item.sedeId)?.nombre || '')}</td></tr>`).join(''); const reportWindow = window.open('', '_blank'); if (!reportWindow) return showToast('Permite ventanas emergentes para exportar el PDF.', 'warning'); reportWindow.document.write(`<html><head><title>Reporte de inventario</title><style>body{font-family:Arial;padding:30px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5d0;padding:8px;text-align:left}th{background:#dce9e2}</style></head><body><h1>Reporte de inventario</h1><p>Generado el ${new Date().toLocaleString('es-CO')}</p><table><thead><tr><th>Equipo</th><th>Código</th><th>Estado</th><th>Sede</th></tr></thead><tbody>${rows}</tbody></table></body></html>`); reportWindow.document.close(); reportWindow.focus(); reportWindow.print(); }
function detailLabel(key) { return { uid: 'UID', nombre: 'Nombre', email: 'Correo', roleId: 'Rol', estado: 'Estado', sedeIds: 'Sedes asignadas', sedeId: 'Sede', areaId: 'Área', tipoId: 'Tipo de equipo', codigo: 'Código', direccion: 'Dirección', serial: 'Número de serie', descripcion: 'Descripción', chequeable: 'Chequeable', imageUrl: 'Imagen' }[key] || key; }
function detailValue(key, value) { if (key === 'roleId') return roleName(value); if (key === 'sedeIds') return (value || []).map(id => inventoryState.sedes.find(site => site.id === id)?.nombre || id).join(', ') || 'Sin sedes asignadas'; if (key === 'sedeId') return inventoryState.sedes.find(site => site.id === value)?.nombre || 'Sin sede'; if (key === 'areaId') return inventoryState.areas.find(area => area.id === value)?.nombre || 'Sin área'; if (key === 'tipoId') return inventoryState.tipos.find(type => type.id === value)?.nombre || 'Sin tipo'; if (key === 'chequeable') return value ? 'Sí' : 'No'; return value; }
function showDetail(entity, id) { const item = inventoryState[`${entity}s`].find(record => record.id === id); if (!item) return; const modal = document.getElementById('detailModal'); document.getElementById('detailModalTitle').textContent = item.nombre || item.email || 'Detalle'; const visibleEntries = Object.entries(item).filter(([key]) => !['id', 'datos', 'campos', 'imageUrl'].includes(key) && !key.startsWith('custom_')); const storedCustom = item.datos && Object.keys(item.datos).length ? item.datos : Object.fromEntries(Object.entries(item).filter(([key]) => key.startsWith('custom_')).map(([key, value]) => [key.slice(7), value])); const customFields = entity === 'equipo' ? Object.entries(storedCustom).map(([fieldId, value]) => { const field = inventoryState.tipos.find(type => type.id === item.tipoId)?.campos?.find(candidate => candidate.id === fieldId); return [field?.nombre || fieldId, value]; }) : []; document.getElementById('detailModalBody').innerHTML = `<dl class="detail-list">${visibleEntries.map(([key, value]) => `<div><dt>${escapeHtml(detailLabel(key))}</dt><dd>${escapeHtml(detailValue(key, value))}</dd></div>`).join('')}${customFields.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>${item.imageUrl ? `<img class="equipment-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.nombre)}">` : ''}<button class="btn-secondary close-modal" type="button">Cerrar</button>`; modal.classList.remove('hidden'); modal.querySelector('.close-modal').addEventListener('click', closeDetailModal); }
function closeDetailModal() { const modal = document.getElementById('detailModal'); const form = modal.querySelector('.entity-form'); if (form?.dataset.returnParentId) { const parent = document.getElementById(form.dataset.returnParentId); if (parent) parent.appendChild(form); form.classList.add('hidden'); delete form.dataset.returnParentId; } modal.classList.add('hidden'); document.getElementById('detailModalBody').innerHTML = ''; }
function uploadToCloudinary(file) { if (!file) return Promise.resolve(''); if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.uploadPreset) return Promise.reject(new Error('Cloudinary aún no está configurado.')); const data = new FormData(); data.append('file', file); data.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset); return fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: data }).then(response => { if (!response.ok) throw new Error('No se pudo subir la imagen.'); return response.json(); }).then(result => result.secure_url); }
document.querySelectorAll('.inventory-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.inventory-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.inventory-panel').forEach(panel => panel.classList.toggle('active', panel.id === `inventory-panel-${tab.dataset.inventoryTab}`)); }));
document.querySelectorAll('.inventory-filter').forEach(input => input.addEventListener('input', renderInventory));
document.querySelectorAll('.inventory-add').forEach(button => button.addEventListener('click', () => showInventoryForm(button.dataset.entity)));
document.getElementById('view-inventario').addEventListener('click', event => { const button = event.target.closest('.detail-entity, .edit-entity, .delete-entity'); if (!button) return; if (button.classList.contains('detail-entity')) showDetail(button.dataset.entity, button.dataset.id); else if (button.classList.contains('edit-entity')) showInventoryForm(button.dataset.entity, button.dataset.id); else deleteInventory(button.dataset.entity, button.dataset.id); });
document.getElementById('newUserBtn').addEventListener('click', () => showUserModal());
document.getElementById('usersList').addEventListener('click', event => { const button = event.target.closest('.detail-user, .edit-user, .toggle-user'); if (!button) return; const user = inventoryState.users.find(item => item.id === button.dataset.id); if (!user) return; if (button.classList.contains('detail-user')) showDetail('user', button.dataset.id); else if (button.classList.contains('edit-user')) showUserModal(button.dataset.id); else { user.estado = user.estado === 'Activo' ? 'Inactivo' : 'Activo'; saveInventory(); renderInventory(); showToast(`Usuario ${user.estado.toLowerCase()}.`, 'success'); } });
document.getElementById('userSearch').addEventListener('input', renderUsers); document.getElementById('userRoleFilter').addEventListener('change', renderUsers); document.getElementById('userStatusFilter').addEventListener('change', renderUsers);
document.getElementById('assignmentUser').addEventListener('change', renderAssignments); document.getElementById('saveAssignmentBtn').addEventListener('click', () => { const user = inventoryState.users.find(item => item.id === document.getElementById('assignmentUser').value); if (!user) return; user.sedeIds = [...document.querySelectorAll('#assignmentSites input:checked')].map(input => input.value); saveInventory(); renderAssignments(); showToast('Asignación guardada.', 'success'); });
document.getElementById('exportExcelBtn').addEventListener('click', exportExcel); document.getElementById('exportPdfBtn').addEventListener('click', exportPdf); document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal); document.getElementById('detailModal').addEventListener('click', event => { if (event.target.id === 'detailModal') closeDetailModal(); });

function switchView(viewKey) {
    if (!hasPermission(viewKey)) { showToast('Tu rol no tiene acceso a este módulo.', 'warning'); return; }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewKey}`);
    if (target) target.classList.add('active');

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
logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    logoutBtn.style.opacity = '0.6';
    try {
        await signOut(auth);
        showToast('Sesión cerrada correctamente', 'success', 1500);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showToast('No se pudo cerrar sesión. Intenta de nuevo.', 'error');
        logoutBtn.disabled = false;
        logoutBtn.style.opacity = '';
    }
});

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