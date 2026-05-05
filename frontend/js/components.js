/**
 * components.js — Componentes reutilizables (Sidebar, Topbar, Toast, etc.)
 */

const Components = {

  /* ── Sidebar ────────────────────────────────────────────────── */

  sidebar(activePage) {
    const user = Auth.getUser();
    const esBibliotecario = user && user.rol === 'bibliotecario';
    const inicial = user ? user.nombre.charAt(0).toUpperCase() : '?';
    const roles = { estudiante: 'Estudiante', docente: 'Docente', bibliotecario: 'Bibliotecario' };

    const link = (page, href, icon, label) => `
      <a href="${href}" class="nav-item ${activePage === page ? 'active' : ''}">
        <i class="${icon}"></i><span>${label}</span>
      </a>`;

    return `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo"><i class="fas fa-book-open"></i></div>
          <div class="sidebar-brand">
            <span class="brand-name">BiblioUni</span>
            <span class="brand-subtitle">Gestión Académica</span>
          </div>
        </div>

        <div class="sidebar-user">
          <div class="user-avatar">${inicial}</div>
          <div class="user-info">
            <div class="user-name">${user ? user.nombre : 'Usuario'}</div>
            <div class="user-role">${user ? (roles[user.rol] || user.rol) : ''}</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section">Principal</div>
          ${link('dashboard', 'dashboard.html', 'fas fa-chart-pie',       'Dashboard')}
          ${link('catalogo',  'catalogo.html',  'fas fa-book',            'Catálogo')}
          ${link('prestamos', 'prestamos.html', 'fas fa-exchange-alt',    'Mis Préstamos')}
          ${esBibliotecario ? `
          <div class="nav-section">Administración</div>
          ${link('reportes',  'reportes.html',  'fas fa-chart-bar',       'Reportes')}
          ` : ''}
        </nav>

        <div class="sidebar-footer">
          <button class="btn-logout" onclick="Auth.logout()">
            <i class="fas fa-sign-out-alt"></i><span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>`;
  },

  /* ── Topbar ─────────────────────────────────────────────────── */

  topbar(title, subtitle) {
    const user = Auth.getUser();
    const hoy  = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const roles = { estudiante: 'Estudiante', docente: 'Docente', bibliotecario: 'Bibliotecario' };

    return `
      <header class="topbar">
        <div class="topbar-left">
          <div>
            <div class="topbar-title">${title}</div>
            <div class="topbar-subtitle">${subtitle || hoy}</div>
          </div>
        </div>
        <div class="topbar-actions">
          <span style="font-size:.78rem; color:var(--muted);">
            <i class="fas fa-user-circle me-1" style="color:var(--accent)"></i>
            <strong>${user ? user.nombre : ''}</strong>
            <span class="ms-1 text-muted">&mdash; ${user ? (roles[user.rol] || user.rol) : ''}</span>
          </span>
        </div>
      </header>`;
  },

  /* ── Toast ──────────────────────────────────────────────────── */

  toast(msg, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }

    const colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#2563eb' };
    const icons  = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    el.innerHTML = `
      <i class="fas ${icons[type] || icons.info}" style="color:${colors[type]};flex-shrink:0"></i>
      <span>${msg}</span>`;

    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-fade-out');
      setTimeout(() => el.remove(), 320);
    }, 4000);
  },

  /* ── Spinners / estado vacío ────────────────────────────────── */

  loading(el, text = 'Cargando...') {
    el.innerHTML = `
      <div class="loading-box">
        <div class="spinner-border spinner-border-sm text-primary"></div> ${text}
      </div>`;
  },

  empty(el, icon, title, subtitle = '') {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon"><i class="fas ${icon}"></i></div>
        <div class="es-title">${title}</div>
        ${subtitle ? `<div class="es-subtitle">${subtitle}</div>` : ''}
      </div>`;
  },

  /* ── Helpers de formato ─────────────────────────────────────── */

  fechaCorta(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  diasRestantes(iso) {
    if (!iso) return null;
    return Math.ceil((new Date(iso) - new Date()) / 86400000);
  },

  diasBadge(iso) {
    const d = this.diasRestantes(iso);
    if (d === null) return '';
    if (d < 0)  return `<span class="dias-badge dias-danger"><i class="fas fa-exclamation-circle"></i> Vencido</span>`;
    if (d <= 2) return `<span class="dias-badge dias-warning"><i class="fas fa-clock"></i> ${d}d</span>`;
    return `<span class="dias-badge dias-ok"><i class="fas fa-calendar-check"></i> ${d}d</span>`;
  },

  rolLabel(rol) {
    return { estudiante: 'Estudiante', docente: 'Docente', bibliotecario: 'Bibliotecario' }[rol] || rol;
  },

  bookCoverColor(id) {
    const colors = [
      'linear-gradient(135deg,#3b6fd4,#1a2744)',
      'linear-gradient(135deg,#0d9488,#065f46)',
      'linear-gradient(135deg,#7c3aed,#4c1d95)',
      'linear-gradient(135deg,#db2777,#9d174d)',
      'linear-gradient(135deg,#ea580c,#7c2d12)',
      'linear-gradient(135deg,#0284c7,#0c4a6e)',
    ];
    return colors[(id || 0) % colors.length];
  },
};
