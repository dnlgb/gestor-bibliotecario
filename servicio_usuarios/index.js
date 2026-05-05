require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Probar conexión
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
} else {
    console.log('✅ Base de datos conectada:', res.rows[0].now);
}
});
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Health check
/* Nodemon es una utilidad que monitoriza los cambios en los archivos de tu aplicación Node. js
y reinicia automáticamente el servidor cuando detecta cambios*/
app.get('/health', (req, res) => {
    res.json({ status: 'ok', servicio: 'usuarios', puerto: PORT, mensaje: 'hola!' });
    res.json({ status: 'ok', servicio: 'usuarios', puerto: PORT });
});
app.post('/auth/registro', async (req, res) => {
    const { nombre, email, password, rol, facultad } = req.body;

    if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
        return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol, facultad) VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, email, rol',
        [nombre, email, hash, rol, facultad]
    );

    res.status(201).json({ mensaje: 'Usuario registrado', usuario: result.rows[0] });
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
    }
});
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    try {
      const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE', [email]);
    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const bcrypt = require('bcryptjs');
    const valido = await bcrypt.compare(password, user.password_hash);
    if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
        { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
    }
});
app.listen(PORT, () => {
    console.log(` Servicio Usuarios corriendo en puerto ${PORT}`);
});