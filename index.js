require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const User = require('./models/User');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.static('./'));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));



// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://click-game-kappa.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});



// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    req.session.userId = user._id;
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    req.session.userId = user._id;
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.get('/api/auth/status', (req, res) => {
  if (req.session.userId) {
    User.findById(req.session.userId)
      .then(user => {
        res.json({
          authenticated: true,
          username: user.username
        });
      })
      .catch(error => {
        res.status(500).json({ error: error.message });
      });
  } else {
    res.json({
      authenticated: false,
      username: null
    });
  }
});

// Also add logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
    } else {
      res.json({ success: true });
    }
  });
});





// Guest routes
app.post('/api/guest/score', async (req, res) => {
  try {
    const { guestId } = req.body;
    
    if (!guestId) {
      return res.status(400).json({ error: 'Guest ID required' });
    }

    // Find or create temporary guest record
    let guestUser = await User.findOne({ 
      username: guestId,
      isGuest: true 
    });

    if (!guestUser) {
      guestUser = new User({
        username: guestId,
        password: 'guest', // Not used but required by schema
        isGuest: true,
        score: 0,
        chainDays: 0
      });
      await guestUser.save();
    }

    // Calculate points (similar to regular score endpoint)
    const now = new Date();
    
    if (guestUser.nextClickAvailable && now < guestUser.nextClickAvailable) {
      return res.status(400).json({ 
        error: 'Already clicked today',
        nextClickTime: guestUser.nextClickAvailable
      });
    }

    const basePoints = Math.floor(Math.random() * 10) + 1;
    let chainBonus = 0;
    
    const lastPlayedDate = guestUser.lastPlayed ? new Date(guestUser.lastPlayed) : null;
    const isYesterday = lastPlayedDate && 
      (now.getDate() - lastPlayedDate.getDate() === 1 ||
      (now.getDate() === 1 && lastPlayedDate.getMonth() !== now.getMonth()));
    
    if (isYesterday) {
      guestUser.chainDays += 1;
      chainBonus = Math.floor(basePoints * (guestUser.chainDays * 0.1));
    } else {
      guestUser.chainDays = 1;
    }

    const totalPoints = basePoints + chainBonus;
    
    guestUser.score += totalPoints;
    guestUser.lastPlayed = now;
    guestUser.nextClickAvailable = new Date(now.setHours(24,0,0,0));
    await guestUser.save();
    
    res.json({
      basePoints,
      chainBonus,
      totalPoints,
      totalScore: guestUser.score,
      chainDays: guestUser.chainDays,
      nextClickTime: guestUser.nextClickAvailable
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Game routes
app.post('/api/score', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  try {
    const user = await User.findById(req.session.userId);
    const now = new Date();
    
    if (user.nextClickAvailable && now < user.nextClickAvailable) {
      return res.status(400).json({ 
        error: 'Already clicked today', 
        nextClickTime: user.nextClickAvailable 
      });
    }

    const basePoints = Math.floor(Math.random() * 10) + 1;
    let chainBonus = 0;
    
    const lastPlayedDate = user.lastPlayed ? new Date(user.lastPlayed) : null;
    const isYesterday = lastPlayedDate && 
      (now.getDate() - lastPlayedDate.getDate() === 1 ||
      (now.getDate() === 1 && lastPlayedDate.getMonth() !== now.getMonth()));
    
   
   
      if (isYesterday) {
        // Increment chain, but reset after 7 days
        user.chainDays = (user.chainDays + 1) > 7 ? 1 : user.chainDays + 1;
        chainBonus = Math.floor(basePoints * (user.chainDays * 0.1)); // 10% bonus per chain day
  } else {
        user.chainDays = 1;
  }



    const totalPoints = basePoints + chainBonus;
    
    user.score += totalPoints;
    user.lastPlayed = now;
    user.nextClickAvailable = new Date(now.setHours(24,0,0,0));
    await user.save();
    
    res.json({
      basePoints,
      chainBonus,
      totalPoints,
      totalScore: user.score,
      chainDays: user.chainDays,
      nextClickTime: user.nextClickAvailable
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Leaderboard route
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find()
      .select('username score chainDays isGuest')
      .sort({ score: -1 })
      .limit(10);
    res.json(leaders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Account conversion route
app.post('/api/convert-guest', async (req, res) => {
  try {
    const { guestId, username, password } = req.body;
    
    // Find guest account
    const guestUser = await User.findOne({ 
      username: guestId,
      isGuest: true 
    });

    if (!guestUser) {
      return res.status(400).json({ error: 'Guest account not found' });
    }

    // Check if username is taken
    const existingUser = await User.findOne({ 
      username,
      isGuest: false 
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Convert guest to permanent account
    const hashedPassword = await bcrypt.hash(password, 10);
    guestUser.username = username;
    guestUser.password = hashedPassword;
    guestUser.isGuest = false;
    await guestUser.save();

    // Log in as new user
    req.session.userId = guestUser._id;
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});