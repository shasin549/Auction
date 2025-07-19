// Configuration
const CONFIG = {
    serverUrl: 'https://auction-zfku.onrender.com',
    reconnectOptions: {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket']
    },
    uiStrings: {
        connected: 'Connected',
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        error: 'Connection Error'
    }
};

class AuctionApp {
    constructor() {
        this.elements = {
            auctioneerBtn: document.getElementById('auctioneerBtn'),
            bidderBtn: document.getElementById('bidderBtn'),
            serverStatus: document.getElementById('serverStatus'),
            serverUrl: document.getElementById('serverUrl')
        };
        
        this.state = {
            socket: null,
            isConnected: false,
            lastConnectionTime: null
        };
        
        this.init();
    }
    
    init() {
        this.setupSocketConnection();
        this.setupEventListeners();
        this.setupUI();
    }
    
    setupSocketConnection() {
        this.state.socket = io(CONFIG.serverUrl, CONFIG.reconnectOptions);
        
        this.state.socket.on('connect', () => {
            this.state.isConnected = true;
            this.state.lastConnectionTime = new Date();
            this.updateConnectionStatus(CONFIG.uiStrings.connected, 'connected');
            this.enableNavigation();
            console.log('Connected to server at', this.state.lastConnectionTime.toLocaleTimeString());
        });
        
        this.state.socket.on('disconnect', (reason) => {
            this.state.isConnected = false;
            this.updateConnectionStatus(CONFIG.uiStrings.disconnected, 'disconnected');
            this.disableNavigation();
            console.log('Disconnected:', reason);
        });
        
        this.state.socket.on('connect_error', (err) => {
            this.updateConnectionStatus(CONFIG.uiStrings.error, 'error');
            console.error('Connection error:', err);
        });
        
        this.state.socket.on('reconnect_attempt', (attempt) => {
            this.updateConnectionStatus(`Reconnecting (attempt ${attempt})`, 'connecting');
            console.log(`Reconnection attempt ${attempt}`);
        });
    }
    
    setupEventListeners() {
        this.addNavigationListener(
            this.elements.auctioneerBtn,
            'auctioneer',
            () => this.trackNavigation('auctioneer')
        );
        
        this.addNavigationListener(
            this.elements.bidderBtn,
            'bidder',
            () => this.trackNavigation('bidder')
        );
        
        window.addEventListener('beforeunload', () => {
            if (this.state.socket) {
                this.state.socket.emit('client_disconnect', {
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
    
    addNavigationListener(element, page, callback) {
        element.addEventListener('click', (e) => {
            if (e.metaKey || e.ctrlKey) {
                window.open(`${page}.html`, '_blank');
            } else {
                this.navigateTo(page);
            }
            if (callback) callback();
        });
        
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.navigateTo(page);
            if (callback) callback();
        }, { passive: false });
        
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
    
    navigateTo(page) {
        try {
            if (!this.state.isConnected) {
                alert('Please wait until connected to the server');
                return;
            }
            window.location.href = `${page}.html`;
        } catch (error) {
            console.error(`Navigation to ${page} failed:`, error);
            alert(`Failed to open ${page} panel. Please try again.`);
        }
    }
    
    trackNavigation(destination) {
        if (this.state.socket && this.state.isConnected) {
            this.state.socket.emit('navigation_event', {
                destination,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                screenResolution: `${window.screen.width}x${window.screen.height}`
            });
        }
    }
    
    updateConnectionStatus(text, className) {
        this.elements.serverStatus.textContent = text;
        this.elements.serverStatus.className = className;
    }
    
    enableNavigation() {
        this.elements.auctioneerBtn.disabled = false;
        this.elements.bidderBtn.disabled = false;
    }
    
    disableNavigation() {
        this.elements.auctioneerBtn.disabled = true;
        this.elements.bidderBtn.disabled = true;
    }
    
    setupUI() {
        this.elements.serverUrl.textContent = new URL(CONFIG.serverUrl).hostname;
        this.updateConnectionStatus(CONFIG.uiStrings.connecting, 'connecting');
        this.disableNavigation();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuctionApp();
});