const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' directory

const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: 3306,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: 'RunescapeBingo'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database!');
});

// API endpoint to fetch data
app.post('/api/complete-tile', (req, res) => {
    const sql = 'SELECT * FROM Users';
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getTemplateNumber', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT DISTINCT Template from CurrentLayouts cl where Team ='+teamId;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getTemplate', (req, res) => {
    var templateId = req.query.templateId;
    const sql = 'SELECT Cell, Difficulty from BoardTemplate bt where Template='+templateId;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getTemplate', (req, res) => {
    var templateId = req.query.templateId;
    const sql = 'SELECT Cell, Difficulty from BoardTemplate bt where Template='+templateId;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getCompleted', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT cl.Cell , t.Task  from CurrentLayouts cl inner join Tasks t on cl.TaskId =t.Id where (Status =1 or t.Difficulty =0) and Team = '+teamId;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
