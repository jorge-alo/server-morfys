import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import { pool } from "../../db.js";
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer'; // Importación faltante


export const forgotPasswordQuerysData = async (req, res) => {
    const { email } = req.body;
    console.log(req.body);
    try {
        // 1. Verificar si el email existe
        const [user] = await pool.query("SELECT * FROM restaurant WHERE email = ?", [email]);
        if (user.length === 0) {
            return res.status(404).json({ message: "Email no registrado" });
        }

        // 2. Generar token de recuperación (válido por 1 hora)
        const token = jwt.sign({ email }, process.env.JWT_SECRETPASSWORD, { expiresIn: '1h' });

        // 3. Enviar email con enlace de recuperación
        const transporter = nodemailer.createTransport({
            service: 'gmail', // o tu SMTP
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_PASSWORD,
            to: email,
            subject: "Recuperación de contraseña",
            html: `
                <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
                <a href="${resetLink}">Restablecer contraseña</a>
                <p>El enlace expirará en 1 hora.</p>
            `,
        });

        res.json({ message: "Se envió un enlace de recuperación a tu email" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al procesar la solicitud" });
    }
};

export const resetPasswordQuerysData = async (req, res) => {
    const { token, newPassword } = req.body;
    console.log(req.body);
    try {
        // 1. Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRETPASSWORD);

        // 2. Hashear nueva contraseña
        const hashedPassword = await bcryptjs.hash(newPassword, 10);

        // 3. Actualizar en DB
        await pool.query("UPDATE restaurant SET password = ? WHERE email = ?", [
            hashedPassword,
            decoded.email
        ]);

        res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: "El enlace ha expirado" });
        }
        res.status(400).json({ message: "Token inválido" });
    }
};
export const registerQuerysData = async (req, res) => {


    if (!req.file) {
        return res.status(400).json({
            status: "error",
            message: "No se ha subido ninguna imagen"
        })
    }

    console.log(req.file);
    const type = req.file.mimetype;
    console.log(req.body);
    const { name, email, password, local, lat, lng, cel, domicilio } = req.body;

    if (!name || !email || !password || !local || !req.file) {
        return res.status(400).json({
            status: "error",
            message: "Faltan cargar datos"
        })
    }

    if (!type.startsWith('image/')) {
        return res.status(400).json({ message: "Solo se permiten imágenes" });
    }

    // Obtenemos la URL desde Cloudinary (gracias a multer-storage-cloudinary)
    const imageUrl = req.file.path; // esta es la URL pública

    const salt = await bcryptjs.genSalt(5);
    const hashPassword = await bcryptjs.hash(password, salt);

    try {
        if (!req.file.path) {
            throw new Error("No se recibió URL de Cloudinary");
        }
        const [row] = await pool.query("INSERT INTO restaurant (user_name, email, password, local, latitud, longitud, cel, domicilio, logo) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", [name, email, hashPassword, local, lat, lng, cel, domicilio, imageUrl])
        return res.json({
            status: "ok",
            message: "usuario registrado con exito"
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            status: "error",
            message: `Error en el servidor: ${error}`
        })
    }



}

