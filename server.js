const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // for URL-encoded data
app.use(bodyParser.json());

app.use(session({
	secret: 'process.env.SESSION_STRING',
	resave: true,
	saveUninitialized: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static((path.join(__dirname, 'public')))); // Serve static files from 'public' directory

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

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: 3306,
    user: process.env.MYSQL_USERNAME,    // Database username
    password: process.env.MYSQL_PASSWORD,// Database password
    database: 'RunescapeBingo',// Database name
    waitForConnections: true, // Whether to wait for a free connection
    connectionLimit: 10,      // Maximum number of connections in the pool
    queueLimit: 0             // Maximum number of connection requests in queue
});

const poolPromise = pool.promise();

async function queryDatabase(sql, params) {
    try {
        const [rows, fields] = await poolPromise.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}


db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database!');
});

app.get('/', function(req, res) {
	// Render login template
	res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/auth', async function(req, res) {
	// Capture the input fields
	let username = req.body.username;
	let password = req.body.password;
	// Ensure the input fields exists and are not empty
	if (username && password) {
		// Execute SQL query that'll select the account from the database based on the specified username and password
        try {
            const results = await queryDatabase(
                'SELECT * FROM LoginAccounts WHERE username = ? AND password = ?',
                [username, password]
            );
            if (results.length > 0) {
                // Authenticate the user
                req.session.loggedin = true;
                req.session.username = username;
                // Redirect to home page
                res.redirect('/home');
            } else {
                res.send(`
                    <script>
                        alert('Username and password are incorrect!');
                        window.location.href = '/'; // Redirect to login page
                    </script>
                `);
            }
        } catch (error) {
            res.status(500).json({ message: 'Database error', error: error.message });
        }
    
    } else {
        response.send('Please enter Username and Password!');
        response.end();
    }
});

app.get('/home', function(req, res) {
    if (req.session.loggedin) {
		// Output username
        res.sendFile(path.join(path.join(__dirname, 'public', 'home.html')));
		// response.send('Welcome back, ' + request.session.username + '!');
	} else {
		// Not logged in
		res.send(`
                    <script>
                        alert('Please login to continue');
                        window.location.href = '/'; // Redirect to login page
                    </script>
                `);
	}
	// Render login template
	// 
});

// API endpoint to fetch data
app.post('/api/update-tile', async (req, res) => {
    var tile = req.body.selectedTile;
    var teamId = req.body.teamId;
    if ((!teamId) || (tile == "")) {
        return res.send(`
                    <script>
                        alert('Please select a tile, and try again.');
                        window.location.href = '/home'; // Redirect to login page
                    </script>
                `);
    }
    var imageUrls = JSON.parse(req.body.selectedTileUrlsValues || '[]');
    var completionStatus = ((req.body.selectedTileCompleted === 'on') && (req.session.approver==1))
    // const imageUrls = Array.isArray(req.body.imageUrl) ? req.body.imageUrl : [req.body.imageUrl];
    var sql = `DELETE FROM CurrentLayoutUrls WHERE Team = ? AND Cell = ?`;
    var values = [teamId, tile];
    try {
        await queryDatabase(sql, values)
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } 

    for (const imageUrl of imageUrls) {
        var sql = `INSERT INTO CurrentLayoutUrls(Team, Cell, Url) VALUES (?, ?, ?)`;
        var values = [teamId, tile, imageUrl];
        try {
            await queryDatabase(sql, values)
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    if (completionStatus) {
        var sql = `UPDATE CurrentLayouts SET Status = 1 WHERE Cell = ? and Team =?`;
        var values = [tile, teamId];
        try {
            await queryDatabase(sql, values)
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        } 
    
        var inProgressTiles = getAdjacentCells(tile)
        
        for (const inProgressTile of inProgressTiles) {
            var sql = `UPDATE CurrentLayouts SET Status = 2 WHERE Status = 0 AND Cell = ? AND Team = ?`;
            var values = [inProgressTile, teamId];
            try {
                await queryDatabase(sql, values);
            } catch (error) {
                console.error('Database query error:', error);
                throw error;
            } 
        }

        var sql = `SELECT cl.Cell, cl.Status, t.Task  from CurrentLayouts cl inner join Tasks t on cl.TaskId =t.Id where Status = 2 AND Team = ?`;
        var values = [teamId];
        try {
            var inProgressDiscordTiles = await queryDatabase(sql, values);
        } catch (error) {
            console.error('Database query error:', error);
            // Handle error appropriately, e.g., return a response or throw
        }
    
        var sql = 'SELECT cl.Cell, tr.Rule FROM CurrentLayouts cl INNER JOIN TasksRules tr ON cl.TaskId = tr.TasksId WHERE Team = ? AND Status!=0';
        var values = [teamId]
        try {
            var inProgressTilesRules = await queryDatabase(sql, values);
        } catch (error) {
            console.error('Database query error:', error);
            // Handle error appropriately, e.g., return a response or throw
        }

        const fields = inProgressDiscordTiles.map(tile => {
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

        await sendDiscordUpdate(req.session.discordUrl, params)
    }


    res.redirect('/home');
});

app.get('/api/getTemplateNumber', async (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT DISTINCT Template from CurrentLayouts cl where Team = ?';
    const values = [teamId]
    try {
        const results = await queryDatabase(sql, values)
        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getTemplate', async (req, res) => {
    var templateId = req.query.templateId;
    const sql = 'SELECT bt.Cell, LOWER(ld.Name) AS Difficulty from BoardTemplate bt INNER JOIN LookupDifficulty ld on bt.Difficulty = ld.Id WHERE Template=?';
    const values = [templateId]
    try {
        const results = await queryDatabase(sql, values)
        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getRules', async (req, res) =>{
    var teamId = req.query.teamId;
    const sql = 'SELECT cl.Cell, tr.Rule FROM CurrentLayouts cl INNER JOIN TasksRules tr ON cl.TaskId = tr.TasksId WHERE Team = ? AND Status!=0';
    const values = [teamId]
    try {
        const results = await queryDatabase(sql, values)
        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
})

app.get('/api/getCompleted', async (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT cl.Cell, cl.Status, t.Task  from CurrentLayouts cl inner join Tasks t on cl.TaskId =t.Id where (Status >0 or t.Difficulty =0) and Team = ?';
    const values = [teamId]
    try {
        const results = await queryDatabase(sql, values)
        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getUrls', async (req, res) => {
    var teamId = req.query.teamId;
    const sql = 'SELECT clu.Cell, clu.Url from CurrentLayoutUrls clu WHERE Team = ?';
    const values = [teamId]
    try {
        const results = await queryDatabase(sql, values)
        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/userInfo', async (req, res) => {
    username = req.session.username;
    const sql = 'SELECT la.Team, la.Approver, la.DiscordWebhook from LoginAccounts la WHERE username = ?';
    const values = [username]
    try {
        const results = await queryDatabase(sql, values)
        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/setSessionObjects', (req, res) => {
    req.session.approver = req.query.approver;
    req.session.discordUrl = req.query.discordUrl;
    res.json({})
})


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
