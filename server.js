const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3012;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Trust proxy for Cloudflare
app.set('trust proxy', true);

// Routes
app.use('/api', require('./routes/tasks'));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from local network: http://[YOUR_LOCAL_IP]:${PORT}`);
});