// script.js — handles role selection

document.addEventListener("DOMContentLoaded", () => {
  const auctioneerBtn = document.getElementById("auctioneerBtn");
  const bidderBtn    = document.getElementById("bidderBtn");

  auctioneerBtn.addEventListener("click", () => {
    window.location.href = "auctioneer.html";
  });

  bidderBtn.addEventListener("click", () => {
    window.location.href = "bidder.html";
  });
});