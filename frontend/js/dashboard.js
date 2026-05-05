/**
 * dashboard.js — Lógica del Dashboard
 */

(async function init() {
  if (!Auth.requireAuth()) return;

  const user = Auth.getUser();

  /* Inyectar sidebar y topbar */
  document.getElementById('sidebarContainer').innerHTML = Components.sidebar('dashboard');
  document.getElementById('topbarContainer').innerHTML  = Components.topbar('Dashboard', 'Resumen general del sistema');

  /* Saludo personalizado */
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('welcomeMsg').textContent = `${saludo}, ${user.nombre.split(' ')[0]}`;

  /* Mostrar acciones de bibliotecario */
  if (Auth.isBibliotecario()) {
    document.getElementById('librarianActions').innerHTML = `
      <a href="reportes.html" class="btn btn-primary btn-sm">
        <i class="fas fa-chart-bar me-1"></i>Ver Reportes
      </a>`;
    document.getElementById('porVencerCard').style.display = '';
  }

  /* Cargar datos en paralelo */
  const [librosRes, porVencerRes] = await Promise.allSettled([
    API.getLibros(),
    API.getPrestamosVencer(),
  ]);

  /* ── Stats ─────────────────────────────────────────────── */
  if (librosRes.status === 'fulfilled') {
    const libros = librosRes.value;
    const disponibles = libros.filter(l => l.cantidad_disponible > 0).length;
    const categorias  = new Set(libros.map(l => l.categoria).filter(Boolean)).size;

    document.getElementById('statTotalLibros').textContent  = libros.length;
    document.getElementById('statDisponibles').textContent  = disponibles;
    document.getElementById('statCategorias').textContent   = categorias;
  } else {
    ['statTotalLibros', 'statDisponibles', 'statCategorias'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }

  /* ── Por vencer ─────────────────────────────────────────── */
  if (porVencerRes.status === 'fulfilled') {
    const pv = porVencerRes.value;
    document.getElementById('statPorVencer').textContent = pv.length;

    if (Auth.isBibliotecario()) {
      document.getElementById('porVencerCount').textContent = pv.length;
      renderPorVencer(pv);
    }
  } else {
    document.getElementById('statPorVencer').textContent = '—';
  }

  /* ── Mis préstamos (localStorage) ─────────────────────── */
  renderMisPrestamos();
})();

/* ── Render helpers ──────────────────────────────────────────── */

function renderMisPrestamos() {
  const container = document.getElementById('misPrestamosList');
  const lista = Auth.getPrestamosLocales().filter(p => p.estado === 'activo').slice(0, 5);

  if (lista.length === 0) {
    const msg = Auth.isBibliotecario()
      ? 'Los bibliotecarios gestionan préstamos pero no los solicitan'
      : 'Visita el catálogo para solicitar un libro';
    Components.empty(container, 'fa-inbox', 'Sin préstamos activos', msg);
    return;
  }

  const rows = lista.map(p => `
    <tr>
      <td>
        <div style="font-weight:500;font-size:.855rem;">${p.titulo}</div>
        <div style="font-size:.77rem;color:var(--muted);">${p.autor}</div>
      </td>
      <td class="text-muted" style="font-size:.8rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_devolucion_esperada)}</td>
      <td>${Components.diasBadge(p.fecha_devolucion_esperada)}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom w-100">
        <thead><tr>
          <th>Libro</th>
          <th>Vence</th>
          <th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderPorVencer(lista) {
  const container = document.getElementById('porVencerList');
  if (lista.length === 0) {
    Components.empty(container, 'fa-check-circle', 'Ninguno por vencer', 'Todo en orden');
    return;
  }

  container.innerHTML = lista.slice(0, 8).map(p => `
    <div class="d-flex align-items-start gap-2 px-3 py-2 border-bottom" style="font-size:.83rem;">
      <i class="fas fa-exclamation-circle text-warning mt-1" style="font-size:.85rem;"></i>
      <div>
        <div class="fw-500">${p.titulo}</div>
        <div class="text-muted" style="font-size:.76rem;">
          ${p.nombre} &mdash; ${Components.fechaCorta(p.fecha_devolucion_esperada)}
        </div>
      </div>
    </div>`).join('');
}
