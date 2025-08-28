import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createUser, savePlayer, getRandomPlayer } from './database.js';

dotenv.config();

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

app.post('/auth/new', async (req, res) => {
    const headers = req.headers;
    const headerValidation = validateHeaders(headers);
    if (!headerValidation.valid) {
        return res.status(403).json({ error: headerValidation.error });
    }

    const {name, characterId} = req.body;
    console.log('Creating user:', { name, characterId });
    try{
        if (!name || characterId === null || characterId === undefined) {
            return res.status(400).json({ error: 'Name and Character ID are required' });
        }
    }catch(err){
        return res.status(400).json({ error: 'Invalid request body' });
    }

    const userId = uuidv4();
    let client;
    try{
        client = await pool.connect();

        await createUser(client, userId, name, characterId);

        const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token });
    }catch(err){
        console.error('Error creating user:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }finally{
        if (client) {
            client.release();
        }
    }


});


app.post('/player/save', authenticate, async (req, res) => {
    const { userId } = req;
    const { health, inventory, round } = req.body;

    if (!health || !inventory || !round) {
        return res.status(400).json({ error: 'missing required fields' });
    }

    let client;
    try{
        client = await pool.connect();
        await savePlayer(client, userId, health, inventory, round);
        return res.status(200).json({ message: 'Player saved successfully' });
    }catch(err){
        console.error('Error saving player:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }finally{
        if (client) {
            client.release();
        }
    }
});

app.get('/player/random', authenticate, async (req, res) => {
    const { round } = req.query;
    const { userId } = req;
    
    let client;
    try{
        client = await pool.connect();
        const result = await getRandomPlayer(client, userId, round);
        return res.status(200).json(result);
    }catch(err){
        console.error('Error fetching player:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }finally{
        if (client) {
            client.release();
        }
    }
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


        const secret = Buffer.from(process.env.HMAC_SECRET, 'base64');
        const hmac = crypto.createHmac('sha256', secret);
        const signature = hmac.update(token + headers['x-timestamp']).digest('base64');

        if (signature !== headers['x-signature']) {
            return res.status(403).json({ error: 'Invalid signature' });
        }

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