// ========================================
// OFFLINE COMMUNICATION HUB - ALL FEATURES
// ========================================

let db;
let map;
let currentLocation = { lat: null, lng: null };
let userMarker = null;
let spotMarkers = [];
let currentUsername = localStorage.getItem('username') || 'User_' + Math.random().toString(36).substr(2, 5);
let watchId = null;

// Save username
localStorage.setItem('username', currentUsername);

// Category icons and colors
const categoryConfig = {
    'safe-zone': { icon: '🛡️', color: '#51cf66' },
    'medical': { icon: '🏥', color: '#ff6b6b' },
    'food': { icon: '🍽️', color: '#ffa94d' },
    'shelter': { icon: '🏠', color: '#4c6ef5' },
    'communication': { icon: '📡', color: '#9775fa' },
    'meeting': { icon: '🤝', color: '#20c997' }
};

// ========================================
// TAB SWITCHING
// ========================================

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');

    // Load data when switching tabs
    if (tabName === 'chat') {
        loadMessages();
    } else if (tabName === 'sos') {
        loadSOSAlerts();
    }
}

// ========================================
// INITIALIZE DATABASE
// ========================================

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OfflineCommHubDB', 3);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Green Spots
            if (!db.objectStoreNames.contains('greenspots')) {
                const store = db.createObjectStore('greenspots', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('username', 'username', { unique: false });
            }

            // Messages
            if (!db.objectStoreNames.contains('messages')) {
                const messagesStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
                messagesStore.createIndex('username', 'username', { unique: false });
            }

            // SOS Alerts
            if (!db.objectStoreNames.contains('sos')) {
                const sosStore = db.createObjectStore('sos', { keyPath: 'id', autoIncrement: true });
                sosStore.createIndex('timestamp', 'timestamp', { unique: false });
                sosStore.createIndex('username', 'username', { unique: false });
            }
        };
    });
}

// ========================================
// GEOLOCATION
// ========================================

function initGeolocation() {
    if (!navigator.geolocation) {
        alert('❌ Geolocation is not supported by your browser');
        document.getElementById('location-status').textContent = '❌ GPS not available';
        return;
    }

    document.getElementById('location-status').textContent = '📍 Getting GPS location...';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation.lat = position.coords.latitude;
            currentLocation.lng = position.coords.longitude;
            
            console.log('✅ Location obtained:', currentLocation);
            
            updateLocationDisplay();
            updateMap();
            
            document.getElementById('location-status').textContent = 
                `✅ GPS Active (${position.coords.accuracy.toFixed(0)}m accuracy)`;
            document.getElementById('location-status').classList.add('active');

            // Start watching position
            startWatchingPosition();
        },
        (error) => {
            console.error('❌ Geolocation error:', error);
            handleLocationError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function startWatchingPosition() {
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            currentLocation.lat = position.coords.latitude;
            currentLocation.lng = position.coords.longitude;
            updateUserMarker();
        },
        (error) => console.error('Watch position error:', error),
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

function handleLocationError(error) {
    let message = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = '❌ Location access denied. Please allow location access.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = '⚠️ Location unavailable. Using default location.';
            break;
        case error.TIMEOUT:
            message = '⚠️ Location request timeout.';
            break;
        default:
            message = '❌ Unknown location error.';
    }
    document.getElementById('location-status').textContent = message;
}

function updateLocationDisplay() {
    if (currentLocation.lat && currentLocation.lng) {
        document.getElementById('spot-location-preview').innerHTML = 
            `📍 Current Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`;
    }
}

// ========================================
// MAP INITIALIZATION
// ========================================

function initMap() {
    const defaultLat = currentLocation.lat || 20.5937;
    const defaultLng = currentLocation.lng || 78.9629;
    
    map = L.map('map').setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    console.log('✅ Map initialized');
}

function updateMap() {
    if (map && currentLocation.lat && currentLocation.lng) {
        map.setView([currentLocation.lat, currentLocation.lng], 15);
        updateUserMarker();
    }
}

function updateUserMarker() {
    if (!currentLocation.lat || !currentLocation.lng) return;

    if (userMarker) {
        userMarker.setLatLng([currentLocation.lat, currentLocation.lng]);
    } else {
        userMarker = L.marker([currentLocation.lat, currentLocation.lng], {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<div style="width: 20px; height: 20px; background: #4285f4; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(66, 133, 244, 0.8);"></div>',
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            }),
            zIndexOffset: 1000
        }).addTo(map);
        
        userMarker.bindPopup(`
            <div class="popup-content">
                <h4>📍 Your Location</h4>
                <p><strong>Coordinates:</strong><br>${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}</p>
            </div>
        `);
    }
}

// ========================================
// GREEN SPOT MANAGEMENT
// ========================================

function addGreenSpot(description, category, notes) {
    if (!currentLocation.lat || !currentLocation.lng) {
        alert('❌ Please wait for GPS location');
        return;
    }

    const spot = {
        description,
        category,
        notes,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        username: currentUsername,
        timestamp: new Date().toISOString()
    };

    const transaction = db.transaction(['greenspots'], 'readwrite');
    const store = transaction.objectStore('greenspots');
    const request = store.add(spot);

    request.onsuccess = () => {
        console.log('✅ Green spot added');
        loadGreenSpots();
        document.getElementById('spot-form').reset();
    };

    request.onerror = () => {
        console.error('❌ Error adding green spot:', request.error);
        alert('Failed to add green spot');
    };
}

