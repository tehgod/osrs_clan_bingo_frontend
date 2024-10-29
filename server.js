const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

require('dotenv').config();

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

async function sendDiscordUpdate(webhookUrl, payload){
    
    await fetch(webhookUrl, {
            method: "POST",
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify(payload)
    })
    
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
app.post('/api/update-tile', async (req, res) => {
    var tile = req.body.selectedTile;
    var teamId = req.body.teamId;
    var imageUrls = JSON.parse(req.body.selectedTileUrlsValues || '[]');
    var completionStatus = req.body.selectedTileCompleted === 'on';
    // const imageUrls = Array.isArray(req.body.imageUrl) ? req.body.imageUrl : [req.body.imageUrl];
    var sql = `DELETE FROM CurrentLayoutUrls WHERE Team = ? AND Cell = ?`;
    var values = [teamId, tile];
    db.query(sql, values, (err, results) => {
        if (err) throw err;
    });

    for (const imageUrl of imageUrls) {
        console.log(imageUrl)
        var sql = `INSERT INTO CurrentLayoutUrls VALUES (?, ?, ?)`;
        var values = [teamId, tile, imageUrl];
        db.query(sql, values, (err, results) => {
            if (err) throw err;
        });
    }

    var inProgressTiles = await new Promise((resolve, reject) => {
        const sql = `SELECT cl.Cell, cl.Status, t.Task  from CurrentLayouts cl inner join Tasks t on cl.TaskId =t.Id where Status = 2 AND Team = ?`;
        var values = [teamId];
        db.query(sql, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

    var inProgressTilesRules = await new Promise((resolve, reject) => {
        var sql = 'SELECT cl.Cell, tr.Rule FROM CurrentLayouts cl INNER JOIN TasksRules tr ON cl.TaskId = tr.TasksId WHERE Team = ? AND Status!=0';
        var values = [teamId]
        db.query(sql, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

    const fields = inProgressTiles.map(tile => {
        // Find rules for the current tile's Cell
        const rulesForTile = inProgressTilesRules
            .filter(rule => rule.Cell === tile.Cell)
            .map(rule => `- ${rule.Rule}`) // Prefix each rule with a dash for readability
    
        // Format the rules into a single string for Discord
        const rulesText = rulesForTile.length > 0 ? rulesForTile.join('\n') : "No additional rules.";
    
        return {
            name: `----- ${tile.Task} -----`, // Bold and italic with invisible characters for centering
            value: rulesText, // Associated rules as the field value
            inline: false // Set inline to false for better layout
        };
    });
    
    // Define the parameters for the Discord embedded message
    const params = {
        username: "BingoBot",
        avatar_url: "", // Optional avatar URL for the bot
        content: "Current In-Progress Tasks and Rules",
        embeds: [
            {
                title: "In-Progress Tasks",
                color: 15258703,
                thumbnail: {
                    url: "" // Optional thumbnail URL
                },
                fields: fields // Attach the fields array we created
            }
        ]
    };

    sendDiscordUpdate(url, params)

    if (completionStatus) {
        const sql = `UPDATE CurrentLayouts SET Status = 1 WHERE Cell = ? and Team =?`;
        const values = [tile, teamId];
        db.query(sql, values, (err, results) => {
            if (err) throw err;
        });
    
        var inProgressTiles = getAdjacentCells(tile)
        
        inProgressTiles.forEach((inProgressTile) => {
            var sql = `UPDATE CurrentLayouts SET Status = 2 WHERE Status = 0 AND Cell = ? AND Team = ?`;
            var values = [inProgressTile, teamId];
            db.query(sql, values, (err, results) => {
                if (err) throw err;
            });
        });
    }


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
    const sql = 'SELECT bt.Cell, LOWER(ld.Name) AS Difficulty from BoardTemplate bt INNER JOIN LookupDifficulty ld on bt.Difficulty = ld.Id WHERE Template=?';
    const values = [templateId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getRules', (req, res) =>{
    var teamId = req.query.teamId;
    const sql = 'SELECT cl.Cell, tr.Rule FROM CurrentLayouts cl INNER JOIN TasksRules tr ON cl.TaskId = tr.TasksId WHERE Team = ? AND Status!=0';
    const values = [teamId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
})

app.get('/api/getCompleted', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT cl.Cell, cl.Status, t.Task  from CurrentLayouts cl inner join Tasks t on cl.TaskId =t.Id where (Status >0 or t.Difficulty =0) and Team = ?';
    const values = [teamId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/api/getUrls', (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT clu.Cell, clu.Url from CurrentLayoutUrls clu WHERE Team = ?';
    const values = [teamId]
    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
