// script.js - Handles role selection and navigation

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const auctioneerBtn = document.getElementById("auctioneerBtn");
  const bidderBtn = document.getElementById("bidderBtn");
  
  // Initialize Socket.io connection
  const socket = io('https://auction-zfku.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  // Connection status indicators
  socket.on('connect', () => {
    console.log('Connected to auction server');
    [auctioneerBtn, bidderBtn].forEach(btn => btn.disabled = false);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from auction server');
    [auctioneerBtn, bidderBtn].forEach(btn => btn.disabled = true);
  });

  // Navigation handlers
  function navigateToAuctioneer() {
    try {
      // Track navigation in analytics if needed
      socket.emit('navigation-event', { destination: 'auctioneer' });
      
      // Open in same tab by default, or new tab if modifier key pressed
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        window.open("auctioneer.html", "_blank");
      } else {
        window.location.href = "auctioneer.html";
      }
    } catch (error) {
      console.error("Auctioneer navigation failed:", error);
      alert("Failed to open auctioneer panel. Please check your connection.");
    }
  }

  function navigateToBidder() {
    try {
      // Track navigation in analytics if needed
      socket.emit('navigation-event', { destination: 'bidder' });
      
      // Open in same tab by default, or new tab if modifier key pressed
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        window.open("bidder.html", "_blank");
      } else {
        window.location.href = "bidder.html";
      }
    } catch (error) {
      console.error("Bidder navigation failed:", error);
      alert("Failed to open bidder panel. Please check your connection.");
    }
  }

  // Event listeners with cross-platform support
  function addCrossPlatformListener(element, event, handler) {
    element.addEventListener(event, handler, { passive: false });
    
    // For touch devices
    if (event === 'click') {
      element.addEventListener('touchend', (e) => {
        e.preventDefault();
        handler(e);
      }, { passive: false });
    }
  }

  // Add event listeners
  addCrossPlatformListener(auctioneerBtn, 'click', navigateToAuctioneer);
  addCrossPlatformListener(bidderBtn, 'click', navigateToBidder);

  // Prevent default touch behavior to avoid delays
  [auctioneerBtn, bidderBtn].forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
  });

  // Disable buttons initially until connection is established
  [auctioneerBtn, bidderBtn].forEach(btn => btn.disabled = true);
});