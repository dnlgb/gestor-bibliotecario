/**
 * prestamos.js — Gestión de préstamos
 *
 * Estudiante / Docente : datos de localStorage (préstamos de su sesión).
 * Bibliotecario        : datos reales de GET /prestamos (todos los préstamos).
 */

let prestamosLocales  = [];   // estudiante / docente
let todosPrestamosAPI = [];   // bibliotecario — GET /prestamos
let prestamosVencer   = [];   // GET /prestamos/por-vencer
let estadoActual      = 'activo';

/* ── Init ─────────────────────────────────────────────────────── */

(async function init() {
  if (!Auth.requireAuth()) return;

  document.getElementById('sidebarContainer').innerHTML = Components.sidebar('prestamos');
  document.getElementById('topbarContainer').innerHTML  = Components.topbar('Préstamos', 'Seguimiento de tus libros');

  if (Auth.isBibliotecario()) {
    /* ── Vista bibliotecario ── */
    document.getElementById('btnSolicitarPrestamo').style.display = 'none';
    document.getElementById('tabVencerItem').classList.remove('d-none');
    document.getElementById('prestamosTitle').textContent    = 'Gestión de Préstamos';
    document.getElementById('prestamosSubtitle').textContent = 'Todos los préstamos del sistema';

    const [apiRes, vencerRes] = await Promise.allSettled([
      API.getPrestamos(),
      API.getPrestamosVencer(),
    ]);
    todosPrestamosAPI = apiRes.status    === 'fulfilled' ? apiRes.value    : [];
    prestamosVencer   = vencerRes.status === 'fulfilled' ? vencerRes.value : [];

  } else {
    /* ── Vista estudiante / docente ── */
    prestamosLocales = Auth.getPrestamosLocales();
  }

  actualizarStats();
  renderPrestamos(estadoActual);
})();

/* ── Stats ────────────────────────────────────────────────────── */

function actualizarStats() {
  if (Auth.isBibliotecario()) {
    const activos   = todosPrestamosAPI.filter(p => p.estado === 'activo').length;
    const devueltos = todosPrestamosAPI.filter(p => p.estado === 'devuelto').length;
    const vencidos  = todosPrestamosAPI.filter(p =>
      p.estado === 'activo' && Components.diasRestantes(p.fecha_devolucion_esperada) < 0
    ).length;

    document.getElementById('cntActivos').textContent   = activos;
    document.getElementById('cntDevueltos').textContent  = devueltos;
    document.getElementById('cntPorVencer').textContent  = prestamosVencer.length;
    document.getElementById('cntVencidos').textContent   = vencidos;
  } else {
    const activos   = prestamosLocales.filter(p => p.estado === 'activo').length;
    const devueltos = prestamosLocales.filter(p => p.estado === 'devuelto').length;
    const porVencer = prestamosLocales.filter(p => {
      if (p.estado !== 'activo') return false;
      const d = Components.diasRestantes(p.fecha_devolucion_esperada);
      return d !== null && d >= 0 && d <= 2;
    }).length;
    const vencidos  = prestamosLocales.filter(p => {
      if (p.estado !== 'activo') return false;
      return Components.diasRestantes(p.fecha_devolucion_esperada) < 0;
    }).length;

    document.getElementById('cntActivos').textContent   = activos;
    document.getElementById('cntDevueltos').textContent  = devueltos;
    document.getElementById('cntPorVencer').textContent  = porVencer;
    document.getElementById('cntVencidos').textContent   = vencidos;
  }
}

/* ── Filtrar y renderizar ─────────────────────────────────────── */

