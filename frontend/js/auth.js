/**
 * auth.js — Helpers de autenticación JWT
 * Gestión del token y datos de usuario en localStorage.
 */

const Auth = {

  /* ── Getters ────────────────────────────────────────────────── */

  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        this._clear();
        return false;
      }
      return true;
    } catch {
      return !!token;
    }
  },

  getRol() {
    const user = this.getUser();
    return user ? user.rol : null;
  },

  isBibliotecario() {
    return this.getRol() === 'bibliotecario';
  },

  getNombre() {
    const user = this.getUser();
    return user ? user.nombre : 'Usuario';
  },

  /* ── Guardar / limpiar ──────────────────────────────────────── */

  save(token, usuario) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(usuario));
  },

  _clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  logout() {
    this._clear();
    window.location.href = 'index.html';
  },

  /* ── Guards ─────────────────────────────────────────────────── */

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.replace('index.html');
      return false;
    }
    return true;
  },

  requireBibliotecario() {
    if (!this.isLoggedIn()) {
      window.location.replace('index.html');
      return false;
    }
    if (!this.isBibliotecario()) {
      window.location.replace('dashboard.html');
      return false;
    }
    return true;
  },

  /* ── Préstamos locales ──────────────────────────────────────── */
  // Almacena los préstamos creados en esta sesión en localStorage
  // ya que el microservicio no expone un endpoint GET /prestamos por usuario.

  _prestamosKey() {
    const u = this.getUser();
    return u ? `prestamos_${u.id}` : 'prestamos_anon';
  },

  getPrestamosLocales() {
    try {
      return JSON.parse(localStorage.getItem(this._prestamosKey()) || '[]');
    } catch {
      return [];
    }
  },

  guardarPrestamoLocal(prestamo, libro) {
    const lista = this.getPrestamosLocales();
    lista.unshift({
      id:                      prestamo.id,
      libro_id:                prestamo.libro_id,
      isbn:                    prestamo.isbn,
      titulo:                  libro?.titulo || '—',
      autor:                   libro?.autor  || '—',
      fecha_prestamo:          prestamo.fecha_prestamo || new Date().toISOString(),
      fecha_devolucion_esperada: prestamo.fecha_devolucion_esperada,
      estado:                  'activo',
    });
    localStorage.setItem(this._prestamosKey(), JSON.stringify(lista));
  },

  marcarDevueltoLocal(prestamoId) {
    const lista = this.getPrestamosLocales().map(p =>
      p.id === prestamoId ? { ...p, estado: 'devuelto', fecha_devolucion_real: new Date().toISOString() } : p
    );
    localStorage.setItem(this._prestamosKey(), JSON.stringify(lista));
  },
};
