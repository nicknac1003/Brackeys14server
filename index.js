const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto'); // Built-in Node.js module
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {

    res.send('Hello World!');
});

app.get('/auth/new', async (req, res) => {
    const headers = req.headers;
    const headerValidation = validateHeaders(headers);
    if (!headerValidation.valid) {
        return res.status(403).json({ error: headerValidation.error });
    }

    const userId = uuidv4();
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

function authenticate(req, res, next) {
    const headers = req.headers;
    
    // Validate headers first
    const headerValidation = validateHeaders(headers);
    if (!headerValidation.valid) {
        return res.status(403).json({ error: headerValidation.error });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;

        // Uncomment and configure HMAC verification if needed
        // const secret = Buffer.from(process.env.HMAC_SECRET, 'base64');
        // const hmac = crypto.createHmac('sha256', secret);
        // const signature = hmac.update(token + headers['x-timestamp']).digest('base64');

        // if (signature !== headers['x-signature']) {
        //     return res.status(403).json({ error: 'Invalid signature' });
        // }

        next();
    } catch (err) {
        console.error('Auth error:', err);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function validateHeaders(headers) {
    const requiredHeaders = ['x-client-type', 'x-game-client', 'x-timestamp', 'x-platform', 'x-signature'];
    for (const header of requiredHeaders) {
        if (!headers[header]) {
            return { valid: false, error: 'missing header: ' + header };
        }
    }
    if (headers['x-client-type'] !== 'unity-game') {
        return { valid: false, error: 'Invalid client type' };
    }
    if (headers['x-game-client'] !== 'bakerybattle') {
        return { valid: false, error: 'Invalid game client' };
    }

    const timestamp = parseInt(headers['x-timestamp']);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) { // 5 minute window
        return { valid: false, error: 'Request expired' };
    }
    
    return { valid: true };
}