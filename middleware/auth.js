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

module.exports = { checkSession };