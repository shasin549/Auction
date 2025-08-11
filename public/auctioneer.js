const socket = io();

document.getElementById('createRoom').onclick = () => {
    const roomName = document.getElementById('roomName').value;
    const participants = parseInt(document.getElementById('participants').value);
    const increment = parseInt(document.getElementById('increment').value);

    socket.emit('createRoom', { roomName, participants, increment });
};

socket.on('roomCreated', ({ roomName }) => {
    document.getElementById('auctionPanel').style.display = 'block';
    document.getElementById('roomTitle').innerText = `Room: ${roomName}`;
    document.getElementById('inviteLink').innerText = window.location.origin + "/bidder.html?room=" + roomName;
});

document.getElementById('uploadPlayer').onclick = () => {
    const player = {
        name: document.getElementById('playerName').value,
        club: document.getElementById('playerClub').value,
        position: document.getElementById('playerPosition').value,
        style: document.getElementById('playerStyle').value,
        value: parseInt(document.getElementById('playerValue').value)
    };
    const roomCode = document.getElementById('roomTitle').innerText.split(": ")[1];
    socket.emit('uploadPlayer', { roomCode, player });
};

socket.on('playerUpdate', (player) => {
    document.getElementById('playerCard').innerHTML = `
        <strong>${player.name}</strong> - ${player.club} - ${player.position} - ${player.style} - $${player.value}
    `;
});

document.getElementById('finalCall').onclick = () => {
    const roomCode = document.getElementById('roomTitle').innerText.split(": ")[1];
    socket.emit('finalCall', { roomCode });
};

socket.on('callUpdate', (msg) => alert(msg));

socket.on('playerSold', (data) => {
    alert(`${data.player.name} SOLD to ${data.winner} for $${data.price}`);
});

socket.on('participantsUpdate', (list) => {
    document.getElementById('participantsList').innerHTML = list.map(p => `<li>${p.name}</li>`).join('');
});