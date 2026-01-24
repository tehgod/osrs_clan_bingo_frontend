const express = require('express');
const router = express.Router();
const { pool, sql } = require('../config/database');
const { checkSession } = require('../middleware/auth');
const { getAdjacentCells, fixcdn, sendDiscordUpdate } = require('../utils/helpers');

router.post('/update-tile', checkSession, async (req, res) => {
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

router.get('/getTemplateNumber', checkSession, async (req, res) => {

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

router.get('/getTemplate', checkSession, async (req, res) => {

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

router.get('/getRules', checkSession, async (req, res) =>{

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

router.get('/getCompleted', checkSession, async (req, res) => {

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

router.get('/getUrls', checkSession, async (req, res) => {

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

router.get('/userInfo', checkSession, async (req, res) => {

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

router.get('/getTeamMembers', checkSession, async (req, res) => {

    if (typeof req.session.teamId == 'undefined' || req.session.teamId == null){
        var usernames = []
        res.json(usernames);
    }

    try {
        const results = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .query(`SELECT [m].[Username]
                    FROM [Bingo].[Member] AS [m]
                    WHERE [m].[Team] = @teamId;`);
        const usernames = results.recordset.map(row => row.Username);
        res.json(usernames);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

router.get('/getActivities', checkSession, async (req, res) => {

    try {
        var results = await pool.request()
            .query(`SELECT DISTINCT
                        [d].[ActivityName]
                    FROM [Highscore].[Data] AS [d]
                    ORDER BY [d].[ActivityName];`);
        const activities = results.recordset.map(row => ({ Activity: row.ActivityName }));
        res.json(activities);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

router.get('/updatePlayerStats', checkSession, async (req, res) => {
    const username = req.query.username;
    let data;
    
    try {
        const response = await fetch(`https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${username}`);
        data = await response.json(); 
    } catch (error) {
        console.error(`Error fetching player stats:${req.query.username}`, error);
        return res.status(500).json({ error: 'Error fetching player stats' });
    }
    
    try {
        const table = new sql.Table('[Highscore].[Data]');
        
        // Explicitly create table object without the identity column
        table.create = true;
        
        table.columns.add('Username', sql.VarChar(12), { nullable: false });
        table.columns.add('Timestamp', sql.DateTime2, { nullable: false });
        table.columns.add('ActivityName', sql.VarChar(256), { nullable: false });
        table.columns.add('Rank', sql.Int, { nullable: true });
        table.columns.add('Score', sql.Int, { nullable: true });
        table.columns.add('Level', sql.Int, { nullable: true });
        table.columns.add('Xp', sql.Int, { nullable: true });
        
        const now = new Date();

        for (const skill in data.skills) {
            if (data.skills[skill].rank === -1) {
                table.rows.add(
                    username,
                    now,
                    data.skills[skill].name,
                    null,
                    null,
                    null,
                    null
                );
            } else {
                table.rows.add(
                    username,
                    now,
                    data.skills[skill].name,
                    data.skills[skill].rank,
                    null,
                    data.skills[skill].level,
                    data.skills[skill].xp
                );
            }
        }

        for (const activity in data.activities) {
            if (data.activities[activity].rank === -1) {
                table.rows.add(
                    username,
                    now,
                    data.activities[activity].name,
                    null,
                    null,
                    null,
                    null
                );
            } else {
                table.rows.add(
                    username,
                    now,
                    data.activities[activity].name,
                    data.activities[activity].rank,
                    data.activities[activity].score,
                    null,
                    null
                );
            }
        }
        
        await pool.request().bulk(table);

    } catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Database query failed' });
    }

    res.json({ message: 'Player stats updated successfully'});
});

router.get('/getPinnedStatus', checkSession, async (req, res) => {

    if (typeof req.session.teamId == 'undefined' || req.session.teamId == null){
        return res.json(false);
    }
    try {
        var results = await pool.request()
            .input('activityName', sql.VarChar, req.query.activity)
            .input('teamId', sql.Int, req.session.teamId)
            .execute('[Bingo].[GetPinnedStatus]');
        
        const pinnedStatus = results.recordset[0][''] === 1;
        res.json(pinnedStatus);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

router.get('/getTeamActivityStats', checkSession, async (req, res) => {

    try {
        var result = await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .input('activityName', sql.VarChar, req.query.activity)
            .execute('[Bingo].[GetTeamStats]');
        res.json(result.recordset);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

router.get('/setCurrentValues', checkSession, async (req, res) => {

    if (typeof req.session.teamId == 'undefined' || req.session.teamId == null){
        return res.json({ message: 'Error' });
    }

    try {
        await pool.request()
            .input('teamId', sql.Int, req.session.teamId)
            .input('activityName', sql.VarChar, req.query.activity)
            .execute(`[Bingo].[SetPinnedValues]`);
        res.json({ message: 'Current values set successfully' });
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
});

module.exports = router;