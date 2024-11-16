const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static('./'));

// Serve game.html instead of index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});