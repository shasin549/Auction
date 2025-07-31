const express = require('express');
const path = require('path');
const cors = require('cors'); // Import the cors package

const app = express();
const PORT = process.env.PORT || 3000; // Use port 3000 or an environment variable

// Middleware
app.use(cors()); // Enable CORS for all origins (important for development, especially with client-side Supabase)
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded request bodies

// Serve static files from the 'public' directory
// This means requests to /index.html, /script.js, /styles.css, etc., will be served directly
app.use(express.static(path.join(__dirname, 'public')));

// Basic route for the root URL (e.g., http://localhost:3000/)
// This will implicitly serve 'index.html' from the 'public' directory because of `express.static`
// However, explicitly defining it ensures the root always serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// You can add other API routes here if needed for server-side logic
// For example:
/*
app.post('/api/some-data', (req, res) => {
    console.log('Received data:', req.body);
    res.json({ message: 'Data received successfully!' });
});
*/

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open your application at: http://localhost:${PORT}`);
});
