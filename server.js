import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './backend/routes/auth.js';
import parkingRoutes from './backend/routes/parking.js';
import reservationRoutes from './backend/routes/reservations.js';
import userRoutes from './backend/routes/users.js';
import { initializeDatabase } from './backend/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Archivos estáticos
app.use(express.static(__dirname));

// IMPORTANTE: Inicializar base de datos ANTES de las rutas
let dbInitialized = false;

// Middleware para verificar DB
app.use(async (req, res, next) => {
  if (!dbInitialized && req.path.startsWith('/api')) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error('Error inicializando DB:', error);
      return res.status(503).json({ 
        error: 'Base de datos no disponible',
        message: error.message 
      });
    }
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    dbInitialized: dbInitialized
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/users', userRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: true, message: 'Ruta no encontrada' });
});

// Solo para desarrollo local
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  initializeDatabase().then(() => {
    dbInitialized = true;
    app.listen(PORT, () => {
      console.log(`✅ Servidor en http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}

export default app;
