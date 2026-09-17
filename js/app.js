import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getStoredVersion } from './version-check.js';

// ===== Elementos del DOM =====
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const messageContainer = document.getElementById('messageContainer');
const togglePasswordBtn = document.getElementById('togglePassword');
const versionSpan = document.getElementById('versionDisplay');
const forgotLink = document.getElementById('forgotPassword');

// ===== Mostrar versión almacenada =====
versionSpan.textContent = getStoredVersion() || '1.0.0';

// ===== Función para mostrar mensajes =====
function showMessage(text, type = 'error') {
    messageContainer.innerHTML = '';
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = text;
    messageContainer.appendChild(div);
}

function clearMessages() {
    messageContainer.innerHTML = '';
}

// ===== Toggle contraseña =====
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    const svg = togglePasswordBtn.querySelector('svg');
    if (type === 'text') {
        svg.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        `;
    } else {
        svg.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        `;
    }
});

// ===== Recuperar contraseña =====
forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
        showMessage('Ingresa tu correo electrónico para recuperar la contraseña.', 'info');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage(`📧 Se ha enviado un enlace de recuperación a ${email}`, 'success');
    } catch (error) {
        console.error('Error al enviar correo de recuperación:', error);
        if (error.code === 'auth/user-not-found') {
            showMessage('No existe una cuenta con este correo.', 'error');
        } else {
            showMessage('Ocurrió un error al enviar el correo. Intenta de nuevo.', 'error');
        }
    }
});

// ===== Traducir errores =====
function getErrorMessage(code) {
    const messages = {
        'auth/user-not-found': 'No existe una cuenta con este correo.',
        'auth/wrong-password': 'Contraseña incorrecta. Intenta de nuevo.',
        'auth/invalid-email': 'El correo electrónico no es válido.',
        'auth/user-disabled': 'Esta cuenta ha sido desactivada.',
        'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde.',
        'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
    };
    return messages[code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

// ===== Login =====
async function loginUser(email, password) {
    clearMessages();
    loginButton.disabled = true;
    loginButton.textContent = 'Iniciando...';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        showMessage(`✅ ¡Bienvenido, ${user.email}!`, 'success');
        // Redirigir después de 1.5s
        setTimeout(() => {
            // window.location.href = 'dashboard.html';
            console.log('Redirigir al dashboard');
        }, 1500);
    } catch (error) {
        console.error(error);
        const userMessage = getErrorMessage(error.code);
        showMessage(userMessage, 'error');
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar sesión';
    }
}

// ===== Envío del formulario =====
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showMessage('Por favor, completa todos los campos.', 'error');
        return;
    }
    if (!email.includes('@') || !email.includes('.')) {
        showMessage('Ingresa un correo electrónico válido.', 'error');
        return;
    }
    loginUser(email, password);
});

// ===== Estado de autenticación =====
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Usuario ya autenticado:', user.email);
        // Redirigir si ya está logueado
        // window.location.href = 'dashboard.html';
    } else {
        console.log('Usuario no autenticado');
    }
});