function filtrarEstado(estado) {
  estadoActual = estado;
  ['tabActivos','tabDevueltos','tabTodos','tabVencer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const tabMap = { activo: 'tabActivos', devuelto: 'tabDevueltos', todos: 'tabTodos', por_vencer: 'tabVencer' };
  const tabEl  = document.getElementById(tabMap[estado]);
  if (tabEl) tabEl.classList.add('active');

  renderPrestamos(estado);
}

function renderPrestamos(estado) {
  const container = document.getElementById('prestamosTableContainer');
  const titulos   = {
    activo:     'Préstamos Activos',
    devuelto:   'Préstamos Devueltos',
    todos:      'Todos los Préstamos',
    por_vencer: 'Préstamos por Vencer en el Sistema',
  };
  document.getElementById('tablaTitle').textContent = titulos[estado] || 'Préstamos';

  if (estado === 'por_vencer') {
    renderVencer(container);
    return;
  }

  if (Auth.isBibliotecario()) {
    renderTablaBibliotecario(container, estado);
  } else {
    renderTablaUsuario(container, estado);
  }
}

/* ── Tabla para Bibliotecario (datos de API) ─────────────────── */

function renderTablaBibliotecario(container, estado) {
  const lista = estado === 'todos'
    ? todosPrestamosAPI
    : todosPrestamosAPI.filter(p => p.estado === estado);

  document.getElementById('contadorBadge').textContent = lista.length;

  if (lista.length === 0) {
    const msgs = {
      activo:   ['fa-inbox',        'Sin préstamos activos',    'No hay préstamos activos en el sistema'],
      devuelto: ['fa-check-circle', 'Sin préstamos devueltos',  'Las devoluciones aparecerán aquí'],
      todos:    ['fa-book',         'Sin préstamos registrados','Aún no hay préstamos en el sistema'],
    };
    const [icon, title, sub] = msgs[estado] || ['fa-book', 'Sin préstamos', ''];
    Components.empty(container, icon, title, sub);
    return;
  }

  const rows = lista.map(p => {
    const diasBadge   = p.estado === 'activo' ? Components.diasBadge(p.fecha_devolucion_esperada) : '';
    const estadoBadge = estadoBadgeHtml(p);
    const fechaPrest  = p.fecha_salida || p.fecha_prestamo || p.created_at;

    return `
      <tr>
        <td>
          <div style="font-weight:500">${escHtml(p.titulo)}</div>
          <div class="text-muted" style="font-size:.78rem;">${escHtml(p.autor)}</div>
          <div style="font-size:.7rem;margin-top:2px;"><span class="isbn-badge">${escHtml(p.isbn || '')}</span></div>
        </td>
        <td>
          <div style="font-size:.84rem;font-weight:500;">${escHtml(p.usuario_nombre)}</div>
          <div class="text-muted" style="font-size:.76rem;">${escHtml(p.usuario_email)}</div>
        </td>
        <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(fechaPrest)}</td>
        <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_devolucion_esperada)}</td>
        <td>${estadoBadge}</td>
        <td>${diasBadge}</td>
        <td>
          ${p.estado === 'devuelto'
            ? `<span class="text-muted" style="font-size:.78rem;">${Components.fechaCorta(p.fecha_devolucion_real)}</span>`
            : '—'}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom w-100">
        <thead><tr>
          <th>Libro</th>
          <th>Usuario</th>
          <th>F. Préstamo</th>
          <th>F. Vencimiento</th>
          <th>Estado</th>
          <th>Días restantes</th>
          <th>F. Devolución</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Tabla para Estudiante / Docente (datos de localStorage) ─── */

function renderTablaUsuario(container, estado) {
  const lista = estado === 'todos'
    ? prestamosLocales
    : prestamosLocales.filter(p => p.estado === estado);

  document.getElementById('contadorBadge').textContent = lista.length;

  if (lista.length === 0) {
    const msgs = {
      activo:   ['fa-inbox',        'Sin préstamos activos',    'Ve al catálogo para solicitar un libro'],
      devuelto: ['fa-check-circle', 'Sin préstamos devueltos',  'Aquí aparecerán los libros que ya devolviste'],
      todos:    ['fa-book',         'Sin historial de préstamos','Aún no has solicitado ningún libro'],
    };
    const [icon, title, sub] = msgs[estado] || ['fa-book', 'Sin préstamos', ''];
    Components.empty(container, icon, title, sub);
    return;
  }

  const rows = lista.map(p => {
    const diasBadge = p.estado === 'activo' ? Components.diasBadge(p.fecha_devolucion_esperada) : '';

    return `
      <tr>
        <td>
          <div style="font-weight:500">${escHtml(p.titulo)}</div>
          <div class="text-muted" style="font-size:.78rem;">${escHtml(p.autor)}</div>
          <div style="font-size:.7rem;margin-top:2px;"><span class="isbn-badge">${escHtml(p.isbn || '')}</span></div>
        </td>
        <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_prestamo)}</td>
        <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_devolucion_esperada)}</td>
        <td>${estadoBadgeHtml(p)}</td>
        <td>${diasBadge}</td>
        <td>
          ${p.estado === 'activo' ? `
          <button class="btn btn-sm btn-outline-success" onclick="devolverLibro(${p.id},'${escAttr(p.titulo)}')">
            <i class="fas fa-undo me-1"></i>Devolver
          </button>` : `
          <span class="text-muted" style="font-size:.78rem;">
            ${p.fecha_devolucion_real ? Components.fechaCorta(p.fecha_devolucion_real) : '—'}
          </span>`}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom w-100">
        <thead><tr>
          <th>Libro</th>
          <th>F. Préstamo</th>
          <th>F. Vencimiento</th>
          <th>Estado</th>
          <th>Días restantes</th>
          <th>Acción</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Tabla por vencer (bibliotecario) ────────────────────────── */

