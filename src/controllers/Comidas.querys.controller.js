import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import { pool } from "../../db.js";
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const uploadQuerysData = async (req, res) => {
    console.log(req.file)
    console.log(req.body);
    const { name, description, price, categoria, user_id, comida_id, variantes, tipoControl, tamanio } = req.body;
    const tamanioValue = (tamanio === 'true' || tamanio === true) ? 1 : 0;
    try {
        let result;
        if (req.file) {
            if (!req.file.path) {
                throw new Error("Cloudinary no devolvió una URL válida");
            }
            //
            const type = req.file.mimetype;
            if (!type.startsWith('image/')) {
                return res.status(400).json({ message: "Solo se permiten imágenes" });
            }

            // UPDATE con imagen
            result = await pool.query(
                `UPDATE comidas SET name = ?, description = ?, image = ?, price = ?, categoria = ?, tipo_control, tamanio = ? WHERE id = ? AND user_id = ?`,
                [name, description, req.file.path, price, categoria,tipoControl, tamanioValue, comida_id, user_id]
            );
        } else {
            // UPDATE sin imagen
            result = await pool.query(
                `UPDATE comidas SET name = ?, description = ?, price = ?, categoria = ?, tipo_control, tamanio = ? WHERE id = ? AND user_id = ?`,
                [name, description, price, categoria, tipoControl, tamanioValue, comida_id, user_id]
            );
        }
        // ✅ Parsear variantes si vienen del formulario
        let variantesArray = [];
        if (variantes) {
            try {
                variantesArray = JSON.parse(variantes);
            } catch (err) {
                console.error("Error al parsear variantes:", err);
            }
        }

        // ✅ Guardar variantes y opciones
        if (Array.isArray(variantesArray) && variantesArray.length > 0) {
            // Primero eliminar las variantes existentes (limpieza)
            await pool.query("DELETE FROM opciones_variante WHERE variante_id IN (SELECT id FROM variantes WHERE comida_id = ?)", [comida_id]);
            await pool.query("DELETE FROM variantes WHERE comida_id = ?", [comida_id]);

            // Luego insertar nuevas variantes y opciones
            for (const variante of variantesArray) {
                const [varResult] = await pool.query(
                    "INSERT INTO variantes (comida_id, nombre, tipo, limite) VALUES (?, ?, ?, ?)",
                    [comida_id, variante.nombre, variante.tipo || "", variante.limite || null]
                );
                const varianteId = varResult.insertId;

                if (Array.isArray(variante.opciones)) {
                    for (const opcion of variante.opciones) {
                        await pool.query(
                            "INSERT INTO opciones_variante (variante_id, nombre, precio_adicional) VALUES (?, ?, ?)",
                            [varianteId, opcion.nombre, opcion.precio_adicional || 0]
                        );
                    }
                }
            }
        }
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

export const cargarQuerysData = async (req, res) => {
    console.log("Archivo recibido:", req.file);
    console.log(req.body);
    console.log("datos del usuario:", req.user);
    const { name, description, price, categoria, tipoControl, tamanio } = req.body;
    const tamanioValue = (tamanio === 'true' || tamanio === true) ? 1 : 0;
    if (!name || !categoria) {
        return res.status(400).json({
            status: "error",
            message: "faltan datos"
        });
    }

    try {
        let imageName = null;
        if (req.file) {
            const type = req.file.mimetype;
            if (!type.startsWith('image/')) {
                return res.status(400).json({ message: "Solo se permiten imágenes" });
            }
            imageName = req.file.path;
        }

        // Insertar comida
        const [result] = await pool.query(
            `INSERT INTO comidas (user_id, name, description, ${imageName ? 'image,' : ''} price, categoria, tipo_control, tamanio)
             VALUES (?, ?, ?, ${imageName ? '?,' : ''} ?, ?, ?, ?)`,
            imageName
                ? [req.user.id, name, description, imageName, price, categoria, tipoControl, tamanioValue]
                : [req.user.id, name, description, price, categoria, tipoControl, tamanioValue]
        );

        const comidaId = result.insertId;

        // Insertar variantes
        if (req.body.variantes) {
            let variantes;
            try {
                variantes = JSON.parse(req.body.variantes);
            } catch (error) {
                return res.status(400).json({ message: "Formato inválido de variantes" });
            }

            for (const variante of variantes) {
                const { nombre, tipo, limite } = variante;

                // 👇 Insertamos también el campo limite
                const [varianteResult] = await pool.query(
                    'INSERT INTO variantes (comida_id, nombre, tipo, limite) VALUES (?, ?, ?, ?)',
                    [comidaId, nombre, tipo || "", limite || null]
                );

                const varianteId = varianteResult.insertId;

                for (const opcion of variante.opciones) {
                    const { nombre, precio_adicional } = opcion;
                    await pool.query(
                        'INSERT INTO opciones_variante (variante_id, nombre, precio_adicional) VALUES (?, ?, ?)',
                        [varianteId, nombre, precio_adicional || 0]
                    );
                }
            }
        }

        return res.json({
            status: "ok",
            message: "Se guardó con éxito la información"
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: `error interno del servidor: ${error}`
        });
    }
};

export const destroyQuerysData = async (req, res) => {
    const { id } = req.params;
    try {

        // Verificar primero si existe el registro
        const [checkResult] = await pool.query("SELECT id FROM comidas WHERE id = ?", [id]);

        if (checkResult.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Comida no encontrada"
            });
        }

        //ELiminar registro
        const [response] = await pool.query("DELETE FROM comidas WHERE id = ?", [id]);
        if (response.affectedRows === 0) {
            return res.status(500).json({
                status: "error",
                message: "No se pudo eliminar la comida"
            });
        }

        return res.json({
            status: "success",
            message: "Comida eliminada correctamente"
        });
    } catch (error) {
        console.error("Error al eliminar comida:", error);
        return res.status(500).json({
            status: "error",
            message: "Error interno del servidor"
        });
    }
}


export const loadQuerysCategory = async (req, res) => {
    console.log("valor de req.body:", req.body);
    const category = req.body.category;
    console.log(category);
    try {
        const [rows] = await pool.query("SELECT name FROM comidas WHERE categoria = ?", [category]);
        return res.json({
            status: "ok",
            message: "solicitud exitosa",
            comidas: rows,
            login: true
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error interno del servidor"
        })
    }
}
