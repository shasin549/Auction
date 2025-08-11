const socket = io();
let myName = "";

document.getElementById('joinRoom').onclick = () => {
    myName = document.getElementById('participantName').value;
    const roomCode = document.getElementById('roomCode').value;
    socket.emit('joinRoom', { roomCode, participantName: myName });
    document.getElementById('biddingPanel').style.display = 'block';
};

socket.on('playerUpdate', (player) => {
    document.getElementById('playerCard').innerHTML = `
        <strong>${player.name}</strong> - ${player.club} - ${player.position} - ${player.style} - $${player.value}
    `;
    document.getElementById('highestBid').innerText = player.value;
    document.getElementById('highestBidder').innerText = "None";
});

document.getElementById('placeBid').onclick = () => {
    const roomCode = document.getElementById('roomCode').value;
    socket.emit('placeBid', { roomCode, bidderName: myName });
};

socket.on('bidUpdate', ({ highestBid, highestBidder }) => {
    document.getElementById('highestBid').innerText = highestBid;
    document.getElementById('highestBidder').innerText = highestBidder;
});

socket.on('playerSold', (data) => {
    if (data.winner === myName) {
        let li = document.createElement('li');
        li.innerText = `${data.player.name} - $${data.price}`;
        document.getElementById('myWins').appendChild(li);
    }
});