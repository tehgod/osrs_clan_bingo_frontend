const express = require('express');
const sql = require('mssql');
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

function checkSession(req, res, next) {
    if (req.session.loggedin) {
        return next();
    } else {
        return res.send(`
            <script>
                alert('Please login to continue');
                window.location.href = '/';
            </script>
        `);
    }
}

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

function redirectToLogin(res) {
    res.send(`
        <script>
            alert('Please login to continue');
            window.location.href = '/'; // Redirect to login page
        </script>
    `);
    res.end();
}

async function sendDiscordUpdate(webhookUrl, payload) {

    const maxFieldsPerMessage = 15;

    const allFields = payload.embeds[0].fields;

    const chunks = [];
    for (let i = 0; i < allFields.length; i += maxFieldsPerMessage) {
        chunks.push(allFields.slice(i, i + maxFieldsPerMessage));
    }

    for (const chunk of chunks) {

        const chunkPayload = {
            ...payload,
            embeds: [
                {
                    ...payload.embeds[0],
                    fields: chunk
                }
            ]
        };

        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    'Content-type': 'application/json'
                },
                body: JSON.stringify(chunkPayload)
            });

            if (!response.ok) {
                console.error('Error sending Discord update:', response.statusText);
            }

        } catch (error) {
            console.error('Error sending Discord update:', error);
        }
    }
}

const fixcdn = (urlString) => {
    const url = new URL(urlString);  // Create URL object from the string

    const exStr = url.searchParams.get('ex');
    const exTime = parseInt(exStr, 16) * 1000;

    // If expiration time is invalid or expired, return the CDN URL
    if (isNaN(exTime) || exTime <= Date.now()) {
        return 'https://fixcdn.hyonsu.com' + url.pathname;
    }

    // If no issues, return the original URL
    return url.href;
};

