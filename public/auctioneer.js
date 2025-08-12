const socket = io();

const currentBidEl = document.getElementById('currentBid');
const currentWinnerEl = document.getElementById('currentWinner');
const newBidInput = document.getElementById('newBidAmount');
const placeBidBtn = document.getElementById('placeBidBtn');
const finalCallBtn = document.getElementById('finalCallBtn');
const nextPlayerBtn = document.getElementById('nextPlayerBtn');
const bidHistoryEl = document.getElementById('bidHistory');

const BID_INCREMENT = 10;

nextPlayerBtn.style.display = 'none';

function updateBidDisplay(data) {
  currentBidEl.textContent = data.currentBid;
  currentWinnerEl.textContent = data.currentWinner || 'None';

  const logEntry = document.createElement('div');
  logEntry.textContent = `₹${data.currentBid} by ${data.currentWinner}`;
  bidHistoryEl.appendChild(logEntry);
  bidHistoryEl.scrollTop = bidHistoryEl.scrollHeight;
}

function clearBidHistory() {
  bidHistoryEl.innerHTML = '';
}

placeBidBtn.addEventListener('click', () => {
  const bidValue = Number(newBidInput.value);

  if (isNaN(bidValue) || bidValue <= 0) {
    alert('Please enter a valid positive bid amount.');
    return;
  }

  if (bidValue % BID_INCREMENT !== 0) {
    alert(`Bid amount must be a multiple of ${BID_INCREMENT}.`);
    return;
  }

  socket.emit('placeBid', { amount: bidValue, user: 'Auctioneer' });
  newBidInput.value = '';
});

finalCallBtn.addEventListener('click', () => {
  finalCallBtn.disabled = true;
  nextPlayerBtn.style.display = 'inline-block';
  placeBidBtn.disabled = true;
  newBidInput.disabled = true;
  alert('Final Call! No more bids will be accepted until next player.');
});

nextPlayerBtn.addEventListener('click', () => {
  nextPlayerBtn.style.display = 'none';
  finalCallBtn.disabled = false;
  placeBidBtn.disabled = false;
  newBidInput.disabled = false;

  clearBidHistory();
  currentBidEl.textContent = '0';
  currentWinnerEl.textContent = 'None';

  socket.emit('nextPlayer');
});

socket.on('bidUpdate', (data) => {
  updateBidDisplay(data);
});

socket.on('bidRejected', (data) => {
  alert(data.reason || 'Bid rejected by server.');
});

socket.on('resetAuction', () => {
  clearBidHistory();
  currentBidEl.textContent = '0';
  currentWinnerEl.textContent = 'None';

  finalCallBtn.disabled = false;
  placeBidBtn.disabled = false;
  newBidInput.disabled = false;
  nextPlayerBtn.style.display = 'none';
});