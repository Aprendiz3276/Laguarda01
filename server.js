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
app.use(express.static(__dirname));

// Variable para controlar inicialización
let dbInitialized = false;
let dbInitializing = false;

// Middleware para inicializar DB bajo demanda
app.use(async (req, res, next) => {
  // Solo inicializar para rutas API
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Si ya está inicializada, continuar
  if (dbInitialized) {
    return next();
  }

  // Si está inicializando, esperar
  if (dbInitializing) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (dbInitialized) {
        clearInterval(checkInterval);
        return next();
      }
      if (attempts > 50) { // 5 segundos máximo
        clearInterval(checkInterval);
        return res.status(503).json({ 
          error: 'Base de datos no disponible',
          message: 'Timeout inicializando base de datos'
        });
      }
    }, 100);
    return;
  }

  // Inicializar por primera vez
  dbInitializing = true;
  try {
    console.log('🔄 Inicializando base de datos...');
    await initializeDatabase();
    dbInitialized = true;
    dbInitializing = false;
    console.log('✅ Base de datos inicializada correctamente');
    next();
  } catch (error) {
    dbInitializing = false;
    console.error('❌ Error inicializando base de datos:', error);
    return res.status(503).json({ 
      error: 'Base de datos no disponible',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    dbInitialized: dbInitialized,
    dbType: process.env.DB_TYPE || 'not set'
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

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: true, 
    message: 'Ruta no encontrada' 
  });
});

// Solo para desarrollo local
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  initializeDatabase().then(() => {
    dbInitialized = true;
    app.listen(PORT, () => {
      console.log(`✅ Servidor en http://localhost:${PORT}`);
      console.log(`✅ Base de datos: ${process.env.DB_TYPE || 'sqlite'}`);
    });
  }).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}

export default app;
