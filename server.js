const { checkSession } = require('./middleware/auth');
const { pool, sql } = require('./config/database');
const session = require('express-session');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static((path.join(__dirname, 'public'))));
app.use(session({
	secret: process.env.SESSION_STRING,
	resave: true,
	saveUninitialized: true
}));

function redirectToLogin(res) {
    res.send(`
        <script>
            alert('Please login to continue');
            window.location.href = '/'; // Redirect to login page
        </script>
    `);
    res.end();
}

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

// Mount API routes
app.use('/api', apiRoutes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
