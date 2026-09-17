// Módulo para control de versiones automático
const VERSION_KEY = 'checkia_app_version';

export async function checkVersion() {
    try {
        // Obtener version.json con un timestamp para evitar caché
        const response = await fetch(`version.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('No se pudo obtener version.json');
        const data = await response.json();
        const remoteVersion = data.version || '0.0.0';

        // Obtener versión almacenada en localStorage
        const localVersion = localStorage.getItem(VERSION_KEY) || '0.0.0';

        // Si la versión remota es diferente, forzar recarga
        if (remoteVersion !== localVersion) {
            console.log(`🔄 Nueva versión detectada: ${remoteVersion} (actual: ${localVersion})`);
            // Guardar la nueva versión
            localStorage.setItem(VERSION_KEY, remoteVersion);

            // Mostrar un mensaje y recargar después de 2 segundos
            const container = document.getElementById('messageContainer');
            if (container) {
                const div = document.createElement('div');
                div.className = 'message warning';
                div.textContent = `🔔 Nueva versión ${remoteVersion} disponible. La página se recargará automáticamente.`;
                container.appendChild(div);
            }

            // Recargar después de 2 segundos
            setTimeout(() => {
                window.location.reload(true);
            }, 2000);

            return false; // Indica que se va a recargar
        }

        console.log(`✅ Versión actual: ${remoteVersion}`);
        return true; // Todo correcto

    } catch (error) {
        console.warn('Error al verificar versión:', error);
        return true; // Continuar sin interrupción
    }
}

// Ejecutar la verificación al cargar
checkVersion();

// También podemos exponer la función para usarla desde app.js si queremos
export function getStoredVersion() {
    return localStorage.getItem(VERSION_KEY) || '0.0.0';
}