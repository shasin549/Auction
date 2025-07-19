document.addEventListener("DOMContentLoaded", () => {
  // Initialize Supabase client
  const supabaseUrl = 'https://flwqvepusbjmgoovqvmi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd3F2ZXB1c2JqbWdvb3Zxdm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDY3MzMsImV4cCI6MjA2ODQ4MjczM30.or5cIl99nUDZceOKlFMnu8PCzLuCvXT5TBJvKTPSUvM';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
  });

  // [Previous DOM element declarations remain the same...]

  let userName = "";
  let roomId = "";
  let hasBid = false;
  let currentBidIncrement = 10;

  // [Previous connection status handlers remain the same...]

  // Join Room - Updated for Supabase
  joinBtn.addEventListener("click", async () => {
    userName = document.getElementById("bidderName").value.trim();
    roomId = document.getElementById("roomId").value.trim();

    if (!userName || !roomId) {
      alert("Please enter your name and room ID");
      return;
    }

    try {
      // First check if room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
        
      if (roomError || !room) {
        alert("Room not found");
        return;
      }

      socket.emit("join-room", { 
        roomId, 
        userName, 
        role: "bidder" 
      }, (response) => {
        if (response.success) {
          currentBidIncrement = response.bidIncrement || 10;
          bidIncrementValue.textContent = currentBidIncrement;
          joinSection.classList.add("hidden");
          auctionSection.classList.remove("hidden");
        } else {
          alert(response.message || "Failed to join room");
        }
      });
    } catch (err) {
      alert("Failed to join room");
      console.error(err);
    }
  });

  // [Rest of the file remains the same...]
});