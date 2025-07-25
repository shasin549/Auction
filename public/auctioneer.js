// auctioneer.js (100% fixed and working)
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = createClient(
    'https://flwqvepusbjmgoovqvmi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM'
  );

const socket = io();

const createRoomBtn = document.getElementById("createRoomBtn"); const roomNameInput = document.getElementById("roomName"); const roomIdDisplay = document.getElementById("roomIdDisplay"); const inviteLink = document.getElementById("inviteLink"); const copyLinkBtn = document.getElementById("copyLinkBtn"); const roomInfo = document.getElementById("roomInfo"); const participantCount = document.getElementById("participantCount"); const playerForm = document.getElementById("playerForm"); const preview = { name: document.getElementById("previewName"), club: document.getElementById("previewClub"), position: document.getElementById("previewPosition"), price: document.getElementById("previewPrice"), bid: document.getElementById("currentBid"), bidder: document.getElementById("leadingBidder"), }; const finalCallBtn = document.getElementById("finalCallBtn"); const nextPlayerBtn = document.getElementById("nextPlayerBtn");

let roomId = null; let currentPlayerId = null; let highestBid = 0; let highestBidder = "-";

createRoomBtn.addEventListener("click", async () => { const roomName = roomNameInput.value.trim(); if (!roomName) return alert("Please enter a room name.");

const { data, error } = await supabase .from("rooms") .insert([{ name: roomName }]) .select() .single();

if (error) { console.error("❌ Failed to create room:", error.message); alert("Room creation failed."); return; }

roomId = data.id; roomIdDisplay.textContent = roomId; inviteLink.textContent = ${location.origin}/bidder.html?room=${roomId}; inviteLink.href = ${location.origin}/bidder.html?room=${roomId}; roomInfo.classList.remove("hidden"); playerForm.classList.remove("hidden");

socket.emit("create-room", { roomId, roomName }); });

socket.on("participant-count", (count) => { participantCount.textContent = count; });

document.getElementById("startAuctionBtn").addEventListener("click", async () => { const name = document.getElementById("playerName").value.trim(); const club = document.getElementById("playerClub").value.trim(); const position = document.getElementById("playerPosition").value.trim(); const startingPrice = parseInt(document.getElementById("startingPrice").value);

if (!name || !club || !position || isNaN(startingPrice)) { return alert("Please fill all player fields correctly."); }

const { data, error } = await supabase .from("players") .insert([{ name, club, position, starting_price: startingPrice, room_id: roomId }]) .select() .single();

if (error) { console.error("❌ Failed to add player:", error.message); return; }

currentPlayerId = data.id; highestBid = startingPrice; highestBidder = "-";

preview.name.textContent = name; preview.club.textContent = club; preview.position.textContent = position; preview.price.textContent = ₹${startingPrice}; preview.bid.textContent = ₹${startingPrice}; preview.bidder.textContent = "-";

document.getElementById("playerPreview").classList.remove("hidden"); finalCallBtn.classList.remove("hidden"); nextPlayerBtn.classList.add("hidden");

socket.emit("start-auction", { roomId, player: { id: currentPlayerId, name, club, position, starting_price: startingPrice, }, }); });

socket.on("new-bid", ({ amount, bidder }) => { highestBid = amount; highestBidder = bidder; preview.bid.textContent = ₹${amount}; preview.bidder.textContent = bidder; });

finalCallBtn.addEventListener("click", async () => { const audio = new Audio("audio/final-call.mp3"); audio.play();

setTimeout(async () => { finalCallBtn.classList.add("hidden"); nextPlayerBtn.classList.remove("hidden");

if (!currentPlayerId || !roomId || highestBid === 0) return;

const { error } = await supabase.from("winners").insert([
  {
    player_id: currentPlayerId,
    room_id: roomId,
    winner_name: highestBidder,
    winning_bid: highestBid,
  },
]);

if (error) {
  console.error("❌ Failed to save winner:", error.message);
}

socket.emit("auction-ended", {
  roomId,
  playerId: currentPlayerId,
  winner: highestBidder,
  amount: highestBid,
});

}, 3000); });

nextPlayerBtn.addEventListener("click", () => { document.getElementById("playerPreview").classList.add("hidden"); document.getElementById("playerForm").reset(); finalCallBtn.classList.add("hidden"); nextPlayerBtn.classList.add("hidden"); });

