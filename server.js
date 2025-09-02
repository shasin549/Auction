const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store game rooms and their state
const rooms = {};

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // --- Room Creation & Joining ---
    socket.on('createRoom', ({ playerName, playerCount, imposterCount }) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, isHost: true }],
            settings: { playerCount, imposterCount },
            gameStarted: false,
            submittedWords: [],
            secretWord: '',
            imposters: [],
            votes: {},
            votedPlayersCount: 0
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('playerListUpdate', rooms[roomCode].players);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room && !room.gameStarted) {
            if (room.players.length < room.settings.playerCount) {
                room.players.push({ id: socket.id, name: playerName, isHost: false });
                socket.join(roomCode);
                io.to(roomCode).emit('playerListUpdate', room.players);
            } else {
                socket.emit('error', 'Room is full.');
            }
        } else {
            socket.emit('error', 'Room not found or game has started.');
        }
    });

    // --- Game Logic ---
    socket.on('startGame', () => {
        const roomCode = [...socket.rooms].find(room => room !== socket.id);
        const room = rooms[roomCode];
        if (room && room.players.length >= 3 && !room.gameStarted) {
            room.gameStarted = true;
            io.to(roomCode).emit('startWordInputPhase');
        } else {
            socket.emit('error', 'Not enough players to start the game.');
        }
    });

    socket.on('submitWord', (word) => {
        const roomCode = [...socket.rooms].find(room => room !== socket.id);
        const room = rooms[roomCode];
        if (room && room.gameStarted) {
            room.submittedWords.push({ id: socket.id, word });
            // Let everyone know a word has been submitted
            io.to(roomCode).emit('wordSubmitted', room.submittedWords.length);

            if (room.submittedWords.length === room.players.length) {
                // All words are in, start the game
                const allWords = room.submittedWords.map(p => p.word);
                const secretWord = allWords[Math.floor(Math.random() * allWords.length)];
                room.secretWord = secretWord;

                // Select imposters
                const playersToAssign = [...room.players];
                const imposters = playersToAssign
                    .sort(() => 0.5 - Math.random())
                    .slice(0, room.settings.imposterCount);
                room.imposters = imposters.map(p => p.id);

                room.players.forEach(player => {
                    const isImposter = room.imposters.includes(player.id);
                    io.to(player.id).emit('startDiscussionPhase', {
                        isImposter,
                        word: isImposter ? null : secretWord,
                        players: room.players.map(p => ({ id: p.id, name: p.name }))
                    });
                });
            }
        }
    });

    socket.on('vote', ({ votedPlayerId }) => {
        const roomCode = [...socket.rooms].find(room => room !== socket.id);
        const room = rooms[roomCode];
        if (room) {
            if (!room.votes[socket.id]) { // Check if the player has already voted
                room.votes[socket.id] = votedPlayerId;
                room.votedPlayersCount++;

                // Check if all players have voted
                if (room.votedPlayersCount === room.players.length) {
                    const voteTally = {};
                    for (const voterId in room.votes) {
                        const votedOnId = room.votes[voterId];
                        voteTally[votedOnId] = (voteTally[votedOnId] || 0) + 1;
                    }

                    let mostVotedPlayerId = null;
                    let maxVotes = 0;
                    for (const id in voteTally) {
                        if (voteTally[id] > maxVotes) {
                            maxVotes = voteTally[id];
                            mostVotedPlayerId = id;
                        }
                    }

                    const mostVotedPlayer = room.players.find(p => p.id === mostVotedPlayerId);
                    let resultMessage;
                    let crewmatesWin;

                    if (room.imposters.includes(mostVotedPlayerId)) {
                        resultMessage = `${mostVotedPlayer.name} was an imposter! Crewmates win!`;
                        crewmatesWin = true;
                    } else {
                        resultMessage = `${mostVotedPlayer.name} was a crewmate. The imposter was not caught! Imposters win!`;
                        crewmatesWin = false;
                    }

                    const finalRoles = room.players.map(p => ({
                        name: p.name,
                        isImposter: room.imposters.includes(p.id)
                    }));

                    io.to(roomCode).emit('gameOver', { message: resultMessage, roles: finalRoles, crewmatesWin });
                }
            }
        }
    });

    // --- Disconnection Handling ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                } else {
                    io.to(roomCode).emit('playerListUpdate', room.players);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});