document.addEventListener("DOMContentLoaded", () => {
  // Configure Socket.IO with multiple fallback options
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    secure: true,
    rejectUnauthorized: false
  });

  // Connection status elements
  const statusIndicator = document.createElement('div');
  statusIndicator.style.position = 'fixed';
  statusIndicator.style.bottom = '10px';
  statusIndicator.style.right = '10px';
  statusIndicator.style.padding = '8px 16px';
  statusIndicator.style.borderRadius = '20px';
  statusIndicator.style.zIndex = '1000';
  document.body.appendChild(statusIndicator);

  // Connection management
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    statusIndicator.textContent = 'Connected';
    statusIndicator.style.backgroundColor = '#10B981';
    document.getElementById("createRoomBtn").disabled = false;
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
    statusIndicator.textContent = 'Disconnected';
    statusIndicator.style.backgroundColor = '#EF4444';
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    statusIndicator.textContent = 'Connection Error';
    statusIndicator.style.backgroundColor = '#F59E0B';
    
    // Try reconnecting with different transport if WebSocket fails
    if (err.message.includes('websocket error')) {
      socket.io.opts.transports = ['polling', 'websocket'];
    }
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log(`Reconnection attempt ${attempt}`);
    statusIndicator.textContent = `Reconnecting (${attempt})...`;
    statusIndicator.style.backgroundColor = '#F59E0B';
  });

  // Rest of your auctioneer code...
  const createRoomBtn = document.getElementById("createRoomBtn");
  // ... (keep all your existing DOM elements and room creation logic)

  // Add ping/pong monitoring
  setInterval(() => {
    if (socket.connected) {
      socket.emit('ping', Date.now(), (startTime) => {
        const latency = Date.now() - startTime;
        console.log(`Latency: ${latency}ms`);
      });
    }
  }, 30000);
});