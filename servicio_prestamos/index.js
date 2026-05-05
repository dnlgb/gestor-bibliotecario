require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'biblioteca_secret_2024';
const CATALOGO_URL = process.env.CATALOGO_URL || 'http://localhost:5001';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(helmet());
app.use(cors());
app.use(express.json());

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

// Middleware de autenticación
const authMiddleware = (req, res, next) => {
const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    next();
} catch {
    res.status(401).json({ error: 'Token inválido' });
}
};

const verificarRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', servicio: 'prestamos', puerto: PORT, mensaje: 'hola!' });
});
const calcularFechaDevolucion = (rol) => {
    const dias = rol === 'docente' ? 30 : rol === 'bibliotecario' ? 60 : 15;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return fecha;
};

app.post('/prestamos',
  authMiddleware,
  verificarRol('estudiante', 'docente'),
  body('libro_id').isInt({ min: 1 }).withMessage('libro_id debe ser un número entero positivo'),
  validar,
  async (req, res) => {
    const { libro_id } = req.body;
    console.log('Buscando libro en:', `${CATALOGO_URL}/catalogo/libros/${libro_id}`);
    if (!libro_id) return res.status(400).json({ error: 'libro_id es requerido' });

    try {
      // Verificar disponibilidad en catálogo
    const libroRes = await fetch(`${CATALOGO_URL}/catalogo/libros/${libro_id}`);
    if (!libroRes.ok) return res.status(404).json({ error: 'Libro no encontrado' });
    const libro = await libroRes.json();

    if (libro.cantidad_disponible <= 0) {
        return res.status(400).json({ error: 'No hay ejemplares disponibles' });
    }
/* se verifica la disponibilidad del libro*/
    const fechaDevolucion = calcularFechaDevolucion(req.user.rol);
/* se calcula la fecha de devolución esperada*/
    /* se registra el préstamo*/
    const result = await pool.query(
        `INSERT INTO prestamos (usuario_id, libro_id, isbn, fecha_devolucion_esperada)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.user.id, libro_id, libro.isbn, fechaDevolucion]
    );
    await pool.query(
        'UPDATE libros SET cantidad_disponible = cantidad_disponible - 1 WHERE id = $1',
        [libro_id]
    );
    res.status(201).json({
        mensaje: 'Préstamo registrado exitosamente',
        prestamo: result.rows[0],
        libro: { titulo: libro.titulo, autor: libro.autor },
        fecha_devolucion: fechaDevolucion
});
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar préstamo' });
    }
});
app.patch('/prestamos/:id/devolver', authMiddleware, async (req, res) => {
    try {
    /* se verifica el préstamo*/
    const prestamo = await pool.query(
        'SELECT * FROM prestamos WHERE id=$1 AND usuario_id=$2 AND estado=$3',
        [req.params.id, req.user.id, 'activo']
    );
    /* si el préstamo no se encuentra, se devuelve un error 404*/
    if (prestamo.rows.length === 0) {
        return res.status(404).json({ error: 'Préstamo no encontrado o ya devuelto' });
    }
/* se actualiza el estado del préstamo a devuelto y se registra la fecha de devolución real*/
    const result = await pool.query(
        `UPDATE prestamos SET estado='devuelto', fecha_devolucion_real=NOW() WHERE id=$1 RETURNING *`,
        [req.params.id]
    );
    await pool.query(
        'UPDATE libros SET cantidad_disponible = cantidad_disponible + 1 WHERE id = $1',
        [prestamo.rows[0].libro_id]
    );
    res.json({ mensaje: 'Libro devuelto exitosamente', prestamo: result.rows[0] });
    } catch (err) {
    res.status(500).json({ error: 'Error al registrar devolución' });
    }
});
app.get('/prestamos/por-vencer', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.*, u.nombre, u.email, l.titulo, l.autor
         FROM prestamos p 
         JOIN usuarios u ON p.usuario_id = u.id 
         JOIN libros l ON p.libro_id = l.id
         WHERE p.estado = 'activo' 
         AND p.notificacion_enviada = FALSE
         AND p.fecha_devolucion_esperada BETWEEN NOW() AND NOW() + INTERVAL '48 hours'`
    );
    res.json(result.rows);
    } catch (err) {
    res.status(500).json({ error: 'Error al consultar' });
    }
});
// Todos los préstamos (solo bibliotecario)
app.get('/prestamos', authMiddleware, verificarRol('bibliotecario'), async (req, res) => {
    try {
      const { estado } = req.query;
      let query = `SELECT p.*, u.nombre as usuario_nombre, u.email as usuario_email,
                   l.titulo, l.autor FROM prestamos p
                   JOIN usuarios u ON p.usuario_id = u.id
                   JOIN libros l ON p.libro_id = l.id WHERE 1=1`;
    const params = [];
    if (estado) { params.push(estado); query += ` AND p.estado = $${params.length}`; }
    query += ' ORDER BY p.fecha_salida DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar préstamos' });
    }
});

  // Estadísticas (solo bibliotecario)
app.get('/prestamos/estadisticas', authMiddleware, verificarRol('bibliotecario'), async (req, res) => {
    try {
        /* se consultan las estadísticas*/
    const [activos, devueltos, vencidos, porFacultad, topLibros] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM prestamos WHERE estado='activo'"),
        pool.query("SELECT COUNT(*) FROM prestamos WHERE estado='devuelto'"),
        pool.query("SELECT COUNT(*) FROM prestamos WHERE estado='vencido'"),
        pool.query(`SELECT u.facultad, COUNT(*) as prestamos FROM prestamos p
                    JOIN usuarios u ON p.usuario_id = u.id GROUP BY u.facultad ORDER BY prestamos DESC`),
        pool.query(`SELECT l.titulo, COUNT(*) as veces_prestado FROM prestamos p
                    JOIN libros l ON p.libro_id = l.id GROUP BY l.titulo ORDER BY veces_prestado DESC LIMIT 5`)
    ]);
      /* se devuelven las estadísticas*/
      res.json({
        activos: parseInt(activos.rows[0].count),
        devueltos: parseInt(devueltos.rows[0].count),
        vencidos: parseInt(vencidos.rows[0].count),
        por_facultad: porFacultad.rows,
        top_libros: topLibros.rows
    });
    } catch (err) {
    res.status(500).json({ error: 'Error en estadísticas' });
    }
});
app.listen(PORT, () => console.log(`✅ Servicio Préstamos corriendo en puerto ${PORT}`));