export const registerActualizarQuerysData = async (req, res) => {
    try {
        const { name, email, password, local, lat, lng, cel, domicilio } = req.body;
        console.log(req.body);
        console.log("Este es el valor de domicilio", domicilio);
        if (!local) {
            return res.status(400).json({ message: "El campo 'local' es obligatorio" });
        }

        const [rows] = await pool.query("SELECT id FROM restaurant WHERE local = ?", [local]);
        if (rows.length === 0) {
            return res.status(400).json({ status: "error", message: "No se encontro el nombre del local" })
        }
        let imageUrl = null;
        if (req.file) {
            const type = req.file.mimetype;
            if (!type.startsWith('image/')) {
                return res.status(400).json({ message: "Solo se permiten imágenes" });
            }
            imageUrl = req.file.path;
            if (!imageUrl) {
                throw new Error("No se recibió URL de Cloudinary");
            }
        }

        let hashPassword;
        if (password) {
            const salt = await bcryptjs.genSalt(5);
            hashPassword = await bcryptjs.hash(password, salt);
        }
        const latitud = lat;
        const longitud = lng
        const user_name = name;
        const field = {
            user_name, email, latitud, longitud, cel, domicilio
        };
        if (hashPassword) field.password = hashPassword;

        const validFields = Object.entries(field).filter(([_, value]) => value !== "" && value !== undefined && value !== null);

        const setClause = validFields.map(([key]) => `${key} = ?`).join(', ');
        const values = validFields.map(([_, value]) => value);

        let finalQuery = '';
        let finalValues = [];

        if (imageUrl && validFields.length > 0) {
            finalQuery = `UPDATE restaurant SET ${setClause}, logo = ? WHERE local = ?`;
            finalValues = [...values, imageUrl, local];
        } else if (imageUrl && validFields.length === 0) {
            finalQuery = 'UPDATE restaurant SET logo = ? WHERE local = ?';
            finalValues = [imageUrl, local];
        } else if (!imageUrl && validFields.length > 0) {
            finalQuery = `UPDATE restaurant SET ${setClause} WHERE local = ?`;
            finalValues = [...values, local];
        } else {
            return res.status(400).json({ message: "No se proporcionaron datos válidos para actualizar" });
        }

        const result = await pool.query(finalQuery, finalValues);

        return res.json({
            status: "ok",
            message: "Se actualizo con éxito la información"
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: `Error interno del servidor: ${error.message}`
        });
    }
};
export const loginQuerysData = async (req, res) => {
    console.log("datos del req.body:", req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            status: "error",
            message: "Faltan cargar datos"
        })
    }

    try {
        const [row] = await pool.query("SELECT * FROM restaurant WHERE  user_name = ? AND  email = ?", [name, email])
        if (row.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "El usuario no esta logeado"
            })
        }

        const user = row[0];
        const hashChecked = await bcryptjs.compare(password, user.password);


        if (!hashChecked) {
            return res.status(400).json({
                status: "error",
                message: "El password es incorrecto"
            })
        }
        const token = jwt.sign({ user: user.user_name, id: user.id, local: user.local, auth: user.auth }, process.env.JWT_SECRETPASSWORD, { expiresIn: process.env.JWT_EXPIRES })
        const optionCookies = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        };

        res.cookie('jwt', token, optionCookies);
        return res.json({
            status: "ok",
            message: "Usuario logueado con exito",
            login: true,
            local: user.local,
            auth: user.auth
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            status: "error",
            message: `Error en el servidor: ${error}`
        })
    }
}

export const loadQuerysLocales = async (req, res) => {
    if (req.user) {
        try {

            const [rows] = await pool.query("SELECT local, img_vaner FROM restaurant");
            console.log(rows);
            return res.json({
                status: "ok",
                message: "Seleccion de locales exitosa",
                locales: rows,
                auth: req.user.auth
            })

        } catch (error) {
            return res.status(500).json({
                status: "error",
                message: `Error:${error}`
            })
        }
    } else {
        try {

            const [rows] = await pool.query("SELECT local, domicilio, logo, latitud, longitud, img_vaner, envio, envioMinimo, diaManianaEntrada, diaManianaSalida, horarioManianaEntrada, horarioManianaSalida, diaTardeEntrada, diaTardeSalida, horarioTardeEntrada, horarioTardeSalida, diaDifManianaEntrada, horarioDifManianaEntrada, horarioDifManianaSalida, diaDifTardeEntrada, horarioDifTardeEntrada, horarioDifTardeSalida FROM restaurant");
            console.log(rows);
            return res.json({
                status: "ok",
                message: "Seleccion de locales exitosa",
                locales: rows,
                login: false,
                auth: 0
            })

        } catch (error) {
            return res.status(500).json({
                status: "error",
                message: `Error:${error}`
            })
        }
    }



}