const config = {
    server: process.env.MSSQL_HOST,
    port: parseInt(process.env.MSSQL_PORT) || 1433,
    user: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    database: 'Runescape',
    options: {
        encrypt: true, // Use encryption
        trustServerCertificate: true, // For development; set to false in production with proper cert
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

app.get('/', function(req, res) {
	// Render login template
    if (req.session.loggedin && req.session.username) {
        res.redirect('/board');
    } else {
	    res.sendFile(path.join(__dirname, 'public', 'login/login.html'));
    }
});

app.post('/auth', async function(req, res) {
	// Capture the input fields
	let username = req.body.username;
	let password = req.body.password;
	// Ensure the input fields exists and are not empty
	if (username && password) {
		// Execute SQL query that'll select the account from the database based on the specified username and password
        let results;
        try {
            results = await pool.request()
                .input('username', sql.VarChar, username)
                .input('password', sql.VarChar, password)
                .query(`SELECT * FROM [Bingo].[Login] WHERE username = @username AND password = @password`);
        } catch (error) {
            return res.status(500).json({ message: 'Database error', error: error.message });
        }

        if (results.recordset.length > 0) {
            // Authenticate the user
            req.session.loggedin = true;
            req.session.username = username;
            // Redirect to board page
            res.redirect('/board');
        } else {
            res.send(`
                <script>
                    alert('Username and password are incorrect!');
                    window.location.href = '/'; // Redirect to login page
                </script>
            `);
        }

    } else {
        res.send('Please enter Username and Password!');
        res.end();
    }
});

app.get('/logout', function(req, res) {
    req.session.destroy((err) => {
        res.redirect('/') // will always fire after session is destroyed
      })
});

app.get('/board', checkSession, function(req, res) {
    if (req.session.loggedin && req.session.username) {
		// Output username
        res.sendFile(path.join(path.join(__dirname, 'public', 'board', 'board.html')));
	} else {
        redirectToLogin(res); 
	}
	// Render login template
	// 
});

app.get('/players', checkSession, function(req, res) {
    if (req.session.loggedin && req.session.username) {
        res.sendFile(path.join(__dirname, 'public', 'playerStats', 'playerStats.html'));
    }
    else {
		redirectToLogin(res);
	}
});

// API endpoint to fetch data
app.post('/api/update-tile', checkSession, async (req, res) => {
    var tile = req.body.selectedTile;
    var teamId = req.session.teamId;
    if ((!teamId) || (tile == "")) {
        return res.send(`
                    <script>
                        alert('Please select a tile, and try again.');
                        window.location.href = '/board'; // Redirect to login page
                    </script>
                `);
    }
    var imageUrls = JSON.parse(req.body.selectedTileUrlsValues || '[]');
    var completionStatus = (
        (req.body.selectedTileCompleted === 'on') 
        && (req.session.approver==1))
    // const imageUrls = Array.isArray(req.body.imageUrl) ? req.body.imageUrl : [req.body.imageUrl];
    try {
        await pool.request()
        .input('teamId', sql.Int, teamId)
        .input('tile', sql.VarChar, tile)
        .query(`DELETE FROM [Bingo].[LayoutUrl] WHERE Team = @teamId AND Cell = @tile`);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }

    for (const imageUrl of imageUrls) {
        newUrl = fixcdn(imageUrl);

        try {
            await pool.request()
            .input('teamId', sql.Int, teamId)
            .input('tile', sql.VarChar, tile)
            .input('newUrl', sql.VarChar, newUrl)
            .query(`INSERT INTO [Bingo].[LayoutUrl]
                    (
                        [Team],
                        [Cell],
                        [Url]
                    )
                    VALUES
                    (@teamId, @tile, @newUrl);`);
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    if (completionStatus) {

        try {
            await pool.request()
            .input('teamId', sql.Int, teamId)
            .input('tile', sql.VarChar, tile)
            .query(`UPDATE [Bingo].[Layout]
                    SET [Status] = 1
                    WHERE [Cell] = @tile
                        AND [Team] = @teamId;`);
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }

        var inProgressTiles = getAdjacentCells(tile)
        
        for (const inProgressTile of inProgressTiles) {

            try {
                await pool.request()
                .input('teamId', sql.Int, teamId)
                .input('inProgressTile', sql.VarChar, inProgressTile)
                .query(`UPDATE [Bingo].[Layout]
                        SET [Status] = 2
                        WHERE [Status] = 0
                            AND [Cell] = @inProgressTile
                            AND [Team] = @teamId;`);
            }
            catch (error) {
                console.error('Database query error:', error);
                throw error;
            }
        }

        let inProgressDiscordTiles;
        try {
            inProgressDiscordTiles = await pool.request()
            .input('teamId', sql.Int, teamId)
            .query(`SELECT [l].[Cell],
                        [l].[Status],
                        [t].[Task]
                    FROM [Bingo].[Layout] AS [l]
                        INNER JOIN [Bingo].[Task] AS [t]
                            ON [l].[TaskId] = [t].[Id]
                    WHERE [l].[Status] = 2
                        AND [l].[Team] = @teamId;`);
        }
        catch (error) {
            console.error('Database query error:', error);
            throw error;
        }

        let inProgressTilesRules;
        try {
            inProgressTilesRules = await pool.request()
            .input('teamId', sql.Int, teamId)
            .query(`SELECT [l].[Cell],
                        [tr].[Rule]
                    FROM [Bingo].[Layout] AS [l]
                        INNER JOIN [Bingo].[TaskRule] AS [tr]
                            ON [l].[TaskId] = [tr].[TaskId]
                    WHERE [l].[Team] = @teamId
                        AND [l].[Status] != 0;`);
        }
        catch (error) {
            console.error('Database query error:', error);
            throw error;
        }

        const fields = inProgressDiscordTiles.recordset.map(tile => {
            // Find rules for the current tile's Cell
            const rulesForTile = inProgressTilesRules.recordset
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

    res.redirect('/board');
});

app.get('/api/getTemplateNumber', checkSession, async (req, res) => {

    let results;
    try {
        results = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .query(`SELECT DISTINCT TemplateId from [Bingo].[Layout] cl where Team = @teamId`);
        res.json(results.recordset);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getTemplate', checkSession, async (req, res) => {

    let results;
    try {
        results = await pool.request()
            .input('templateId', sql.Int, req.query.templateId)
            .query(`SELECT bt.Cell, LOWER(ld.Name) AS Difficulty from [Bingo].[Template] bt INNER JOIN [Lookup].[BingoDifficulty] ld on bt.Difficulty = ld.Id WHERE Template= @templateId`);
        res.json(results.recordset);
    }
    catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getRules', checkSession, async (req, res) =>{

    let results;
    try {
        results = await pool.request()
        .input('teamId', sql.Int, req.session.teamId)
        .query(`SELECT [l].[Cell],
                    [tr].[Rule]
                FROM [Bingo].[Layout] AS [l]
                    INNER JOIN [Bingo].[TaskRule] AS [tr]
                        ON [l].[TaskId] = [tr].[TaskId]
                WHERE [l].[Team] = @teamId
                    AND [l].[Status] != 0;`);
        res.json(results.recordset);
    }
    catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
})

app.get('/api/getCompleted', checkSession, async (req, res) => {

    try {
        const results = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .query(`SELECT [l].[Cell],
                        [l].[Status],
                        [t].[Task]
                    FROM [Bingo].[Layout] AS [l]
                        INNER JOIN [Bingo].[Task] AS [t]
                            ON [l].[TaskId] = [t].[Id]
                    WHERE (
                            [l].[Status] > 0
                            OR [t].[Difficulty] = 0
                        )
                        AND [l].[Team] = @teamId;`);
        res.json(results.recordset);
    }
    catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getUrls', checkSession, async (req, res) => {

    try {
        let results;
        results = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .query(`SELECT clu.Cell, clu.Url from [Bingo].[LayoutUrl] clu WHERE Team = @teamId`);
        res.json(results.recordset);
    }
    catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/userInfo', checkSession, async (req, res) => {

    try {
        const results = await pool.request()
            .input('username', sql.VarChar, req.session.username)
            .query(`SELECT la.Team, la.Approver, la.DiscordWebhook from [Bingo].[Login] la WHERE username = @username`);
        req.session.approver = results.recordset[0].Approver;
        req.session.discordUrl = results.recordset[0].DiscordWebhook;
        req.session.teamId = results.recordset[0].Team;
        res.json(results.recordset);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getTeamMembers', checkSession, async (req, res) => {

    if (typeof req.session.teamId == 'undefined' || req.session.teamId == null){
        var usernames = []
        res.json(usernames);
    }

    try {
        const results = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .query(`SELECT tm.Username from TeamMembers tm WHERE tm.Team = @teamId`);
        const usernames = results.recordset.map(row => row.Username);
        res.json(usernames);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/getActivities', checkSession, async (req, res) => {

    try {
        var results = await pool.request()
            .query(`SELECT DISTINCT Activity from HighscoreData`);
        res.json(results.recordset);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/updatePlayerStats', checkSession, async (req, res) => {
    const username = req.query.username;
    let data;
    
    try {
        const response = await fetch(`https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${username}`);
        data = await response.json(); 
    } catch (error) {
        console.error(`Error fetching player stats:${req.query.username}`, error);
        return res.status(500).json({ error: 'Error fetching player stats' });
    }
    
    var sql = 'INSERT INTO HighscoreData (Username, Activity, Score, RecordType) VALUES ?';
    let values = [];

    for (const skill in data.skills) {
        const xp = data.skills[skill].xp === -1 ? null : data.skills[skill].xp;
        values.push([username, data.skills[skill].name, xp, "Current"]);
    }

    if (data.activities) {
        for (const activity in data.activities) {
            const score = data.activities[activity].score === -1 ? null : data.activities[activity].score;
            values.push([username, data.activities[activity].name, score, "Current"]);
        }
    }

    try {
 //       lol we cry, we have to do this soon

    } catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Database query failed' });
    }

    res.json({ message: 'Player stats updated successfully', data: values });
});

app.get('/api/getTeamActivityStats', checkSession, async (req, res) => {

    try {
        var result = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .input('activity', sql.VarChar, req.query.activity)
            .query(`SELECT hd.Username, hd.Score, hd.RecordType from HighscoreData hd inner join TeamMembers tm on hd.Username = tm.Username where tm.Team = @teamId and hd.Activity = @activity`);
        res.json(result.recordset);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.get('/api/setCurrentValues', checkSession, async (req, res) => {

    if (typeof req.session.teamId == 'undefined' || req.session.teamId == null){
        return res.json({ message: 'Error' });
    }

    try {
        await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .input('activity', sql.VarChar, req.query.activity)
            .query(`INSERT INTO HighscoreData (Username, Activity, Score, RecordType)
            SELECT hd.Username, hd.Activity, hd.Score, "Pinned" as RecordType
            FROM HighscoreData hd
            INNER JOIN TeamMembers tm ON hd.Username = tm.Username
            WHERE tm.Team = @teamId AND hd.Activity = @activity
            AND NOT EXISTS (
                SELECT 1
                FROM HighscoreData target
                WHERE target.Username = hd.Username
                AND target.Activity = hd.Activity
                AND target.RecordType = "Pinned"
            );`);
        res.json({ message: 'Current values set successfully' });
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
