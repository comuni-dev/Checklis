// Módulo para control de versiones automático
const VERSION_KEY = 'checkia_app_version';
const DEFAULT_VERSION = '1.0.14';

export async function checkVersion() {
    try {
        const response = await fetch(`version.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('No se pudo obtener version.json');
        const data = await response.json();
        const remoteVersion = data.version || DEFAULT_VERSION;

        const localVersion = localStorage.getItem(VERSION_KEY) || '0.0.0';

        if (remoteVersion !== localVersion) {
            console.log(`🔄 Nueva versión detectada: ${remoteVersion} (actual: ${localVersion})`);
            localStorage.setItem(VERSION_KEY, remoteVersion);

            // Usar el sistema de toast si está disponible
            if (window.showToast) {
                window.showToast(
                    `Nueva versión ${remoteVersion} disponible. Recargando...`,
                    'warning',
                    2000
                );
            }

            setTimeout(() => window.location.reload(), 2000);
            return false;
        }

        console.log(`✅ Versión actual: ${remoteVersion}`);
        return true;

    } catch (error) {
        console.warn('Error al verificar versión (continuando):', error);
        // Guardamos la versión por defecto para no mostrar "0.0.0"
        if (!localStorage.getItem(VERSION_KEY)) {
            localStorage.setItem(VERSION_KEY, DEFAULT_VERSION);
        }
        return true;
    }
}

export function getStoredVersion() {
    return localStorage.getItem(VERSION_KEY) || DEFAULT_VERSION;
}

// Ejecutar la verificación al cargar
checkVersion();