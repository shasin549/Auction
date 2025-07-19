document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase client
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  // [Previous DOM element declarations remain the same...]

  let roomId = "";
  let currentPlayer = null;
  let currentAuctionId = null;

  // [Previous connection handling remains the same...]

  // Create Room Button Handler - Updated for Supabase
  createRoomBtn.addEventListener("click", async () => {
    const roomName = roomNameInput.value.trim();
    const bidIncrement = parseInt(bidIncrementInput.value);

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Creating...";
    createRoomBtn.classList.add("btn-processing");

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([
          { 
            name: roomName,
            bid_increment: bidIncrement
          }
        ])
        .select();
        
      if (error) throw error;

      roomId = data[0].id;
      
      socket.emit("join-room", { 
        roomId,
        userName: "Auctioneer",
        role: "auctioneer"
      }, (joinResponse) => {
        if (joinResponse?.success) {
          roomIdDisplay.textContent = roomId;
          inviteLink.textContent = `${window.location.origin}/bidder.html?room=${roomId}`;
          inviteLink.href = `${window.location.origin}/bidder.html?room=${roomId}`;
          roomInfo.classList.remove("hidden");
          playerForm.classList.remove("hidden");
          createRoomBtn.textContent = "Room Created";
          createRoomBtn.classList.remove("btn-processing");

          inviteLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(inviteLink.textContent)
              .then(() => alert("Invite link copied to clipboard!"))
              .catch(() => alert("Failed to copy link"));
          });
        } else {
          handleError(joinResponse?.message || "Failed to join room");
        }
      });
    } catch (err) {
      handleError("Failed to create room");
      console.error(err);
    }
  });

  // Start Auction Button Handler - Updated for Supabase
  startAuctionBtn.addEventListener("click", async () => {
    const playerName = playerNameInput.value.trim();
    const playerClub = playerClubInput.value.trim();
    const playerPosition = playerPositionInput.value.trim();
    const startingPrice = parseInt(startingPriceInput.value);

    if (!playerName || !playerClub || !playerPosition || isNaN(startingPrice)) {
      alert("Please fill all player fields correctly");
      return;
    }

    currentPlayer = {
      playerName,
      playerClub,
      playerPosition,
      startingPrice
    };

    updatePlayerPreview(currentPlayer);
    playerPreview.classList.remove("hidden");
    startAuctionBtn.disabled = true;
    finalCallBtn.classList.remove("hidden");
    finalCallBtn.textContent = "Final Call!";
    finalCallBtn.className = "btn btn-warning";
    finalCallBtn.disabled = false;

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([
          {
            room_id: roomId,
            name: playerName,
            club: playerClub,
            position: playerPosition,
            starting_price: startingPrice
          }
        ])
        .select();
        
      if (error) throw error;

      currentAuctionId = data[0].id;
      
      socket.emit("start-auction", currentPlayer, (response) => {
        if (!response?.success) {
          alert(response?.message || "Failed to start auction");
          startAuctionBtn.disabled = false;
          finalCallBtn.classList.add("hidden");
          finalCallBtn.disabled = true;
        }
      });
    } catch (err) {
      alert("Failed to start auction");
      console.error(err);
      startAuctionBtn.disabled = false;
      finalCallBtn.classList.add("hidden");
      finalCallBtn.disabled = true;
    }
  });

  // Final Call Button Handler - Updated for Supabase
  finalCallBtn.addEventListener("click", () => {
    if (!roomId) {
      alert("Please create a room and start an auction first");
      return;
    }

    finalCallBtn.disabled = true;
    finalCallBtn.innerHTML = '<span class="spinner"></span> Processing...';

    // Track call count in the UI
    let callCount = 1;
    
    const processCall = () => {
      socket.emit("final-call", { roomId, callCount }, (response) => {
        if (response?.success) {
          if (callCount < 3) {
            callCount++;
            setTimeout(processCall, 2000); // Wait 2 seconds between calls
          } else {
            finalCallBtn.disabled = true;
            nextPlayerBtn.classList.remove("hidden");
          }
        } else {
          alert(response?.message || "Failed to process final call");
          finalCallBtn.disabled = false;
          finalCallBtn.textContent = "Final Call!";
        }
      });
    };
    
    processCall();
  });

  // [Rest of the file remains the same...]

  // Updated showParticipantWins function
  async function showParticipantWins(participantName) {
    try {
      const { data, error } = await supabase
        .from('winners')
        .select(`
          winning_bid,
          players:player_id (name)
        `)
        .eq('winner_name', participantName);
        
      if (error) throw error;

      modalParticipantName.textContent = participantName;
      wonPlayersList.innerHTML = '';

      if (data && data.length > 0) {
        data.forEach(win => {
          const wonPlayerElement = document.createElement('div');
          wonPlayerElement.className = 'won-player-item';
          wonPlayerElement.innerHTML = `
            <span>${win.players.name}</span>
            <span>₹${win.winning_bid}M</span>
          `;
          wonPlayersList.appendChild(wonPlayerElement);
        });
      } else {
        wonPlayersList.innerHTML = '<p>No players won yet</p>';
      }

      participantModal.classList.add('show');
    } catch (err) {
      alert("Failed to get participant wins");
      console.error(err);
    }
  }

  // [Rest of the helper functions remain the same...]
});