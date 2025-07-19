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

  // Add hover effect to cards
  const cards = document.querySelectorAll(".role-card");
  cards.forEach(card => {
    card.addEventListener("mouseenter", () => {
      card.querySelector("i").style.transform = "scale(1.1)";
    });
    card.addEventListener("mouseleave", () => {
      card.querySelector("i").style.transform = "scale(1)";
    });
  });
});