function renderVencer(container) {
  document.getElementById('contadorBadge').textContent = prestamosVencer.length;

  if (prestamosVencer.length === 0) {
    Components.empty(container, 'fa-check-circle', 'Ningún préstamo por vencer', 'Todos los préstamos están al día');
    return;
  }

  const rows = prestamosVencer.map(p => `
    <tr>
      <td>
        <div style="font-weight:500">${escHtml(p.titulo)}</div>
        <div class="text-muted" style="font-size:.78rem;">${escHtml(p.autor)}</div>
      </td>
      <td>
        <div style="font-size:.84rem;font-weight:500;">${escHtml(p.nombre)}</div>
        <div class="text-muted" style="font-size:.77rem;">${escHtml(p.email)}</div>
      </td>
      <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_devolucion_esperada)}</td>
      <td>${Components.diasBadge(p.fecha_devolucion_esperada)}</td>
      <td><span class="badge-status bs-warning"><i class="fas fa-clock"></i> Próximo a vencer</span></td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom w-100">
        <thead><tr>
          <th>Libro</th><th>Usuario</th><th>Vence</th><th>Días</th><th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Devolver (solo estudiante / docente) ────────────────────── */

async function devolverLibro(prestamoId, titulo) {
  if (!confirm(`¿Confirmas la devolución de:\n"${titulo}"?`)) return;

  try {
    await API.devolverPrestamo(prestamoId);
    Auth.marcarDevueltoLocal(prestamoId);
    prestamosLocales = Auth.getPrestamosLocales();
    actualizarStats();
    renderPrestamos(estadoActual);
    Components.toast('Libro devuelto exitosamente', 'success');
  } catch (err) {
    Components.toast(err.error || 'Error al registrar la devolución', 'error');
  }
}

/* ── Helpers ─────────────────────────────────────────────────── */

function estadoBadgeHtml(p) {
  if (p.estado === 'devuelto')
    return `<span class="badge-status bs-devuelto"><i class="fas fa-check"></i> Devuelto</span>`;
  if (Components.diasRestantes(p.fecha_devolucion_esperada) < 0)
    return `<span class="badge-status bs-vencido"><i class="fas fa-exclamation-circle"></i> Vencido</span>`;
  return `<span class="badge-status bs-activo"><i class="fas fa-circle"></i> Activo</span>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
