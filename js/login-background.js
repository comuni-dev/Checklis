// ============================================================
// FONDO DECORATIVO CON ICONOS FLOTANTES
// Genera iconos SVG animados en el fondo del login
// ============================================================

// ---------- ICONOS SVG DISPONIBLES ----------
const ICONS = {
    checklist: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>`,

    clipboard: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>`,

    pc: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="14" rx="2"/>
            <line x1="8" y1="22" x2="16" y2="22"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
        </svg>`,

    laptop: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="12" rx="2"/>
            <path d="M2 20h20"/>
        </svg>`,

    stethoscope: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 3v6a6 6 0 0 0 12 0V3"/>
            <path d="M12 15v4"/>
            <circle cx="12" cy="21" r="2"/>
            <path d="M6 3h-2"/>
            <path d="M18 3h2"/>
        </svg>`,

    bloodPressure: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 12l3-3"/>
            <path d="M12 3v2"/>
            <path d="M21 12h-2"/>
            <path d="M3 12h2"/>
            <path d="M12 21v-2"/>
        </svg>`,

    heart: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>`,

    pulse: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12h4l3-8 4 16 3-8h4"/>
        </svg>`,

    thermometer: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
        </svg>`,

    syringe: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m18 2 4 4"/>
            <path d="m17 7 3-3"/>
            <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/>
            <path d="m9 11 4 4"/>
            <path d="m5 19-3 3"/>
            <path d="m14 4 6 6"/>
        </svg>`,

    pill: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
            <path d="m8.5 8.5 7 7"/>
        </svg>`,

    camera: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
        </svg>`,

    settings: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>`,

    microchip: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
        </svg>`,

    wifi: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>`,

    shield: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>`
};

// ---------- CONFIGURACIÓN DE ICONOS ----------
const BG_ICONS = [
    // Superior izquierda
    { icon: 'checklist',     top: '8%',   left: '5%',   size: 75, anim: 'float',       duration: 18, delay: 0, optional: false },
    { icon: 'pc',            top: '18%',  left: '18%',  size: 55, anim: 'float-vert',  duration: 22, delay: 2, optional: true  },
    { icon: 'heart',         top: '40%',  left: '3%',   size: 70, anim: 'pulse',       duration: 12, delay: 1, optional: false },

    // Centro superior
    { icon: 'settings',      top: '10%',  left: '40%',  size: 50, anim: 'rotate',      duration: 30, delay: 0, optional: true  },
    { icon: 'pulse',         top: '28%',  left: '28%',  size: 60, anim: 'float-horiz', duration: 20, delay: 3, optional: false },

    // Superior derecha
    { icon: 'stethoscope',   top: '12%',  right: '6%',  size: 80, anim: 'float',       duration: 24, delay: 1, optional: false },
    { icon: 'laptop',        top: '30%',  right: '15%', size: 65, anim: 'float-vert',  duration: 19, delay: 4, optional: true  },
    { icon: 'thermometer',   top: '22%',  right: '22%', size: 55, anim: 'pulse',       duration: 14, delay: 2, optional: true  },

    // Centro derecha
    { icon: 'bloodPressure', top: '45%',  right: '4%',  size: 75, anim: 'float',       duration: 25, delay: 2, optional: false },
    { icon: 'clipboard',     top: '55%',  right: '20%', size: 60, anim: 'float-vert',  duration: 21, delay: 5, optional: false },

    // Inferior izquierda
    { icon: 'clipboard',     top: '72%',  left: '10%',  size: 65, anim: 'float',       duration: 23, delay: 3, optional: true  },
    { icon: 'syringe',       top: '88%',  left: '28%',  size: 55, anim: 'rotate',      duration: 40, delay: 1, optional: true  },

    // Inferior derecha
    { icon: 'pill',          top: '48%',  right: '25%', size: 60, anim: 'float',       duration: 19, delay: 5, optional: true  },
    { icon: 'camera',        top: '78%',  right: '12%', size: 65, anim: 'float-horiz', duration: 17, delay: 2, optional: true  },
    { icon: 'microchip',     top: '90%',  right: '30%', size: 55, anim: 'pulse',       duration: 15, delay: 4, optional: true  },

    // Inferior centro
    { icon: 'wifi',          top: '88%',  left: '50%',  size: 50, anim: 'pulse',       duration: 13, delay: 6, optional: true  },
    { icon: 'shield',        top: '68%',  left: '45%',  size: 45, anim: 'float-vert',  duration: 26, delay: 7, optional: true  }
];

// ---------- FUNCIÓN QUE CREA EL FONDO ----------
function crearFondoIconos() {
    // Evitar duplicados
    if (document.querySelector('.login-bg-icons')) return;

    const container = document.createElement('div');
    container.className = 'login-bg-icons';
    container.setAttribute('aria-hidden', 'true');

    BG_ICONS.forEach(item => {
        const el = document.createElement('div');
        el.className = 'bg-icon ' + item.anim + (item.optional ? ' optional' : '');

        if (item.top)    el.style.top    = item.top;
        if (item.left)   el.style.left   = item.left;
        if (item.right)  el.style.right  = item.right;
        if (item.bottom) el.style.bottom = item.bottom;

        el.style.width  = item.size + 'px';
        el.style.height = item.size + 'px';

        el.style.animationDuration = item.duration + 's';
        el.style.animationDelay    = item.delay + 's';

        el.innerHTML = ICONS[item.icon] || '';

        container.appendChild(el);
    });

    document.body.insertBefore(container, document.body.firstChild);
}

// ---------- INICIALIZACIÓN ----------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crearFondoIconos);
} else {
    crearFondoIconos();
}