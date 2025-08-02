// This file contains shared utility functions used across multiple pages.

/**
 * Creates and displays a toast notification.
 * @param {string} message The message to display.
 * @param {string} type The type of toast ('success', 'error', 'info', 'warning').
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast animate-fade-in-down p-4 rounded-xl shadow-lg text-white';

    switch (type) {
        case 'success':
            toast.classList.add('bg-emerald-500');
            break;
        case 'error':
            toast.classList.add('bg-red-500');
            break;
        case 'warning':
            toast.classList.add('bg-yellow-500');
            break;
        case 'info':
        default:
            toast.classList.add('bg-blue-500');
            break;
    }

    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('animate-fade-in-down');
        toast.classList.add('animate-fade-out-up');
        toast.addEventListener('animationend', () => toast.remove());
    }, 5000);
}

/**
 * Handles the display and content of a modal.
 * @param {string} modalId The ID of the modal element.
 * @param {string} content The HTML content to place inside the modal form content area.
 * @param {function} onOpen A function to run when the modal is opened.
 */
function openModal(modalId, content, onOpen = () => {}) {
    console.log(`openModal called for modalId: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal with ID "${modalId}" not found.`);
        return;
    }

    const modalContent = modal.querySelector('.modal-content');
    const modalFormContent = modal.querySelector('#modal-form-content');
    if (modalFormContent) {
        modalFormContent.innerHTML = content;
    }

    modal.classList.add('active');
    setTimeout(() => {
        modalContent.classList.add('active');
    }, 10);

    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => closeModal(modalId);
    }

    onOpen(modal);

    window.onclick = (event) => {
        if (event.target === modal) {
            closeModal(modalId);
        }
    };
}

/**
 * Hides the modal.
 * @param {string} modalId The ID of the modal element.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.classList.remove('active');
    setTimeout(() => {
        modal.classList.remove('active');
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM Content Loaded. Initializing event listeners.");
        const auctioneerBtn = document.getElementById('auctioneer-button');
        const bidderBtn = document.getElementById('bidder-button');
        const modal = document.getElementById('modal');

        // Handle button clicks on the index page
        if (auctioneerBtn) {
            console.log("Auctioneer button found. Attaching click listener.");
            auctioneerBtn.addEventListener('click', () => {
                console.log("Auctioneer button click detected.");
                const formHtml = `
                    <h2 class="text-2xl font-bold text-center mb-4">Create Auction Room</h2>
                    <form id="create-room-form" class="space-y-4">
                        <div>
                            <label for="auctioneer-name" class="block text-sm font-medium text-gray-300">Your Name</label>
                            <input type="text" id="auctioneer-name" required class="mt-1 block w-full rounded-md bg-gray-700 border-transparent focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 text-white">
                        </div>
                        <div>
                            <label for="bid-increment" class="block text-sm font-medium text-gray-300">Bid Increment</label>
                            <input type="number" id="bid-increment" required value="10" min="1" class="mt-1 block w-full rounded-md bg-gray-700 border-transparent focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 text-white">
                        </div>
                        <button type="submit" class="w-full action-btn">Create Room</button>
                    </form>
                `;
                openModal('modal', formHtml, (modalElement) => {
                    const createRoomForm = modalElement.querySelector('#create-room-form');
                    if (createRoomForm) {
                        console.log("Create Room form found. Attaching submit listener.");
                        createRoomForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            console.log("Create Room form submitted.");
                            const auctioneerName = document.getElementById('auctioneer-name').value;
                            const bidIncrement = parseInt(document.getElementById('bid-increment').value, 10);
                            
                            if (!isAuthReady) {
                                 showToast('Authentication not ready, please wait...', 'warning');
                                 console.warn("Authentication not ready. Form submission blocked.");
                                 return;
                            }

                            try {
                                const roomsCollection = db.collection(`artifacts/${appId}/public/data/rooms`);
                                
                                // Generate a unique room code
                                const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                                
                                // Add a new document to the 'rooms' collection
                                await roomsCollection.doc(roomCode).set({
                                    auctioneerId: userId,
                                    auctioneerName: auctioneerName,
                                    bidIncrement: bidIncrement,
                                    participants: [
                                        { id: userId, name: auctioneerName }
                                    ],
                                    status: 'waiting'
                                });
                                
                                // Store current room code in session storage
                                sessionStorage.setItem('roomCode', roomCode);
                                sessionStorage.setItem('userName', auctioneerName);
                                
                                showToast('Room created successfully!', 'success');
                                window.location.href = 'auctioneer.html';
                            } catch (error) {
                                console.error("Error creating room:", error);
                                showToast('Failed to create room. Please try again.', 'error');
                            }
                        });
                    }
                });
            });
        }

        if (bidderBtn) {
            console.log("Bidder button found. Attaching click listener.");
            bidderBtn.addEventListener('click', () => {
                console.log("Bidder button click detected.");
                const formHtml = `
                    <h2 class="text-2xl font-bold text-center mb-4">Join Auction Room</h2>
                    <form id="join-room-form" class="space-y-4">
                        <div>
                            <label for="bidder-name" class="block text-sm font-medium text-gray-300">Your Name</label>
                            <input type="text" id="bidder-name" required class="mt-1 block w-full rounded-md bg-gray-700 border-transparent focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 text-white">
                        </div>
                        <div>
                            <label for="room-code" class="block text-sm font-medium text-gray-300">Room Code</label>
                            <input type="text" id="room-code" required class="mt-1 block w-full rounded-md bg-gray-700 border-transparent focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 text-white">
                        </div>
                        <button type="submit" class="w-full action-btn">Join Room</button>
                    </form>
                `;
                openModal('modal', formHtml, (modalElement) => {
                    const joinRoomForm = modalElement.querySelector('#join-room-form');
                    if (joinRoomForm) {
                        console.log("Join Room form found. Attaching submit listener.");
                        joinRoomForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            console.log("Join Room form submitted.");
                            const bidderName = document.getElementById('bidder-name').value;
                            const roomCode = document.getElementById('room-code').value.toUpperCase();

                            if (!isAuthReady) {
                                showToast('Authentication not ready, please wait...', 'warning');
                                console.warn("Authentication not ready. Form submission blocked.");
                                return;
                            }

                            try {
                                const roomDoc = await db.collection(`artifacts/${appId}/public/data/rooms`).doc(roomCode).get();
                                if (!roomDoc.exists) {
                                    showToast('Room not found. Please check the code.', 'error');
                                    console.error(`Room with code '${roomCode}' not found.`);
                                    return;
                                }
                                
                                // Add bidder to the participants list
                                await roomDoc.ref.update({
                                    participants: firebase.firestore.FieldValue.arrayUnion({ id: userId, name: bidderName })
                                });

                                sessionStorage.setItem('roomCode', roomCode);
                                sessionStorage.setItem('userName', bidderName);

                                showToast('Joined room successfully!', 'success');
                                window.location.href = 'bidder.html';
                            } catch (error) {
                                console.error("Error joining room:", error);
                                showToast('Failed to join room. Please try again.', 'error');
                            }
                        });
                    }
                });
            });
        }
    } catch (e) {
        console.error("An error occurred during script initialization:", e);
    }
});

