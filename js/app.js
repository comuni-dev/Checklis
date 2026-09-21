import { auth } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "firebase/auth";
import { getStoredVersion } from './version-check.js';

// ===== Elementos del DOM =====
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const togglePasswordBtn = document.getElementById('togglePassword');
const versionSpan = document.getElementById('versionDisplay');
const forgotLink = document.getElementById('forgotPassword');

// ===== Mostrar versión almacenada =====
versionSpan.textContent = getStoredVersion();

/* ============================================================
   SISTEMA DE TOASTS MODERNOS
   ============================================================ */
const ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
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
        <div class="toast-content">
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
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

    toast.addEventListener('mouseenter', () => {
        clearTimeout(autoClose);
        progress.style.animationPlayState = 'paused';
    });
    toast.addEventListener('mouseleave', () => {
        progress.style.animationPlayState = 'running';
        setTimeout(removeToast, 1500);
    });

    return toast;
}

// Exponer para version-check.js
window.showToast = showToast;

/* ============================================================
   TOGGLE CONTRASEÑA
   ============================================================ */
const EYE_OPEN = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const EYE_CLOSED = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    togglePasswordBtn.querySelector('svg').innerHTML = isPassword ? EYE_CLOSED : EYE_OPEN;
    togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

/* ============================================================
   RECUPERAR CONTRASEÑA
   ============================================================ */
forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!email) {
        showToast('Escribe tu correo arriba y vuelve a intentarlo.', 'info');
        emailInput.focus();
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('El correo no tiene un formato válido.', 'error');
        return;
    }

    try {
        forgotLink.style.pointerEvents = 'none';
        forgotLink.style.opacity = '0.5';

        await sendPasswordResetEmail(auth, email);
        showToast(`Enlace de recuperación enviado a ${email}`, 'success');
    } catch (error) {
        console.error('Error al enviar correo:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('No existe una cuenta con este correo.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Demasiados intentos. Espera un momento.', 'warning');
        } else {
            showToast('No se pudo enviar el correo. Intenta de nuevo.', 'error');
        }
    } finally {
        forgotLink.style.pointerEvents = '';
        forgotLink.style.opacity = '';
    }
});

/* ============================================================
   TRADUCCIÓN DE ERRORES
   ============================================================ */
function getErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'El correo electrónico no es válido.',
        'auth/user-disabled': 'Esta cuenta ha sido desactivada.',
        'auth/user-not-found': 'No existe una cuenta con este correo.',
        'auth/wrong-password': 'Contraseña incorrecta. Intenta de nuevo.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde.',
        'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
        'auth/missing-password': 'Ingresa tu contraseña.'
    };
    return messages[code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/* ============================================================
   LOGIN
   ============================================================ */
async function loginUser(email, password) {
    loginButton.disabled = true;
    loginButton.classList.add('loading');
    const originalText = loginButton.textContent;
    loginButton.textContent = 'Iniciando sesión...';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        showToast(`¡Bienvenido, ${user.email}!`, 'success');

        // Por esto:
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);

    } catch (error) {
        console.error(error);
        showToast(getErrorMessage(error.code), 'error');
        passwordInput.value = '';
        passwordInput.focus();
    } finally {
        loginButton.disabled = false;
        loginButton.classList.remove('loading');
        loginButton.textContent = originalText;
    }
}

/* ============================================================
   ENVÍO DEL FORMULARIO
   ============================================================ */
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showToast('Completa todos los campos.', 'warning');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Ingresa un correo electrónico válido.', 'error');
        emailInput.focus();
        return;
    }
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres.', 'warning');
        passwordInput.focus();
        return;
    }

    loginUser(email, password);
});

/* ============================================================
   ESTADO DE AUTENTICACIÓN
   ============================================================ */
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('✅ Usuario autenticado:', user.email);
        // window.location.href = 'dashboard.html';
    } else {
        console.log('🔒 Usuario no autenticado');
    }
});