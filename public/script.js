document.addEventListener('DOMContentLoaded', () => {
    const auctioneerBtn = document.getElementById('auctioneerBtn');
    const bidderBtn = document.getElementById('bidderBtn');

    if (auctioneerBtn) {
        auctioneerBtn.addEventListener('click', () => {
            window.location.href = 'auctioneer.html';
        });
    }

    if (bidderBtn) {
        bidderBtn.addEventListener('click', () => {
            window.location.href = 'bidder.html';
        });
    }
});
