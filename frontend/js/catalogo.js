/**
 * catalogo.js — Búsqueda de libros, préstamos y CRUD para bibliotecarios
 */

let todosLosLibros = [];
let vistaActual    = 'grid';
let debounceTimer  = null;

const modalLibro   = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('modalLibro'));
const modalDetalle = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDetalle'));

/* ── Init ─────────────────────────────────────────────────────── */

(async function init() {
  if (!Auth.requireAuth()) return;

  document.getElementById('sidebarContainer').innerHTML = Components.sidebar('catalogo');
  document.getElementById('topbarContainer').innerHTML  = Components.topbar(
    'Catálogo',
    Auth.isBibliotecario() ? 'Gestiona el inventario de libros' : 'Explora y solicita libros prestados',
  );

  /* Botón agregar (solo bibliotecario) */
  if (Auth.isBibliotecario()) {
    document.getElementById('btnAgregarWrap').innerHTML = `
      <button class="btn btn-primary" onclick="abrirModalNuevo()">
        <i class="fas fa-plus me-1"></i>Agregar Libro
      </button>`;
  }

  /* Leer parámetros de URL */
  const params = new URLSearchParams(window.location.search);
  if (params.get('disponible') === 'true') {
    document.getElementById('selectDisponible').value = 'true';
  }

  await buscarLibros();
})();

/* ── Búsqueda ─────────────────────────────────────────────────── */

async function buscarLibros() {
  const container = document.getElementById('librosContainer');
  Components.loading(container, 'Buscando libros...');

  const q          = document.getElementById('inputBuscar').value.trim();
  const categoria  = document.getElementById('selectCategoria').value;
  const disponible = document.getElementById('selectDisponible').value;

  try {
    const params = {};
    if (q)          params.q          = q;
    if (categoria)  params.categoria  = categoria;
    if (disponible) params.disponible = disponible;

    todosLosLibros = await API.getLibros(params);
    actualizarCategorias(todosLosLibros);
    renderLibros(todosLosLibros);
  } catch (err) {
    Components.empty(container, 'fa-exclamation-triangle',
      'Error al cargar el catálogo',
      err.error || 'Verifica que el servicio de catálogo esté activo');
  }
}

function debouncedBuscar() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(buscarLibros, 420);
}

function limpiarFiltros() {
  document.getElementById('inputBuscar').value    = '';
  document.getElementById('selectCategoria').value = '';
  document.getElementById('selectDisponible').value = '';
  buscarLibros();
}

/* ── Actualizar lista de categorías ──────────────────────────── */

function actualizarCategorias(libros) {
  const sel  = document.getElementById('selectCategoria');
  const prev = sel.value;
  const cats = [...new Set(libros.map(l => l.categoria).filter(Boolean))].sort();

  sel.innerHTML = `<option value="">Todas las categorías</option>` +
    cats.map(c => `<option value="${c}" ${c === prev ? 'selected' : ''}>${c}</option>`).join('');
}

/* ── Render libros ───────────────────────────────────────────── */

