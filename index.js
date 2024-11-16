const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static('./'));

// Update this line to use index.html instead of game.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});