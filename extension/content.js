let ws = null;
let videoElement = null;
let isRemoteUpdate = false;
let checkInterval = null;
let currentUrl = window.location.href;

// Find Netflix Video element
function findVideo() {
    const video = document.querySelector('video');
    if (video) {
        videoElement = video;
        setupVideoListeners();
        return true;
    }
    return false;
}

// Connect to local WebSocket Server
function connectWebSocket(roomId, username, sendResponse) {
    if (ws) {
        ws.close();
    }

    ws = new WebSocket('wss://film-izleme-sitesi.onrender.com');

    ws.onopen = () => {
        console.log('SyncPlay connected to server');
        ws.send(JSON.stringify({
            type: 'join_room',
            roomId: roomId,
            username: username
        }));
        if (sendResponse) sendResponse({ status: 'connected' });
        
        // Setup video detection
        if (!findVideo()) {
            checkInterval = setInterval(() => {
                if (findVideo()) clearInterval(checkInterval);
            }, 1000);
        }
        
        // Initial URL sync
        ws.send(JSON.stringify({
            type: 'url_change',
            url: window.location.href
        }));
        
        showToast(`SyncPlay: ${roomId} odasına bağlandınız.`);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!videoElement) return;

        switch (data.type) {
            case 'sync_state':
                if (data.url && data.url.split('?')[0] !== window.location.href.split('?')[0]) {
                    showToast('Odadaki videoya yönlendiriliyorsunuz...');
                    setTimeout(() => { window.location.href = data.url; }, 2000);
                    return;
                }
                
                isRemoteUpdate = true;
                if (videoElement) {
                    videoElement.currentTime = data.time;
                    if (data.state === 'play') {
                        videoElement.play().catch(e => console.log('Autoplay prevented', e));
                    } else {
                        videoElement.pause();
                    }
                }
                setTimeout(() => { isRemoteUpdate = false; }, 500);
                break;
                
            case 'sync_url':
                if (data.url && data.url.split('?')[0] !== window.location.href.split('?')[0]) {
                    showToast(data.message);
                    setTimeout(() => { window.location.href = data.url; }, 2500);
                }
                break;
                
            case 'play':
                isRemoteUpdate = true;
                videoElement.currentTime = data.time;
                videoElement.play().catch(e => console.log('Autoplay prevented', e));
                setTimeout(() => { isRemoteUpdate = false; }, 500);
                break;
                
            case 'pause':
                isRemoteUpdate = true;
                videoElement.currentTime = data.time;
                videoElement.pause();
                setTimeout(() => { isRemoteUpdate = false; }, 500);
                break;
                
            case 'seek':
                isRemoteUpdate = true;
                videoElement.currentTime = data.time;
                setTimeout(() => { isRemoteUpdate = false; }, 500);
                break;
                
            case 'action_notice':
            case 'user_joined':
            case 'user_left':
                showToast(data.message);
                break;
        }
    };

    ws.onclose = () => {
        console.log('SyncPlay disconnected');
        showToast('SyncPlay: Bağlantı koptu.');
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (checkInterval) clearInterval(checkInterval);
    showToast('SyncPlay: Odadan ayrıldınız.');
}

function setupVideoListeners() {
    if (!videoElement) return;

    videoElement.addEventListener('play', () => {
        if (isRemoteUpdate || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'play', time: videoElement.currentTime }));
    });

    videoElement.addEventListener('pause', () => {
        if (isRemoteUpdate || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'pause', time: videoElement.currentTime }));
    });

    videoElement.addEventListener('seeked', () => {
        if (isRemoteUpdate || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'seek', time: videoElement.currentTime }));
    });
}

// Very simple toast notification system
function showToast(message) {
    let toast = document.getElementById('syncplay-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'syncplay-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(99, 102, 241, 0.9);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 999999;
            font-family: sans-serif;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'connect') {
        connectWebSocket(request.roomId, request.username, sendResponse);
        return true; // async response
    } else if (request.action === 'disconnect') {
        disconnectWebSocket();
        sendResponse({ status: 'disconnected' });
    }
});

// Watch for URL changes (Netflix is an SPA, so we need to poll)
setInterval(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'url_change',
                url: currentUrl
            }));
        }
    }
}, 1000);
