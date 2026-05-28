const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', receivers: ['Ellen Mancera', 'Shiely Dilangalen'] });
});

app.get('/api/receivers', (req, res) => {
    res.json({ receivers: ['Ellen Mancera', 'Shiely Dilangalen'] });
});

module.exports = app;
