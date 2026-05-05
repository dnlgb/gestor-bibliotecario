/**
 * reportes.js — Dashboard de reportes (solo bibliotecarios)
 *
 * Fuentes de datos:
 *   - GET /catalogo/libros   → total, disponibles, categorías, top
 *   - GET /prestamos/por-vencer → préstamos urgentes, facultades
 *   - localStorage           → préstamos por estado (sesión actual)
 */

let libros       = [];
let porVencer    = [];

const PALETTE = [
  '#3b6fd4','#22c55e','#f59e0b','#ef4444','#8b5cf6',
  '#0d9488','#ec4899','#f97316','#06b6d4','#84cc16',
];

/* ── Init ─────────────────────────────────────────────────────── */

(async function init() {
  if (!Auth.requireBibliotecario()) return;

  document.getElementById('sidebarContainer').innerHTML = Components.sidebar('reportes');
  document.getElementById('topbarContainer').innerHTML  = Components.topbar('Reportes', 'Estadísticas del sistema de biblioteca');

  await cargarReportes();
})();

/* ── Carga principal ─────────────────────────────────────────── */

async function cargarReportes() {
  const [librosRes, vencerRes] = await Promise.allSettled([
    API.getLibros(),
    API.getPrestamosVencer(),
  ]);

  libros    = librosRes.status    === 'fulfilled' ? librosRes.value    : [];
  porVencer = vencerRes.status    === 'fulfilled' ? vencerRes.value    : [];

  renderStats();
  renderChartEstado();
  renderChartCategorias();
  renderChartFacultad();
  renderTopLibros();
  renderTablaVencer();
}

/* ── Stats cards ─────────────────────────────────────────────── */

function renderStats() {
  document.getElementById('rStatLibros').textContent = libros.length;
  document.getElementById('rStatDisp').textContent   = libros.filter(l => l.cantidad_disponible > 0).length;
  document.getElementById('rStatVencer').textContent = porVencer.length;
  document.getElementById('rStatCats').textContent   =
    new Set(libros.map(l => l.categoria).filter(Boolean)).size;
}

/* ── Chart 1: Préstamos por estado ───────────────────────────── */

function renderChartEstado() {
  const todos = Auth.getPrestamosLocales();

  const activos   = todos.filter(p => p.estado === 'activo').length;
  const devueltos = todos.filter(p => p.estado === 'devuelto').length;
  const vencidos  = todos.filter(p => {
    if (p.estado !== 'activo') return false;
    return Components.diasRestantes(p.fecha_devolucion_esperada) < 0;
  }).length;

  /* Agregar préstamos del sistema (por-vencer) */
  const sistemaPV = porVencer.length;

  const labels = ['Activos', 'Devueltos', 'Vencidos', 'Por Vencer (sistema)'];
  const values = [Math.max(activos - vencidos, 0), devueltos, vencidos, sistemaPV];
  const colors = ['#3b6fd4', '#22c55e', '#ef4444', '#f59e0b'];

  dibujarPie('chartEstado', labels, values, colors);

  /* Leyenda personalizada */
  document.getElementById('legendEstado').innerHTML = labels.map((l, i) => `
    <div class="d-flex align-items-center gap-2 mb-1" style="font-size:.8rem;">
      <div style="width:12px;height:12px;border-radius:3px;background:${colors[i]};flex-shrink:0;"></div>
      <span>${l}</span>
      <span class="ms-auto fw-600">${values[i]}</span>
    </div>`).join('');
}

/* ── Chart 2: Libros por categoría ───────────────────────────── */

function renderChartCategorias() {
  const catMap = {};
  libros.forEach(l => {
    const c = l.categoria || 'Sin categoría';
    catMap[c] = (catMap[c] || 0) + 1;
  });

  const sorted  = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const labels  = sorted.map(([k]) => k);
  const values  = sorted.map(([, v]) => v);

  dibujarBarras('chartCategorias', labels, values, '#3b6fd4', 'Libros');
}

/* ── Chart 3: Préstamos por facultad ─────────────────────────── */

