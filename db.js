import mysql from 'mysql2/promise'
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
    host: process.env.DB_HOST,
     port: process.env.PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {                             // 👈 Obligatorio en Railway
    rejectUnauthorized: false
  },
  connectTimeout: 10000              // 👈 Aumenta timeout a 10s
});


const verifyconnection = async () => {
    let connection;

    try {
        connection = await pool.getConnection()
        console.log("Coneccion exitosa")
    } catch (error) {
        console.log("Error en coneccion", error);
    }finally{
        if(connection) connection.release();
    }
}

verifyconnection();