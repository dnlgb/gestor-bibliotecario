require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'biblioteca_secret_2024';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

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
    res.json({ status: 'ok', servicio: 'catalogo', puerto: PORT });
});
app.get('/catalogo/libros', async (req, res) => {
    const { q, categoria, disponible } = req.query;
    let query = 'SELECT * FROM libros WHERE 1=1';
    const params = [];
/* q es el término de búsqueda, categoria es la categoría del libro y disponible es un booleano que indica si el libro está disponible*/
    if (q) {
    params.push(`%${q}%`);
    query += ` AND (titulo ILIKE $${params.length} OR autor ILIKE $${params.length} OR isbn ILIKE $${params.length})`;
}
    if (categoria) {
        params.push(categoria);
        query += ` AND categoria = $${params.length}`;
}
    if (disponible === 'true') {
        query += ` AND cantidad_disponible > 0`;
}
query += ' ORDER BY titulo ASC';

try {
    const result = await pool.query(query, params);
    res.json(result.rows);
} catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar libros' });
    }
});
app.post('/catalogo/libros', authMiddleware, verificarRol('bibliotecario'), async (req, res) => {
    const { isbn, titulo, autor, editorial, anio_publicacion, categoria, cantidad_total, descripcion } = req.body;
/* isbn es el ISBN del libro, titulo es el título del libro, autor es el autor del libro, editorial es la editorial del libro, anio_publicacion es el año de publicación del libro, categoria es la categoría del libro, cantidad_total es la cantidad total de libros y descripcion es la descripción del libro*/
if (!isbn || !titulo || !autor) {
    return res.status(400).json({ error: 'ISBN, título y autor son obligatorios' });
}

try {
    
    const result = await pool.query(
        `INSERT INTO libros (isbn, titulo, autor, editorial, anio_publicacion, categoria, cantidad_total, cantidad_disponible, descripcion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8) RETURNING *`,
        [isbn, titulo, autor, editorial, anio_publicacion, categoria, cantidad_total || 1, descripcion]
    );
    res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'ISBN ya existe' });
        res.status(500).json({ error: 'Error al crear libro' });
    }
});
app.put('/catalogo/libros/:id', authMiddleware, verificarRol('bibliotecario'), async (req, res) => {
    const { titulo, autor, editorial, anio_publicacion, categoria, cantidad_total, descripcion } = req.body;
    try {
        /* se actualiza el libro*/
    const result = await pool.query(
        `UPDATE libros SET titulo=$1, autor=$2, editorial=$3, anio_publicacion=$4, 
         categoria=$5, cantidad_total=$6, descripcion=$7 WHERE id=$8 RETURNING *`,
        [titulo, autor, editorial, anio_publicacion, categoria, cantidad_total, descripcion, req.params.id]
    );
    /* si el libro no se encuentra, se devuelve un error 404*/
    if (result.rows.length === 0) return res.status(404).json({ error: 'Libro no encontrado' });
    /* si el libro se encuentra, se actualiza y se devuelve el libro actualizado*/
    res.json(result.rows[0]);
    } catch (err) {
        /* si hay un error, se devuelve un error 500*/
        res.status(500).json({ error: 'Error al actualizar' });
    }
});
/* id es el ID del libro*/
app.delete('/catalogo/libros/:id', authMiddleware, verificarRol('bibliotecario'), async (req, res) => {
    try {
        /* se elimina el libro*/
        await pool.query('DELETE FROM libros WHERE id = $1', [req.params.id]);
        /* si el libro se elimina, se devuelve un mensaje de éxito*/
        res.json({ mensaje: 'Libro eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});
app.get('/catalogo/libros/:id', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM libros WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Libro no encontrado' });
    res.json(result.rows[0]);
    } catch (err) {
        /* si hay un error, se devuelve un error 500*/
        res.status(500).json({ error: 'Error interno' });
    }
});
app.listen(PORT, () => console.log(`✅ Servicio Catálogo corriendo en puerto ${PORT}`));