function renderLibros(libros) {
  const container = document.getElementById('librosContainer');
  document.getElementById('resultadosInfo').textContent =
    `${libros.length} resultado${libros.length !== 1 ? 's' : ''}`;

  if (libros.length === 0) {
    Components.empty(container, 'fa-book-open', 'No se encontraron libros',
      'Intenta con otros términos de búsqueda o limpia los filtros');
    return;
  }

  if (vistaActual === 'grid') {
    container.innerHTML = `
      <div class="row g-3">
        ${libros.map(l => bookCardHTML(l)).join('')}
      </div>`;
  } else {
    container.innerHTML = `
      <div class="content-card">
        <div class="table-responsive">
          <table class="table-custom w-100">
            <thead><tr>
              <th>Libro</th><th>ISBN</th><th>Categoría</th><th>Disponibilidad</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              ${libros.map(l => bookRowHTML(l)).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }
}

function bookCardHTML(l) {
  const esBibliotecario = Auth.isBibliotecario();
  const disp = l.cantidad_disponible > 0;

  return `
    <div class="col-sm-6 col-md-4 col-lg-3">
      <div class="book-card">
        <div class="book-cover" style="background:${Components.bookCoverColor(l.id)}">
          <i class="fas fa-book"></i>
        </div>
        <div class="book-title">${escHtml(l.titulo)}</div>
        <div class="book-author"><i class="fas fa-user-pen me-1"></i>${escHtml(l.autor)}</div>
        ${l.categoria ? `<div class="book-meta"><i class="fas fa-tag me-1"></i>${escHtml(l.categoria)}</div>` : ''}
        <div class="book-footer">
          <span class="badge-status ${disp ? 'bs-disponible' : 'bs-agotado'}">
            <i class="fas ${disp ? 'fa-check' : 'fa-times'}"></i>
            ${disp ? `${l.cantidad_disponible} disp.` : 'Agotado'}
          </span>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-secondary" onclick="verDetalle(${l.id})" title="Ver detalle">
              <i class="fas fa-eye"></i>
            </button>
            ${disp && !esBibliotecario ? `
            <button class="btn btn-sm btn-primary" onclick="solicitarPrestamo(${l.id},'${escAttr(l.titulo)}')" title="Solicitar préstamo">
              <i class="fas fa-hand-holding-heart"></i>
            </button>` : ''}
            ${esBibliotecario ? `
            <button class="btn btn-sm btn-outline-warning" onclick="editarLibro(${l.id})" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarLibro(${l.id},'${escAttr(l.titulo)}')" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function bookRowHTML(l) {
  const esBibliotecario = Auth.isBibliotecario();
  const disp = l.cantidad_disponible > 0;

  return `
    <tr>
      <td>
        <div style="font-weight:500">${escHtml(l.titulo)}</div>
        <div class="text-muted" style="font-size:.78rem;">${escHtml(l.autor)}</div>
      </td>
      <td><span class="isbn-badge">${escHtml(l.isbn || '—')}</span></td>
      <td class="text-muted" style="font-size:.83rem;">${escHtml(l.categoria || '—')}</td>
      <td>
        <span class="badge-status ${disp ? 'bs-disponible' : 'bs-agotado'}">
          <i class="fas ${disp ? 'fa-check' : 'fa-times'}"></i>
          ${disp ? `${l.cantidad_disponible} disponible${l.cantidad_disponible !== 1 ? 's' : ''}` : 'Agotado'}
        </span>
      </td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary" onclick="verDetalle(${l.id})">
            <i class="fas fa-eye me-1"></i>Ver
          </button>
          ${disp && !esBibliotecario ? `
          <button class="btn btn-sm btn-primary" onclick="solicitarPrestamo(${l.id},'${escAttr(l.titulo)}')">
            <i class="fas fa-hand-holding-heart me-1"></i>Préstamo
          </button>` : ''}
          ${esBibliotecario ? `
          <button class="btn btn-sm btn-outline-warning" onclick="editarLibro(${l.id})">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="eliminarLibro(${l.id},'${escAttr(l.titulo)}')">
            <i class="fas fa-trash"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
}

/* ── Vista toggle ────────────────────────────────────────────── */

function setVista(v) {
  vistaActual = v;
  document.getElementById('btnGrid').classList.toggle('active', v === 'grid');
  document.getElementById('btnList').classList.toggle('active', v === 'list');
  renderLibros(todosLosLibros);
}

/* ── Solicitar préstamo ──────────────────────────────────────── */

async function solicitarPrestamo(libroId, titulo) {
  if (!confirm(`¿Confirmas el préstamo de:\n"${titulo}"?`)) return;

  try {
    const resp = await API.crearPrestamo(libroId);
    Auth.guardarPrestamoLocal(resp.prestamo, resp.libro);
    Components.toast(`Préstamo de "<strong>${resp.libro?.titulo || titulo}</strong>" registrado.
      Devolver antes del ${Components.fechaCorta(resp.fecha_devolucion)}`, 'success');
    await buscarLibros();
  } catch (err) {
    Components.toast(err.error || 'Error al registrar el préstamo', 'error');
  }
}

/* ── Ver detalle ─────────────────────────────────────────────── */

async function verDetalle(id) {
  const libro = todosLosLibros.find(l => l.id === id);
  if (!libro) return;

  const disp = libro.cantidad_disponible > 0;

  document.getElementById('detalleBody').innerHTML = `
    <div class="d-flex gap-3 mb-4">
      <div class="book-cover flex-shrink-0" style="background:${Components.bookCoverColor(libro.id)};width:64px;height:86px;font-size:1.6rem;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff">
        <i class="fas fa-book"></i>
      </div>
      <div>
        <h5 class="mb-1" style="font-size:1rem;">${escHtml(libro.titulo)}</h5>
        <div class="text-muted mb-2" style="font-size:.855rem;">${escHtml(libro.autor)}</div>
        <span class="badge-status ${disp ? 'bs-disponible' : 'bs-agotado'}">
          <i class="fas ${disp ? 'fa-check' : 'fa-times'}"></i>
          ${disp ? `${libro.cantidad_disponible} disponible${libro.cantidad_disponible !== 1 ? 's' : ''}` : 'Agotado'}
        </span>
      </div>
    </div>
    <dl class="row g-0 mb-0" style="font-size:.855rem;">
      <dt class="col-4 text-muted">ISBN</dt>
      <dd class="col-8"><span class="isbn-badge">${escHtml(libro.isbn || '—')}</span></dd>
      <dt class="col-4 text-muted mt-2">Editorial</dt>
      <dd class="col-8 mt-2">${escHtml(libro.editorial || '—')}</dd>
      <dt class="col-4 text-muted mt-2">Año</dt>
      <dd class="col-8 mt-2">${libro.anio_publicacion || '—'}</dd>
      <dt class="col-4 text-muted mt-2">Categoría</dt>
      <dd class="col-8 mt-2">${escHtml(libro.categoria || '—')}</dd>
      <dt class="col-4 text-muted mt-2">Total</dt>
      <dd class="col-8 mt-2">${libro.cantidad_total} ejemplar${libro.cantidad_total !== 1 ? 'es' : ''}</dd>
      ${libro.descripcion ? `
      <dt class="col-12 text-muted mt-3">Descripción</dt>
      <dd class="col-12 mt-1">${escHtml(libro.descripcion)}</dd>` : ''}
    </dl>
    ${disp && !Auth.isBibliotecario() ? `
    <div class="mt-4 text-end">
      <button class="btn btn-primary" onclick="solicitarPrestamo(${libro.id},'${escAttr(libro.titulo)}');bootstrap.Modal.getInstance(document.getElementById('modalDetalle')).hide();">
        <i class="fas fa-hand-holding-heart me-1"></i>Solicitar Préstamo
      </button>
    </div>` : ''}`;

  modalDetalle().show();
}

/* ── CRUD Libro (bibliotecario) ──────────────────────────────── */

function abrirModalNuevo() {
  document.getElementById('formLibro').reset();
  document.getElementById('libroEditId').value = '';
  document.getElementById('modalLibroTitle').textContent = 'Agregar Libro';
  document.getElementById('libroIsbn').removeAttribute('readonly');
  modalLibro().show();
}

async function editarLibro(id) {
  const libro = todosLosLibros.find(l => l.id === id);
  if (!libro) return;

  document.getElementById('libroEditId').value     = libro.id;
  document.getElementById('libroIsbn').value        = libro.isbn || '';
  document.getElementById('libroTitulo').value      = libro.titulo || '';
  document.getElementById('libroAutor').value       = libro.autor || '';
  document.getElementById('libroEditorial').value   = libro.editorial || '';
  document.getElementById('libroAnio').value        = libro.anio_publicacion || '';
  document.getElementById('libroCategoria').value   = libro.categoria || '';
  document.getElementById('libroCantidad').value    = libro.cantidad_total || 1;
  document.getElementById('libroDescripcion').value = libro.descripcion || '';
  document.getElementById('libroIsbn').setAttribute('readonly', true);
  document.getElementById('modalLibroTitle').textContent = 'Editar Libro';

  modalLibro().show();
}

async function guardarLibro(e) {
  e.preventDefault();

  const id    = document.getElementById('libroEditId').value;
  const data  = {
    isbn:            document.getElementById('libroIsbn').value.trim(),
    titulo:          document.getElementById('libroTitulo').value.trim(),
    autor:           document.getElementById('libroAutor').value.trim(),
    editorial:       document.getElementById('libroEditorial').value.trim() || undefined,
    anio_publicacion:Number(document.getElementById('libroAnio').value) || undefined,
    categoria:       document.getElementById('libroCategoria').value || undefined,
    cantidad_total:  Number(document.getElementById('libroCantidad').value) || 1,
    descripcion:     document.getElementById('libroDescripcion').value.trim() || undefined,
  };

  const btn     = document.getElementById('btnGuardarLibro');
  const spinner = document.getElementById('spinGuardar');
  btn.disabled  = true;
  spinner.classList.remove('d-none');

  try {
    if (id) {
      await API.actualizarLibro(id, data);
      Components.toast('Libro actualizado correctamente', 'success');
    } else {
      await API.crearLibro(data);
      Components.toast('Libro agregado al catálogo', 'success');
    }
    modalLibro().hide();
    await buscarLibros();
  } catch (err) {
    Components.toast(err.error || 'Error al guardar el libro', 'error');
  } finally {
    btn.disabled = false;
    spinner.classList.add('d-none');
  }
}

async function eliminarLibro(id, titulo) {
  if (!confirm(`¿Seguro que deseas eliminar "${titulo}"?\nEsta acción no se puede deshacer.`)) return;

  try {
    await API.eliminarLibro(id);
    Components.toast('Libro eliminado del catálogo', 'success');
    await buscarLibros();
  } catch (err) {
    Components.toast(err.error || 'Error al eliminar el libro', 'error');
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
