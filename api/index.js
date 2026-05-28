const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_RECEIVERS = ['Ellen Mancera', 'Shiely Dilangalen'];

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', receivers: DEFAULT_RECEIVERS });
});

app.get('/api/receivers', (req, res) => {
  res.json({ receivers: DEFAULT_RECEIVERS });
});

// Serve static files from public/
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// For SPA: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

module.exports = app;
