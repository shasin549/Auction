const socket = io();

const currentBidEl = document.getElementById('currentBid');
const currentWinnerEl = document.getElementById('currentWinner');
const usernameInput = document.getElementById('username');
const bidAmountInput = document.getElementById('bidAmount');
const placeBidBtn = document.getElementById('placeBidBtn');
const messageEl = document.getElementById('message');

const BID_INCREMENT = 10;

placeBidBtn.addEventListener('click', () => {
  const user = usernameInput.value.trim();
  const amount = Number(bidAmountInput.value);
  messageEl.textContent = '';

  if (!user) {
    messageEl.textContent = 'Please enter your name.';
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    messageEl.textContent = 'Enter a valid bid amount.';
    return;
  }

  if (amount % BID_INCREMENT !== 0) {
    messageEl.textContent = `Bid amount must be a multiple of ${BID_INCREMENT}.`;
    return;
  }

  socket.emit('placeBid', { amount, user });
  bidAmountInput.value = '';
});

socket.on('bidUpdate', (data) => {
  currentBidEl.textContent = data.currentBid;
  currentWinnerEl.textContent = data.currentWinner || 'None';
  messageEl.textContent = '';
});

socket.on('bidRejected', (data) => {
  messageEl.textContent = data.reason || 'Bid rejected.';
});

socket.on('resetAuction', () => {
  currentBidEl.textContent = '0';
  currentWinnerEl.textContent = 'None';
  messageEl.textContent = '';
});