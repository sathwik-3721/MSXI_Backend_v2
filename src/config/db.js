require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.DB_HOST, 
    database: process.env.DB_NAME, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    options: {
        encrypt: true, // SQL Azure requires encryption
        trustServerCertificate: false // Based on your configuration
    }
};

// Export the connection pool, ensuring that the pool is only created once
let poolPromise = sql.connect(config)
    .then(pool => {
        console.log('Connected to MSSQL');
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
        throw err;
    });

module.exports = poolPromise;