function renderChartFacultad() {
  /* Extraer nombre/email de los préstamos por vencer para inferir facultad */
  const facultadMap = {};
  porVencer.forEach(p => {
    /* El endpoint /prestamos/por-vencer une con usuarios; 
       si el campo facultad existe lo usamos, si no agrupamos por nombre */
    const fac = p.facultad || 'Sin Facultad';
    facultadMap[fac] = (facultadMap[fac] || 0) + 1;
  });

  if (Object.keys(facultadMap).length === 0) {
    /* Fallback: distribución de libros por categoría agrupada */
    const catMap = {};
    libros.forEach(l => {
      const c = l.categoria || 'Sin categoría';
      catMap[c] = (catMap[c] || 0) + (l.cantidad_total - l.cantidad_disponible);
    });
    const sorted = Object.entries(catMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (sorted.length === 0) {
      dibujarDoughnut('chartFacultad', ['Sin datos'], [1], ['#e2e8f0']);
      return;
    }
    dibujarDoughnut('chartFacultad',
      sorted.map(([k]) => k),
      sorted.map(([, v]) => v),
      PALETTE);
    return;
  }

  const sorted = Object.entries(facultadMap).sort((a, b) => b[1] - a[1]);
  dibujarDoughnut('chartFacultad',
    sorted.map(([k]) => k),
    sorted.map(([, v]) => v),
    PALETTE);
}

/* ── Top libros más prestados ────────────────────────────────── */

function renderTopLibros() {
  const container = document.getElementById('topLibrosContainer');

  /* Construir ranking: prestados = total - disponible */
  const ranking = libros
    .map(l => ({
      titulo:    l.titulo,
      autor:     l.autor,
      categoria: l.categoria,
      prestados: (l.cantidad_total || 0) - (l.cantidad_disponible || 0),
      total:     l.cantidad_total || 1,
    }))
    .filter(l => l.prestados > 0)
    .sort((a, b) => b.prestados - a.prestados)
    .slice(0, 8);

  if (ranking.length === 0) {
    Components.empty(container, 'fa-chart-bar', 'Sin datos de préstamos activos',
      'Los libros aparecerán aquí cuando tengan ejemplares prestados');
    return;
  }

  const max = ranking[0].prestados;

  container.innerHTML = ranking.map((l, i) => {
    const pct = Math.round((l.prestados / max) * 100);
    const colors = ['text-warning', 'text-secondary', '', '', '', '', '', ''];
    const medals  = ['fa-trophy', 'fa-medal', '', '', '', '', '', ''];
    return `
      <div class="d-flex align-items-center gap-3 mb-3">
        <div style="width:24px;text-align:center;font-size:.85rem;flex-shrink:0;" class="${colors[i] || 'text-muted'}">
          ${medals[i] ? `<i class="fas ${medals[i]}"></i>` : `<span class="text-muted">${i + 1}</span>`}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.845rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(l.titulo)}</div>
          <div style="font-size:.76rem;color:var(--muted);">${escHtml(l.autor)}</div>
          <div class="mt-1" style="height:5px;background:#f1f5f9;border-radius:4px;">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px;transition:width .5s ease;"></div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:.9rem;font-weight:700;color:var(--accent);">${l.prestados}</div>
          <div style="font-size:.7rem;color:var(--muted);">prestado${l.prestados !== 1 ? 's' : ''}</div>
        </div>
      </div>`;
  }).join('');
}

/* ── Tabla préstamos por vencer ──────────────────────────────── */

function renderTablaVencer() {
  const container = document.getElementById('tablaVencerContainer');
  document.getElementById('badgeVencer').textContent = porVencer.length;

  if (porVencer.length === 0) {
    Components.empty(container, 'fa-check-circle', 'Ningún préstamo vence en las próximas 48 h',
      'El sistema está al día');
    return;
  }

  const rows = porVencer.map(p => `
    <tr>
      <td>
        <div style="font-weight:500;font-size:.855rem;">${escHtml(p.titulo)}</div>
        <div class="text-muted" style="font-size:.77rem;">${escHtml(p.autor)}</div>
      </td>
      <td>
        <div style="font-size:.84rem;font-weight:500;">${escHtml(p.nombre)}</div>
        <div class="text-muted" style="font-size:.76rem;">${escHtml(p.email)}</div>
      </td>
      <td class="text-muted" style="font-size:.83rem;">${escHtml(p.facultad || '—')}</td>
      <td class="text-muted" style="font-size:.83rem;white-space:nowrap;">${Components.fechaCorta(p.fecha_devolucion_esperada)}</td>
      <td>${Components.diasBadge(p.fecha_devolucion_esperada)}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom w-100">
        <thead><tr>
          <th>Libro</th>
          <th>Usuario</th>
          <th>Facultad</th>
          <th>Vence</th>
          <th>Días restantes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Ejecutar notificaciones ─────────────────────────────────── */

async function ejecutarNotificaciones() {
  try {
    const res = await API.ejecutarRevision();
    Components.toast(res.mensaje || 'Revisión de notificaciones ejecutada', 'success');
  } catch (err) {
    Components.toast(err.error || 'Error al ejecutar las notificaciones', 'error');
  }
}

/* ── Chart helpers ───────────────────────────────────────────── */

const chartInstances = {};

function dibujarPie(canvasId, labels, data, colors) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed}`,
          },
        },
      },
    },
  });
}

function dibujarBarras(canvasId, labels, data, color, label) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: PALETTE.slice(0, data.length).map(c => c + 'cc'),
        borderColor:      PALETTE.slice(0, data.length),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 } },
          grid: { color: '#f1f5f9' },
        },
      },
    },
  });
}

function dibujarDoughnut(canvasId, labels, data, colors) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length).map(c => c + 'dd'),
        borderColor:      colors.slice(0, data.length),
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, padding: 12, boxWidth: 12 },
        },
      },
    },
  });
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

/* ── Utils ───────────────────────────────────────────────────── */

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
