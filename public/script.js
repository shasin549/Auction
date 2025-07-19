// script.js — Handles role selection from index.html

document.addEventListener("DOMContentLoaded", () => {
  const auctioneerBtn = document.getElementById("auctioneerBtn");
  const bidderBtn = document.getElementById("bidderBtn");

  // Navigate to auctioneer page
  auctioneerBtn.addEventListener("click", () => {
    window.location.href = "auctioneer.html";
  });

  // Navigate to bidder page
  bidderBtn.addEventListener("click", () => {
    window.location.href = "bidder.html";
  });
});