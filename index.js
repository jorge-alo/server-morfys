import express, { json } from 'express';
import dotenv from 'dotenv';
import { router } from './src/routes/routes.js';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
dotenv.config();




const app = express();
app.use(express.json());
app.use(cookieParser());

// Configuración CORS explícita para imágenes

const allowedOrigins = [
  'http://localhost:5173',
   'https://client-morfys-git-main-jorges-projects-8a39959d.vercel.app', // remplazalo por tu dominio real en Vercel
];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));
  
  // Servir archivos estáticos con política de recursos
  app.use('/images', express.static(path.join(process.cwd(), 'images')), (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  
app.use('/api', router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Escuchando en el puerto: http://localhost:${PORT}`);
})