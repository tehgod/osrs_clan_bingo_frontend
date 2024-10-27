const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer')
const path = require('path')
const axios = require('axios')
const fs = require('fs'); // Import the fs module

require('dotenv').config();

const storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, __dirname + "/uploads");
    },
    filename: function (req, file, callback) {
        const completedTile = req.body.tile;
        const teamId = req.body.teamId;
        if (!req.fileCounter) req.fileCounter = 1; 
        const extension = path.extname(file.originalname)
        const newFileName = `Team${teamId}_${completedTile}_${req.fileCounter}${extension}`;
        req.fileCounter++; 
        callback(null, newFileName);
    }
})

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit as an example
});


const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // for URL-encoded data
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' directory

function getAdjacentCells(cell) {
    var regex = /^([a-zA-Z]+)(\d+)$/;
    var match = cell.match(regex);

    if (!match) {
        throw new Error('Invalid cell format');
    }

    const column = match[1].toUpperCase(); // Convert to uppercase for calculations
    const row = parseInt(match[2], 10); // Row number

    // Create an array of adjacent cells in lowercase
    const adjacentCells = [
        `${column}${row - 1}`.toLowerCase(), // Cell above
        `${column}${row + 1}`.toLowerCase(), // Cell below
        `${String.fromCharCode(column.charCodeAt(0) - 1)}${row}`.toLowerCase(), // Cell to the left
        `${String.fromCharCode(column.charCodeAt(0) + 1)}${row}`.toLowerCase()  // Cell to the right
    ];

    return adjacentCells;
}

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
app.post('/api/complete-tile', upload.array('img'), async (req, res) => {
    var completedTile = req.body.tile;
    var teamId = req.body.teamId;
    const imageUrls = Array.isArray(req.body.imageUrl) ? req.body.imageUrl : [req.body.imageUrl];
    var img_num =1
    for (const imageUrl of imageUrls) {
        var img_num
        if (imageUrl) {
            try {
                console.log('Downloading Image URL:', imageUrl); // Log each image URL

                // Download the image and save it
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

                // Create a unique filename for the downloaded image
                const imageFileName = `Team${teamId}_${completedTile}_${img_num}.png`;
                const imagePath = path.join(__dirname, 'uploads', imageFileName);

                // Write the image to the filesystem
                fs.writeFileSync(imagePath, response.data);
                img_num++;
            }
            catch (error) {
                console.error('Error downloading image:', error.message);
            }
        }
    }
    var inProgressTiles = getAdjacentCells(completedTile)
    const sql = `UPDATE CurrentLayouts SET Status = 1 WHERE Cell = ? and Team =?`;
    const values = [completedTile, teamId];
    db.query(sql, values, (err, results) => {
        if (err) throw err;
    });
    inProgressTiles.forEach((inProgressTile) => {
        var sql = `UPDATE CurrentLayouts SET Status = 2 WHERE Cell = ? and Team = ?`;
        var values = [inProgressTile, teamId];
        db.query(sql, values, (err, results) => {
            if (err) throw err;
        });
    });
    res.redirect('/');
});

app.get('/api/getTemplateNumber', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT DISTINCT Template from CurrentLayouts cl where Team = ?';
    const values = [teamId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getTemplate', (req, res) => {
    var templateId = req.query.templateId;
    const sql = 'SELECT Cell, Difficulty from BoardTemplate bt where Template=?';
    const values = [templateId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getCompleted', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT cl.Cell, cl.Status, t.Task  from CurrentLayouts cl inner join Tasks t on cl.TaskId =t.Id where (Status >0 or t.Difficulty =0) and Team = ?';
    const values = [teamId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getTeamMembers', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT Username  FROM TeamMembers tm WHERE Team = ?';
    const values = [teamId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
