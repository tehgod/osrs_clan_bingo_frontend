const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.MSSQL_HOST,
    port: parseInt(process.env.MSSQL_PORT) || 1433,
    user: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    database: 'Runescape',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect.then(() => {
    console.log('Connected to MSSQL Database!');
}).catch(err => {
    console.error('Database connection failed:', err);
});

module.exports = { pool, sql };