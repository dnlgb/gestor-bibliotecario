require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5003;
const PRESTAMOS_URL = process.env.PRESTAMOS_URL || 'http://localhost:5008';

app.use(cors());
app.use(express.json());

// Configurar transporter de email
const transporter = nodemailer.createTransport({
host: process.env.SMTP_HOST,
port: parseInt(process.env.SMTP_PORT),
secure: false,
auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
}
});
/* se configura el transporter de email*/
// Cron: todos los días a las 8am
cron.schedule('0 8 * * *', () => {
    console.log(' Revisando préstamos por vencer...');
}, { timezone: 'America/Bogota' });

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', servicio: 'notificaciones', puerto: PORT });
});
const revisarPrestamos = async () => {
    try {
    const response = await fetch(`${PRESTAMOS_URL}/prestamos/por-vencer`);
    const prestamos = await response.json();
    console.log(`📋 Encontrados ${prestamos.length} préstamos por vencer`);

    for (const prestamo of prestamos) {
        console.log(`📧 Enviando email a ${prestamo.email} por "${prestamo.titulo}"`);
        // Aquí irá el envío de email cuando tengas SMTP
    }
    } catch (err) {
    console.error('❌ Error:', err.message);
}
};

app.post('/notificaciones/ejecutar-revision', async (req, res) => {
    /* se revisan los préstamos por vencer*/
    await revisarPrestamos();
    /* se devuelve un mensaje de éxito*/
    res.json({ mensaje: 'Revisión ejecutada' });
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
});/* se consultan los préstamos por vencer*/
app.listen(PORT, () => console.log(`✅ Servicio Notificaciones corriendo en puerto ${PORT}`));