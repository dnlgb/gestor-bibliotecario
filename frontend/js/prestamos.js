/**
 * prestamos.js — Gestión de préstamos del usuario
 *
 * Los préstamos se guardan en localStorage al crearse (via catalogo.js).
 * La devolucion se confirma contra el microservicio y luego se actualiza
 * en localStorage.  Para bibliotecarios se muestra también la vista del
 * endpoint /prestamos/por-vencer del sistema.
 */

let prestamosLocales  = [];
let prestamosVencer   = [];
let estadoActual      = 'activo';

/* ── Init ─────────────────────────────────────────────────────── */

(async function init() {
  if (!Auth.requireAuth()) return;

  document.getElementById('sidebarContainer').innerHTML = Components.sidebar('prestamos');
  document.getElementById('topbarContainer').innerHTML  = Components.topbar('Préstamos', 'Seguimiento de tus libros');

  prestamosLocales = Auth.getPrestamosLocales();

  /* Mostrar tab "Por Vencer" a bibliotecarios; ocultar botón "Solicitar" */
  if (Auth.isBibliotecario()) {
    document.getElementById('btnSolicitarPrestamo').style.display = 'none';
    document.getElementById('tabVencerItem').classList.remove('d-none');
    document.getElementById('prestamosTitle').textContent    = 'Gestión de Préstamos';
    document.getElementById('prestamosSubtitle').textContent = 'Seguimiento de devoluciones y préstamos del sistema';

    try {
      prestamosVencer = await API.getPrestamosVencer();
    } catch {
      prestamosVencer = [];
    }
  }

  actualizarStats();
  renderPrestamos(estadoActual);
})();

/* ── Stats ────────────────────────────────────────────────────── */

function actualizarStats() {
  const activos   = prestamosLocales.filter(p => p.estado === 'activo').length;
  const devueltos = prestamosLocales.filter(p => p.estado === 'devuelto').length;
  const porVencer = prestamosLocales.filter(p => {
    if (p.estado !== 'activo') return false;
    const dias = Components.diasRestantes(p.fecha_devolucion_esperada);
    return dias !== null && dias >= 0 && dias <= 2;
  }).length;
  const vencidos  = prestamosLocales.filter(p => {
    if (p.estado !== 'activo') return false;
    const dias = Components.diasRestantes(p.fecha_devolucion_esperada);
    return dias !== null && dias < 0;
  }).length;

  document.getElementById('cntActivos').textContent   = activos;
  document.getElementById('cntDevueltos').textContent  = devueltos;
  document.getElementById('cntPorVencer').textContent  = Auth.isBibliotecario() ? prestamosVencer.length : porVencer;
  document.getElementById('cntVencidos').textContent   = vencidos;
}

/* ── Filtrar y renderizar ─────────────────────────────────────── */

function filtrarEstado(estado) {
  estadoActual = estado;

  /* Actualizar tabs activos */
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
  const titulo    = {
    activo:     'Préstamos Activos',
    devuelto:   'Préstamos Devueltos',
    todos:      'Todos los Préstamos',
    por_vencer: 'Préstamos por Vencer en el Sistema',
  };

  document.getElementById('tablaTitle').textContent = titulo[estado] || 'Préstamos';

  if (estado === 'por_vencer') {
    renderVencer(container);
    return;
  }

  const lista = estado === 'todos'
    ? prestamosLocales
    : prestamosLocales.filter(p => p.estado === estado);

  document.getElementById('contadorBadge').textContent = lista.length;

  if (lista.length === 0) {
    const esBibliotecario = Auth.isBibliotecario();
    const msgs = {
      activo:   ['fa-inbox',       'Sin préstamos activos',
                 esBibliotecario ? 'Los usuarios activos aparecerán aquí' : 'Ve al catálogo para solicitar un libro'],
      devuelto: ['fa-check-circle','Sin préstamos devueltos',
                 esBibliotecario ? 'Las devoluciones registradas aparecerán aquí' : 'Aquí aparecerán los libros que ya devolviste'],
      todos:    ['fa-book',        'Sin historial de préstamos',
                 esBibliotecario ? 'Aún no hay préstamos registrados en el sistema' : 'Aún no has solicitado ningún libro'],
    };
    const [icon, title, sub] = msgs[estado] || ['fa-book', 'Sin préstamos', ''];
    Components.empty(container, icon, title, sub);
    return;
  }

  const rows = lista.map(p => {
    const diasBadge = p.estado === 'activo' ? Components.diasBadge(p.fecha_devolucion_esperada) : '';
    const estadoBadge = p.estado === 'devuelto'
      ? `<span class="badge-status bs-devuelto"><i class="fas fa-check"></i> Devuelto</span>`
      : (Components.diasRestantes(p.fecha_devolucion_esperada) < 0
          ? `<span class="badge-status bs-vencido"><i class="fas fa-exclamation-circle"></i> Vencido</span>`
          : `<span class="badge-status bs-activo"><i class="fas fa-circle"></i> Activo</span>`);

    return `
      <tr>
        <td>
          <div style="font-weight:500">${escHtml(p.titulo)}</div>
          <div class="text-muted" style="font-size:.78rem;">${escHtml(p.autor)}</div>
          <div style="font-size:.7rem;margin-top:2px;"><span class="isbn-badge">${escHtml(p.isbn || '')}</span></div>
        </td>
        <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_prestamo)}</td>
        <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_devolucion_esperada)}</td>
        <td>${estadoBadge}</td>
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
        <div style="font-weight:500;font-size:.855rem;">${escHtml(p.nombre)}</div>
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
          <th>Libro</th>
          <th>Usuario</th>
          <th>Vence</th>
          <th>Días</th>
          <th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Devolver ─────────────────────────────────────────────────── */

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

/* ── Utils ───────────────────────────────────────────────────── */

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
