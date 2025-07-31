const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { WebSocketServer } = require('ws'); 

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client for server-side if needed (optional for this setup, mostly client-side)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic API Route Example (most Supabase interactions will be client-side)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is healthy!' });
});

// Start the Express server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
});

// --- WebSocket Server (Optional: If you need custom real-time beyond Supabase Realtime) ---
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
    console.log('Client connected via WebSocket');
    ws.on('message', message => {
        console.log(`Received: ${message}`);
        ws.send(`You said: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected via WebSocket');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

function broadcastToClients(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

module.exports = app;
