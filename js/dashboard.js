import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "firebase/auth";
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
    checklists: { title: 'Checklists',    subtitle: 'Crea y administra tus listas' },
    reportes:   { title: 'Reportes',      subtitle: 'Estadísticas y exportación' },
    usuarios:   { title: 'Usuarios',      subtitle: 'Gestión de usuarios y roles' },
    config:     { title: 'Configuración', subtitle: 'Preferencias de la aplicación' }
};

function switchView(viewKey) {
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