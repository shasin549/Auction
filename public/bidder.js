document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // public/bidder.js

const socket = io();

const joinRoomBtn = document.getElementById("joinRoomBtn"); const roomIdInput = document.getElementById("roomId"); const bidderNameInput = document.getElementById("bidderName"); const auctionSection = document.getElementById("auctionSection");

const playerNameEl = document.getElementById("playerName"); const playerClubEl = document.getElementById("playerClub"); const playerPositionEl = document.getElementById("playerPosition"); const playerPriceEl = document.getElementById("playerPrice"); const liveBidEl = document.getElementById("liveBid"); const liveLeaderEl = document.getElementById("liveLeader");

const bidAmountInput = document.getElementById("bidAmount"); const placeBidBtn = document.getElementById("placeBidBtn");

const callInfo = document.getElementById("callInfo"); const callMessage = document.getElementById("callMessage"); const winnerAnnouncement = document.getElementById("winnerAnnouncement"); const winnerName = document.getElementById("winnerName"); const winningBid = document.getElementById("winningBid");

let roomId = null; let bidderName = null; let currentPlayerId = null; let highestBid = 0;

joinRoomBtn.addEventListener("click", () => { roomId = roomIdInput.value.trim(); bidderName = bidderNameInput.value.trim();

if (!roomId || !bidderName) return alert("Please enter Room ID and Name.");

socket.emit("join-room", { roomId, bidderName }); document.getElementById("joinSection").classList.add("hidden"); auctionSection.classList.remove("hidden"); });

socket.on("start-auction", (player) => { currentPlayerId = player.id; highestBid = player.starting_price;

playerNameEl.textContent = player.name; playerClubEl.textContent = player.club; playerPositionEl.textContent = player.position; playerPriceEl.textContent = player.starting_price; liveBidEl.textContent = player.starting_price; liveLeaderEl.textContent = "-";

winnerAnnouncement.classList.add("hidden"); callInfo.classList.add("hidden"); });

placeBidBtn.addEventListener("click", () => { const amount = parseInt(bidAmountInput.value); if (isNaN(amount) || amount <= highestBid) { return alert("Bid must be higher than current bid."); }

highestBid = amount; liveBidEl.textContent = amount; liveLeaderEl.textContent = bidderName;

socket.emit("place-bid", { roomId, playerId: currentPlayerId, amount, bidder: bidderName, }); });

socket.on("new-bid", ({ amount, bidder }) => { highestBid = amount; liveBidEl.textContent = amount; liveLeaderEl.textContent = bidder; });

socket.on("auction-ended", ({ winner, amount }) => { callInfo.classList.remove("hidden"); callMessage.textContent = "Final Call...";

setTimeout(() => { winnerAnnouncement.classList.remove("hidden"); winnerName.textContent = winner; winningBid.textContent = amount; }, 3000); });

