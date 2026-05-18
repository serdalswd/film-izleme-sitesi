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
        
        // Setup Chat UI
        setupChatUI(username);
        
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
                
            case 'chat_message':
                if (data.user !== window.syncPlayUsername) {
                    addChatMessage(data.user, data.text, false);
                }
                break;
        }
    };

    ws.onclose = () => {
        console.log('SyncPlay disconnected');
        showToast('SyncPlay: Bağlantı koptu.');
        const chatContainer = document.getElementById('syncplay-chat-container');
        if (chatContainer) chatContainer.remove();
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

// Chat UI System
function setupChatUI(username) {
    if (document.getElementById('syncplay-chat-container')) return;

    window.syncPlayUsername = username;

    const chatStyles = document.createElement('style');
    chatStyles.textContent = `
        #syncplay-chat-container {
            position: fixed;
            right: 20px;
            bottom: 20px;
            width: 320px;
            height: 400px;
            background: rgba(15, 15, 20, 0.95);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            z-index: 999999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            backdrop-filter: blur(10px);
            overflow: hidden;
            color: #fff;
        }
        #syncplay-chat-header {
            padding: 15px;
            background: linear-gradient(135deg, #111, #222);
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        }
        
        .leyla-text {
            color: #ffb3c6;
            text-shadow: 0 0 10px #ffb3c6, 0 0 20px #ff0055;
            animation: leylaGlow 1.5s ease-in-out infinite alternate;
            font-family: 'Comic Sans MS', cursive, sans-serif; /* Romantik/Şirin bir hava için */
        }

        .leyla-heart {
            color: #ff0055;
            animation: leylaHeartbeat 1s infinite;
            display: inline-block;
        }

        @keyframes leylaGlow {
            from { text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #ff0055, 0 0 20px #ff0055; }
            to { text-shadow: 0 0 10px #fff, 0 0 20px #ffb3c6, 0 0 30px #ffb3c6, 0 0 40px #ff0055; }
        }

        @keyframes leylaHeartbeat {
            0% { transform: scale(1); }
            15% { transform: scale(1.3); }
            30% { transform: scale(1); }
            45% { transform: scale(1.3); }
            60% { transform: scale(1); }
        }

        #syncplay-chat-messages {
            flex-grow: 1;
            padding: 15px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        /* Scrollbar styling */
        #syncplay-chat-messages::-webkit-scrollbar { width: 6px; }
        #syncplay-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

        .chat-msg {
            background: rgba(255,255,255,0.1);
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.4;
            max-width: 85%;
            word-wrap: break-word;
        }
        
        .chat-msg.self {
            background: rgba(229, 9, 20, 0.7); /* Netflix Kırmızısı */
            align-self: flex-end;
            border-bottom-right-radius: 2px;
        }

        .chat-msg.other {
            align-self: flex-start;
            border-bottom-left-radius: 2px;
        }

        .msg-user {
            font-size: 11px;
            color: rgba(255,255,255,0.6);
            margin-bottom: 3px;
        }

        #syncplay-chat-input-container {
            display: flex;
            padding: 10px;
            background: rgba(0,0,0,0.3);
            border-top: 1px solid rgba(255,255,255,0.1);
        }

        #syncplay-chat-input {
            flex-grow: 1;
            background: rgba(255,255,255,0.1);
            border: none;
            border-radius: 20px;
            padding: 8px 15px;
            color: white;
            outline: none;
        }

        #syncplay-chat-input::placeholder {
            color: rgba(255,255,255,0.5);
        }

        #syncplay-chat-send {
            background: #e50914;
            border: none;
            color: white;
            border-radius: 50%;
            width: 34px;
            height: 34px;
            margin-left: 8px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: transform 0.2s;
        }
        
        #syncplay-chat-send:hover {
            transform: scale(1.1);
        }
        
        .minimize-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            opacity: 0.7;
        }
        .minimize-btn:hover {
            opacity: 1;
        }
        
        #syncplay-chat-container.minimized {
            height: 55px;
        }
        #syncplay-chat-container.minimized #syncplay-chat-messages,
        #syncplay-chat-container.minimized #syncplay-chat-input-container {
            display: none;
        }
    `;
    document.head.appendChild(chatStyles);

    const container = document.createElement('div');
    container.id = 'syncplay-chat-container';
    container.innerHTML = `
        <div id="syncplay-chat-header">
            <span class="leyla-text">Leyla</span>
            <span class="leyla-heart">❤️</span>
            <button class="minimize-btn" id="chat-min-btn">▼</button>
        </div>
        <div id="syncplay-chat-messages"></div>
        <div id="syncplay-chat-input-container">
            <input type="text" id="syncplay-chat-input" placeholder="Mesaja başla..." autocomplete="off">
            <button id="syncplay-chat-send">➤</button>
        </div>
    `;
    document.body.appendChild(container);

    const input = document.getElementById('syncplay-chat-input');
    const sendBtn = document.getElementById('syncplay-chat-send');
    const minBtn = document.getElementById('chat-min-btn');
    const messages = document.getElementById('syncplay-chat-messages');

    let isMinimized = false;
    minBtn.onclick = () => {
        isMinimized = !isMinimized;
        container.classList.toggle('minimized', isMinimized);
        minBtn.textContent = isMinimized ? '▲' : '▼';
    };

    function sendMessage() {
        const text = input.value.trim();
        if (text && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'chat_message',
                text: text
            }));
            
            // Kendi mesajını anında ekle
            addChatMessage(username, text, true);
            input.value = '';
        }
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
}

function addChatMessage(user, text, isSelf = false) {
    const messages = document.getElementById('syncplay-chat-messages');
    if (!messages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isSelf ? 'self' : 'other'}`;
    
    if (!isSelf) {
        msgDiv.innerHTML = `<div class="msg-user">${user}</div><div>${text}</div>`;
    } else {
        msgDiv.innerHTML = `<div>${text}</div>`;
    }
    
    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
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
