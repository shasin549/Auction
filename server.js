io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("createRoom", (data) => {
    console.log("Room created:", data.roomName);
    socket.join(data.roomName);
  });

  socket.on("joinRoom", ({ roomCode, participantName }) => {
    console.log(`${participantName} joined room ${roomCode}`);
    socket.join(roomCode);
  });

  socket.on("previewPlayer", (player) => {
    io.to(player.room).emit("playerPreview", player);
  });

  socket.on("startBidding", ({ room }) => {
    io.to(room).emit("updateBid", 0);
  });

  socket.on("placeBid", ({ roomCode, participantName, bidValue }) => {
    console.log(`${participantName} bid ${bidValue} in ${roomCode}`);
    io.to(roomCode).emit("updateBid", bidValue);
  });

  socket.on("finalCall", ({ room }) => {
    io.to(room).emit("finalCall");
  });
});