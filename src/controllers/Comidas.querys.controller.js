import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import { pool } from "../../db.js";
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const uploadQuerysData = async (req, res) => {
    console.log(req.file)
    console.log(req.body);
    const { name, description, price, categoria, user_id, comida_id, guarnicion } = req.body;

    const guarnicionValue = guarnicion === "true" ? 1 : 0;
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
                `UPDATE comidas SET name = ?, description = ?, image = ?, price = ?, categoria = ?, guarnicion = ? WHERE id = ? AND user_id = ?`,
                [name, description, req.file.path, price, categoria, guarnicionValue, comida_id, user_id]
            );
        } else {
            // UPDATE sin imagen
            result = await pool.query(
                `UPDATE comidas SET name = ?, description = ?, price = ?, categoria = ?, guarnicion = ? WHERE id = ? AND user_id = ?`,
                [name, description, price, categoria, guarnicionValue, comida_id, user_id]
            );
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
    console.log("Archivo recibido:", req.file)
    console.log(req.body);
    console.log("datos del usuario:", req.user);
    const { name, description, price, categoria, guarnicion } = req.body;
    const guarnicionValue = guarnicion === "true" ? 1 : 0;

    if (!name || !description || !price || !categoria ) {
        return res.status(400).json({
            status: "error",
            message: "faltan datos"
        })
    }

    let result;
    
    if(req.file){
        const type = req.file.mimetype;
        if (!type.startsWith('image/')) {
            return res.status(400).json({ message: "Solo se permiten imágenes" });
        }

        try {
            // insert con imagen
            result = await pool.query(
                'INSERT INTO comidas (user_id , name, description, image, price, categoria, guarnicion) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, name, description, req.file.path, price, categoria, guarnicionValue]
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
    } else {
        try {
            // insert sin imagen
            result = await pool.query(
                'INSERT INTO comidas (user_id , name, description, price, categoria, guarnicion) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.id, name, description, price, categoria, guarnicionValue]
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
    console.log( "valor de req.body:", req.body);
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
