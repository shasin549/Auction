// script.js - Main entry point for the auction system
document.addEventListener("DOMContentLoaded", () => {
  const auctioneerBtn = document.getElementById("auctioneerBtn");
  const bidderBtn = document.getElementById("bidderBtn");

  // Initialize ripple effect for buttons
  function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];
    if (ripple) ripple.remove();

    button.appendChild(circle);
  }

  // Add hover effects
  function setupButtonHover(button) {
    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-2px)";
      button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
      button.style.transition = "all 0.2s ease";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0)";
      button.style.boxShadow = "none";
    });
  }

  // Navigation handlers
  function navigateTo(page) {
    // Add loading state
    document.body.classList.add("page-transition");
    
    setTimeout(() => {
      window.location.href = page;
    }, 300);
  }

  // Event listeners with error handling
  try {
    auctioneerBtn.addEventListener("click", (e) => {
      createRipple(e);
      setTimeout(() => navigateTo("auctioneer.html"), 300);
    });

    bidderBtn.addEventListener("click", (e) => {
      createRipple(e);
      setTimeout(() => navigateTo("bidder.html"), 300);
    });

    // Setup hover effects
    setupButtonHover(auctioneerBtn);
    setupButtonHover(bidderBtn);

    // Check if coming from a room link
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('room')) {
      const roomId = urlParams.get('room');
      sessionStorage.setItem('lastRoom', roomId);
      
      // Auto-navigate bidders if coming from room link
      if (window.location.pathname.endsWith("bidder.html")) {
        document.getElementById("roomId").value = roomId;
      }
    }

  } catch (error) {
    console.error("Initialization error:", error);
    // Fallback navigation if ripple effects fail
    auctioneerBtn.onclick = () => navigateTo("auctioneer.html");
    bidderBtn.onclick = () => navigateTo("bidder.html");
  }
});

// Add CSS for ripple effect dynamically
const style = document.createElement('style');
style.textContent = `
  .ripple {
    position: absolute;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.7);
    transform: scale(0);
    animation: ripple 600ms linear;
    pointer-events: none;
  }
  
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  .page-transition {
    animation: fadeOut 300ms ease forwards;
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);