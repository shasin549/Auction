// script.js (optional shared logic for index.html)

// This script handles redirection from the index.html page // to the proper auctioneer or bidder panels

document.addEventListener("DOMContentLoaded", () => { const auctioneerBtn = document.getElementById("auctioneerBtn"); const bidderBtn = document.getElementById("bidderBtn");

auctioneerBtn.addEventListener("click", () => { window.open("auctioneer.html", "_blank"); });

bidderBtn.addEventListener("click", () => { window.open("bidder.html", "_blank"); }); });

