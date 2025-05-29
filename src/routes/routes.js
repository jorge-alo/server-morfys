import { Router } from "express";
import { forgotPasswordQuerysData, getquerysImages,  loadQuerysLocales, loginQuerysData, logoEnvioHorarioQuerysData, registerQuerysData, resetPasswordQuerysData, uploadQuerysBanner } from "../controllers/Restaurant.querys.controller.js";
import multer from 'multer';
import { authentication } from "../middleware/auth.js";
import { cargarQuerysData, destroyQuerysData, uploadQuerysData, loadQuerysCategory } from "../controllers/Comidas.querys.controller.js";
export const router = Router();

import { storage } from '../config/cloudinary.js'; // <-- Importamos Cloudinary

const fileUpload = multer({ storage }).single('image'); // ya no usamos diskStorage

router.put('/update',fileUpload, uploadQuerysData);
router.put('/updateBanner',fileUpload, uploadQuerysBanner);
router.post('/cargar',fileUpload, authentication, cargarQuerysData);
router.put('/horario',fileUpload, authentication, logoEnvioHorarioQuerysData);
router.post('/login', loginQuerysData);
router.post('/register', fileUpload, registerQuerysData);
router.post('/category', loadQuerysCategory);
router.post('/forgot-password', forgotPasswordQuerysData); // Agrega esta línea
router.post('/reset-password', resetPasswordQuerysData);
router.post('/logout', (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None'
  });
  return res.json({ message: 'Logout exitoso' });
});
router.get('/', authentication, loadQuerysLocales);
router.get('/locales/:name', authentication, getquerysImages);
router.get('/verify-token', authentication, (req, res) => {
    if (req.user) {
      return res.json({
        login: true,
        userId: req.user.id,
        local: req.user.local,
        auth: req.user.auth
      });
    }
    res.status(401).json({ login: false });
  });

  router.delete('/destroy/:id', destroyQuerysData);