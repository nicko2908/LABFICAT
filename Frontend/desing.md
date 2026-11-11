:root {
  /* ── Marca SENA (paleta recibida) ───────────────────────── */
  --sena-verde: #39A900;
  --sena-verde-oscuro: #007832;
  --sena-azul-oscuro: #00304D;
  --sena-azul-claro: #50E5F9;
  --sena-violeta: #71277A;
  --sena-amarillo: #FDC300;

  /* ── Roles (reemplazan a los tokens de Lottielab) ───────── */
  /* Acento único: reemplaza Electric Violet */
  --color-accent: var(--sena-verde);            /* rellenos, focus, estados activos */
  --color-accent-strong: var(--sena-verde-oscuro); /* botón primario y texto de acento sobre blanco (contraste AA) */
  --color-accent-secondary: var(--sena-azul-claro); /* reemplaza Signal Blue: resaltados secundarios */

  /* Texto: reemplaza Deep Indigo / Midnight Ink */
  --color-text: var(--sena-azul-oscuro);        /* texto y títulos */
  --color-text-strong: #001A2B;                 /* derivado: azul más profundo */
  --color-slate: #4b5563;
  --color-silver: #9ca3af;

  /* Neutros (sin cambios) */
  --color-fog: #d9dbda;
  --color-mist: #e5e7eb;
  --color-paper: #ffffff;
  --color-bone: #f9fafb;
  --color-pebble: #f3f4f6;

  /* Gradientes decorativos (solo marketing, nunca controles) */
  --gradient-sunset: linear-gradient(to right, var(--sena-amarillo), var(--sena-verde));
  --gradient-bloom: linear-gradient(to right, var(--sena-violeta), var(--sena-azul-claro));

  /* ── Tipografía ─────────────────────────────────────────── */
  --font-plus-jakarta-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-google-sans-code: 'Google Sans Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --text-caption: 12px;     --leading-caption: 1.71;     --tracking-caption: 0.3px;
  --text-body-sm: 14px;     --leading-body-sm: 1.56;     --tracking-body-sm: 0.35px;
  --text-body: 16px;        --leading-body: 1.5;         --tracking-body: 0.4px;
  --text-subheading: 18px;  --leading-subheading: 1.43;  --tracking-subheading: 0px;
  --text-heading-sm: 36px;  --leading-heading-sm: 1.11;  --tracking-heading-sm: -0.9px;
  --text-heading: 48px;     --leading-heading: 1.11;     --tracking-heading: -1.2px;
  --text-display: 60px;     --leading-display: 1;        --tracking-display: -1.5px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ── Espaciado (base 8px) ───────────────────────────────── */
  --spacing-unit: 8px;
  --spacing-8: 8px;   --spacing-16: 16px;  --spacing-24: 24px;  --spacing-32: 32px;
  --spacing-40: 40px; --spacing-48: 48px;  --spacing-64: 64px;  --spacing-96: 96px;
  --spacing-128: 128px; --spacing-192: 192px; --spacing-224: 224px;

  /* ── Layout ─────────────────────────────────────────────── */
  --page-max-width: 1200px;
  --section-gap: 80px;
  --card-padding: 24px;
  --element-gap: 24px;

  /* ── Radios ─────────────────────────────────────────────── */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-3xl: 24px;
  --radius-full: 9999px;
  --radius-tags: 4px;
  --radius-cards: 8px;
  --radius-icons: 9999px;
  --radius-pills: 9999px;
  --radius-inputs: 8px;
  --radius-buttons: 12px;

  /* ── Superficies ────────────────────────────────────────── */
  --surface-canvas: #f3f4f6;
  --surface-panel: #ffffff;
  --surface-nested: #f9fafb;
}

/* ── Componentes clave ──────────────────────────────────── */
.btn-primary {
  background: var(--color-accent-strong);
  color: var(--color-paper);
  font: var(--font-weight-semibold) var(--text-body)/1 var(--font-plus-jakarta-sans);
  padding: 12px 24px;
  border: 0;
  border-radius: var(--radius-buttons);
}
.btn-primary:hover { background: var(--color-accent); }

.btn-outline {
  background: var(--color-paper);
  color: var(--color-accent-strong);
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-buttons);
  padding: 8px 20px;
}

.eyebrow {
  color: var(--color-accent-strong);
  font: var(--font-weight-semibold) var(--text-body-sm) var(--font-plus-jakarta-sans);
  letter-spacing: 0.025em;
}

.input:focus {
  border-color: var(--color-accent);
  outline: none;
  box-shadow: none;
}