function loadGreenSpots() {
    const transaction = db.transaction(['greenspots'], 'readonly');
    const store = transaction.objectStore('greenspots');
    const request = store.getAll();

    request.onsuccess = () => {
        const spots = request.result;
        displaySpotsOnMap(spots);
    };
}

function displaySpotsOnMap(spots) {
    // Clear existing markers
    spotMarkers.forEach(marker => map.removeLayer(marker));
    spotMarkers = [];

    spots.forEach(spot => {
        const config = categoryConfig[spot.category];
        
        const marker = L.marker([spot.lat, spot.lng], {
            icon: L.divIcon({
                className: 'green-spot-marker',
                html: `<div style="font-size: 30px; text-align: center;">${config.icon}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(map);

        marker.bindPopup(`
            <div class="popup-content">
                <h4>${config.icon} ${spot.description}</h4>
                <p><strong>Category:</strong> ${spot.category}</p>
                <p><strong>Added by:</strong> ${spot.username}</p>
                <p><strong>Notes:</strong> ${spot.notes || 'None'}</p>
                <p><strong>Location:</strong> ${spot.lat.toFixed(6)}, ${spot.lng.toFixed(6)}</p>
                <p style="font-size: 11px; color: #666;">${new Date(spot.timestamp).toLocaleString()}</p>
            </div>
        `);

        spotMarkers.push(marker);
    });
}

// ========================================
// MESSAGING
// ========================================

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (!text) return;

    const message = {
        text,
        username: currentUsername,
        timestamp: new Date().toISOString()
    };

    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    const request = store.add(message);

    request.onsuccess = () => {
        console.log('✅ Message sent');
        input.value = '';
        loadMessages();
    };

    request.onerror = () => {
        console.error('❌ Error sending message:', request.error);
        alert('Failed to send message');
    };
}

function loadMessages() {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const request = store.getAll();

    request.onsuccess = () => {
        const messages = request.result;
        displayMessages(messages);
    };
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    
    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No messages yet. Start a conversation!</p>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isSent = msg.username === currentUsername;
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div><strong>${isSent ? 'You' : msg.username}:</strong> ${msg.text}</div>
                <div class="message-info">${new Date(msg.timestamp).toLocaleString()}</div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// ========================================
// SOS ALERTS
// ========================================

function sendSOS() {
    if (!currentLocation.lat || !currentLocation.lng) {
        alert('❌ Please wait for GPS location');
        return;
    }

    if (!confirm('🚨 Send SOS alert with your current location?')) {
        return;
    }

    const sos = {
        username: currentUsername,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        timestamp: new Date().toISOString()
    };

    const transaction = db.transaction(['sos'], 'readwrite');
    const store = transaction.objectStore('sos');
    const request = store.add(sos);

    request.onsuccess = () => {
        console.log('✅ SOS alert sent');
        alert('🚨 SOS Alert Sent!\nYour location has been broadcast to all users.');
        loadSOSAlerts();
    };

    request.onerror = () => {
        console.error('❌ Error sending SOS:', request.error);
        alert('Failed to send SOS alert');
    };
}

function loadSOSAlerts() {
    const transaction = db.transaction(['sos'], 'readonly');
    const store = transaction.objectStore('sos');
    const request = store.getAll();

    request.onsuccess = () => {
        const alerts = request.result;
        displaySOSAlerts(alerts);
    };
}

function displaySOSAlerts(alerts) {
    const container = document.getElementById('sos-alerts-container');
    
    if (alerts.length === 0) {
        container.innerHTML = '<h3 style="color: #667eea; margin: 20px 0;">Recent SOS Alerts</h3><p style="text-align: center; color: #999; padding: 20px;">No SOS alerts yet.</p>';
        return;
    }

    const alertsHTML = alerts.reverse().map(alert => `
        <div class="sos-alert">
            <h4 style="color: #ff6b6b; margin-bottom: 8px;">🚨 SOS from ${alert.username}</h4>
            <p><strong>Location:</strong> ${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}</p>
            <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
            <button onclick="viewSOSOnMap(${alert.lat}, ${alert.lng})" style="margin-top: 8px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                📍 View on Map
            </button>
        </div>
    `).join('');

    container.innerHTML = '<h3 style="color: #667eea; margin: 20px 0;">Recent SOS Alerts</h3>' + alertsHTML;
}

function viewSOSOnMap(lat, lng) {
    switchTab('map');
    map.setView([lat, lng], 17);
    
    // Add temporary marker
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'sos-marker',
            html: '<div style="font-size: 40px;">🚨</div>',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        })
    }).addTo(map);

    marker.bindPopup(`
        <div class="popup-content">
            <h4 style="color: #ff6b6b;">🚨 SOS Alert Location</h4>
            <p>${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
    `).openPopup();

    setTimeout(() => map.removeLayer(marker), 10000);
}

// ========================================
// FORM HANDLERS
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize database
    await initDB();
    
    // Set username
    document.getElementById('current-username').textContent = currentUsername;
    
    // Initialize geolocation
    initGeolocation();
    
    // Initialize map
    initMap();
    
    // Load initial data
    loadGreenSpots();
    
    // Form submission
    document.getElementById('spot-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const description = document.getElementById('spot-description').value;
        const category = document.getElementById('spot-category').value;
        const notes = document.getElementById('spot-notes').value;
        addGreenSpot(description, category, notes);
    });

    console.log('✅ App initialized');
});