export const logoEnvioHorarioQuerysData = async (req, res) => {
    console.log(req.file)
    console.log(req.body);
    console.log("datos del usuario:", req.user);


    const { envio, cel, envioMinimo, diaManianaEntrada, diaManianaSalida, horarioManianaEntrada,
        horarioManianaSalida, diaTardeEntrada, diaTardeSalida,
        horarioTardeEntrada, horarioTardeSalida, diaDifManianaEntrada,
        horarioDifManianaEntrada, horarioDifManianaSalida, diaDifTardeEntrada,
        horarioDifTardeEntrada, horarioDifTardeSalida } = req.body;


    const field = {
        envio, cel, envioMinimo, diaManianaEntrada, diaManianaSalida, horarioManianaEntrada,
        horarioManianaSalida, diaTardeEntrada, diaTardeSalida,
        horarioTardeEntrada, horarioTardeSalida, diaDifManianaEntrada,
        horarioDifManianaEntrada, horarioDifManianaSalida, diaDifTardeEntrada,
        horarioDifTardeEntrada, horarioDifTardeSalida
    }
    // Filtramos campos con valor válido (que no estén vacíos)
    const validFields = Object.entries(field).filter(([key, value]) => value !== "" && value !== undefined && value !== null);



    // Creamos los fragmentos SET dinámicos y los valores
    const setClause = validFields.map(([key]) => `${key} = ?`).join(', ');
    const values = validFields.map(([_, value]) => value);

    console.log(values);
    console.log(setClause);


    if (req.file && validFields.length > 0) {
        const type = req.file.mimetype;
        if (!type.startsWith('image/')) {
            return res.status(400).json({ message: "Solo se permiten imágenes" });
        }
        try {
            if (!req.file.path) {
                throw new Error("No se recibió URL de Cloudinary");
            }
            // insert con imagen
            const result = await pool.query(
                `UPDATE restaurant SET ${setClause}, logo = ? WHERE id = ?`,
                [...values, req.file.path, req.user.id]
            );

            return res.json({
                status: "ok",
                message: "Se guardo con exito la informacion"
            })
        } catch (error) {
            return res.status(500).json({
                status: "error",
                message: `error interno del servidor: ${error}`
            })
        }
    } else if (req.file && validFields.length == 0) {
        try {
            console.log("valor de req.file dentro del if", req.file);
            if (!req.file.path) {
                throw new Error("No se recibió URL de Cloudinary");
            }
            const result = await pool.query(
                'UPDATE restaurant SET logo = ? WHERE id = ? ',
                [req.file.path, req.user.id]
            );

            return res.json({
                status: "ok",
                message: "Se guardo con exito la informacion"
            })
        } catch (error) {
            return res.status(500).json({
                status: "error",
                message: `error interno del servidor: ${error}`
            })
        }
    } else if (!req.file && validFields.length > 0) {
        try {
            // insert sin imagen
            const result = await pool.query(
                `UPDATE restaurant SET ${setClause} WHERE id = ?`,
                [...values, req.user.id]
            );

            return res.json({
                status: "ok",
                message: "Se guardo con exito la informacion"
            })
        } catch (error) {
            return res.status(500).json({
                status: "error",
                message: `error interno del servidor: ${error}`
            })
        }
    }
}

export const uploadQuerysBanner = async (req, res) => {

    const { user_id } = req.body;
    console.log("valor de reqFile", req.file);
    console.log("valor de userid:", user_id);
    try {
        if (!req.file.path) {
            throw new Error("Cloudinary no devolvió una URL válida");
        }
        const type = req.file.mimetype;


        if (!type.startsWith('image/')) {
            return res.status(400).json({ message: "Solo se permiten imágenes" });
        }

        // UPDATE con imagen
        const result = await pool.query(
            `UPDATE restaurant SET img_vaner = ? WHERE id = ?`,
            [req.file.path, user_id]
        );

        return res.json({
            status: "ok",
            message: "Se guardo con exito la informacion"
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: `error interno del servidor: ${error}`
        })
    }

}
export const getquerysImages = async (req, res) => {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    console.log("Nombre decodificado:", decodedName);
    console.log(name);

    try {
        const [idVaner] = await pool.query("SELECT id, img_vaner, cel, envio, envioMinimo, diaManianaEntrada, diaManianaSalida, horarioManianaEntrada, horarioManianaSalida, diaTardeEntrada, diaTardeSalida, horarioTardeEntrada, horarioTardeSalida, diaDifManianaEntrada, horarioDifManianaEntrada, horarioDifManianaSalida, diaDifTardeEntrada, horarioDifTardeEntrada, horarioDifTardeSalida FROM restaurant WHERE LOWER(local) = ?", [decodedName]);
        console.log("valor de idVaner", idVaner);

        if (!idVaner.length) {
            return res.status(404).json({
                status: "error",
                message: `No se encontró un restaurante con el nombre '${name}'`
            });
        }

        const [comidas] = await pool.query("SELECT id, user_id, name, description, image, price, categoria, guarnicion FROM comidas WHERE user_id = ?", [idVaner[0].id])

        res.json({
            status: "ok",
            message: "Se a ha seleccionado con exito",
            data: { idVaner, comidas },
            login: !!req.user
        })

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: `Error:${error}`
        })
    }
}




