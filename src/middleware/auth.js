import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const authentication = (req, res, next) => {
    try {
        const token = req.cookies.jwt; // ojo, es `cookies` no `cookie`
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRETPASSWORD);
            console.log("decoded", decoded);
            req.user = decoded;
        }
    } catch (error) {
        console.error("Token inválido o expirado:", error.message);
        // No se asigna req.user, simplemente sigue
    }

    // Pase lo que pase, sigue con next()
    next();
};
