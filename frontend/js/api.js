/**
 * api.js — Comunicación con todos los microservicios
 * Utiliza Fetch API con token JWT en cada petición autenticada.
 */

const SERVICES = {
  USUARIOS:       'http://localhost:5002',
  CATALOGO:       'http://localhost:5001',
  PRESTAMOS:      'http://localhost:5008',
  NOTIFICACIONES: 'http://localhost:5003',
};

const API = {

  /* ── Headers ───────────────────────────────────────────────── */

  headers(auth = true) {
    const h = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = localStorage.getItem('token');
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  },

  /* ── Request helper ─────────────────────────────────────────── */

  async request(url, options = {}) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (networkErr) {
      throw { error: 'No se pudo conectar al servidor. Verifica que el microservicio esté activo.' };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw { status: response.status, error: data.error || `Error ${response.status}`, ...data };
    }
    return data;
  },

  /* ── USUARIOS (puerto 5002) ─────────────────────────────────── */

  /** Iniciar sesión → { token, usuario } */
  login(email, password) {
    return this.request(`${SERVICES.USUARIOS}/auth/login`, {
      method:  'POST',
      headers: this.headers(false),
      body:    JSON.stringify({ email, password }),
    });
  },

  /** Registrar usuario → { mensaje, usuario } */
  registro(nombre, email, password, rol, facultad) {
    return this.request(`${SERVICES.USUARIOS}/auth/registro`, {
      method:  'POST',
      headers: this.headers(false),
      body:    JSON.stringify({ nombre, email, password, rol, facultad }),
    });
  },

  /* ── CATÁLOGO (puerto 5001) ─────────────────────────────────── */

  /**
   * Buscar/listar libros
   * @param {Object} params  { q, categoria, disponible }
   */
  getLibros(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined))
    ).toString();
    return this.request(`${SERVICES.CATALOGO}/catalogo/libros${qs ? '?' + qs : ''}`);
  },

  /** Obtener libro por ID */
  getLibro(id) {
    return this.request(`${SERVICES.CATALOGO}/catalogo/libros/${id}`);
  },

  /** Crear libro (requiere auth de bibliotecario) */
  crearLibro(data) {
    return this.request(`${SERVICES.CATALOGO}/catalogo/libros`, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify(data),
    });
  },

  /** Actualizar libro */
  actualizarLibro(id, data) {
    return this.request(`${SERVICES.CATALOGO}/catalogo/libros/${id}`, {
      method:  'PUT',
      headers: this.headers(),
      body:    JSON.stringify(data),
    });
  },

  /** Eliminar libro */
  eliminarLibro(id) {
    return this.request(`${SERVICES.CATALOGO}/catalogo/libros/${id}`, {
      method:  'DELETE',
      headers: this.headers(),
    });
  },

  /* ── PRÉSTAMOS (puerto 5008) ────────────────────────────────── */

  /**
   * Crear préstamo
   * @param {number} libro_id
   */
  crearPrestamo(libro_id) {
    return this.request(`${SERVICES.PRESTAMOS}/prestamos`, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify({ libro_id }),
    });
  },

  /**
   * Devolver libro
   * @param {number} id  ID del préstamo
   */
  devolverPrestamo(id) {
    return this.request(`${SERVICES.PRESTAMOS}/prestamos/${id}/devolver`, {
      method:  'PATCH',
      headers: this.headers(),
    });
  },

  /** Préstamos por vencer en las próximas 48 h */
  getPrestamosVencer() {
    return this.request(`${SERVICES.PRESTAMOS}/prestamos/por-vencer`);
  },

  /* ── NOTIFICACIONES (puerto 5003) ───────────────────────────── */

  /** Ejecutar revisión manual de notificaciones */
  ejecutarRevision() {
    return this.request(`${SERVICES.NOTIFICACIONES}/notificaciones/ejecutar-revision`, {
      method:  'POST',
      headers: this.headers(),
    });
  },

  /* ── Health checks ──────────────────────────────────────────── */

  healthCatalogo()       { return this.request(`${SERVICES.CATALOGO}/health`); },
  healthPrestamos()      { return this.request(`${SERVICES.PRESTAMOS}/health`); },
  healthUsuarios()       { return this.request(`${SERVICES.USUARIOS}/health`); },
  healthNotificaciones() { return this.request(`${SERVICES.NOTIFICACIONES}/health`); },
};
