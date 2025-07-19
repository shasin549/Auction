document.addEventListener("DOMContentLoaded", () => {
  const auctioneerBtn = document.getElementById("auctioneerBtn");
  const bidderBtn = document.getElementById("bidderBtn");

  // Add ripple effect to buttons
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
    if (ripple) {
      ripple.remove();
    }

    button.appendChild(circle);
  }

  // Add event listeners with ripple effect
  auctioneerBtn.addEventListener("click", function(e) {
    createRipple(e);
    setTimeout(() => {
      window.location.href = "auctioneer.html";
    }, 300);
  });

  bidderBtn.addEventListener("click", function(e) {
    createRipple(e);
    setTimeout(() => {
      window.location.href = "bidder.html";
    }, 300);
  });

  // Add hover effect to buttons
  [auctioneerBtn, bidderBtn].forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "none";
    });
  });
});