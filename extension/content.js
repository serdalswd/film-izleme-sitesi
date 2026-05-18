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
            height: 420px;
            background: rgba(15, 12, 18, 0.95);
            border-radius: 16px;
            border: 1px solid rgba(255, 0, 85, 0.2);
            display: flex;
            flex-direction: column;
            z-index: 999999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 10px 40px rgba(255, 0, 85, 0.15);
            backdrop-filter: blur(10px);
            overflow: hidden;
            color: #fff;
        }
        
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
        
        #syncplay-chat-header {
            padding: 15px;
            background: linear-gradient(135deg, #1f041a, #4a0024); /* Romantik koyu bordo/mor gradyan */
            text-align: center;
            border-bottom: 1px solid rgba(255, 0, 85, 0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            position: relative;
        }
        
        .leyla-text {
            font-family: 'Dancing Script', cursive;
            font-size: 28px;
            background: linear-gradient(to right, #ffb3c6, #ff0055, #ffb3c6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: leylaShine 3s infinite;
            letter-spacing: 1px;
            margin-right: 2px;
        }

        .leyla-heart {
            font-size: 20px;
            color: #ff0055;
            animation: leylaHeartbeat 1.2s infinite;
            display: inline-block;
        }
        
        .romantic-cat {
            font-size: 22px;
            display: inline-block;
            animation: catShake 2.5s ease-in-out infinite;
            transform-origin: bottom center;
            margin-left: 5px;
        }

        @keyframes leylaShine {
            0% { filter: drop-shadow(0 0 2px rgba(255,0,85,0.4)); }
            50% { filter: drop-shadow(0 0 8px rgba(255,179,198,0.8)); }
            100% { filter: drop-shadow(0 0 2px rgba(255,0,85,0.4)); }
        }

        @keyframes leylaHeartbeat {
            0% { transform: scale(1); }
            15% { transform: scale(1.25); }
            30% { transform: scale(1); }
            45% { transform: scale(1.25); }
            60% { transform: scale(1); }
        }
        
        @keyframes catShake {
            0%, 100% { transform: rotate(-12deg); }
            50% { transform: rotate(12deg); }
        }

        #syncplay-chat-messages {
            flex-grow: 1;
            padding: 15px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: url('data:image/svg+xml;utf8,<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 3.22l-.61-.6a5.5 5.5 0 0 0-7.78 7.77L10 18.78l8.39-8.4a5.5 5.5 0 0 0-7.78-7.77l-.61.61z" fill="%23ff0055" fill-opacity="0.03"/></svg>');
        }
        
        /* Scrollbar styling */
        #syncplay-chat-messages::-webkit-scrollbar { width: 4px; }
        #syncplay-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,0,85,0.3); border-radius: 2px; }

        .chat-msg {
            background: rgba(255,255,255,0.07);
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            max-width: 85%;
            word-wrap: break-word;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .chat-msg.self {
            background: linear-gradient(135deg, #d80044, #ff0055);
            align-self: flex-end;
            border-bottom-right-radius: 3px;
        }

        .chat-msg.other {
            align-self: flex-start;
            border-bottom-left-radius: 3px;
            border-left: 2px solid #ff0055;
        }

        .msg-user {
            font-size: 11px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 4px;
            font-weight: 600;
        }

        #syncplay-chat-input-container {
            display: flex;
            padding: 12px;
            background: rgba(0,0,0,0.4);
            border-top: 1px solid rgba(255,0,85,0.1);
        }

        #syncplay-chat-input {
            flex-grow: 1;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,0,85,0.2);
            border-radius: 20px;
            padding: 10px 16px;
            color: white;
            outline: none;
            transition: border-color 0.3s;
        }
        
        #syncplay-chat-input:focus {
            border-color: rgba(255,0,85,0.6);
            background: rgba(255,255,255,0.12);
        }

        #syncplay-chat-input::placeholder {
            color: rgba(255,255,255,0.4);
        }

        #syncplay-chat-send {
            background: linear-gradient(135deg, #ff0055, #d80044);
            border: none;
            color: white;
            border-radius: 50%;
            width: 38px;
            height: 38px;
            margin-left: 10px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 0 10px rgba(255,0,85,0.3);
        }
        
        #syncplay-chat-send:hover {
            transform: scale(1.1);
            box-shadow: 0 0 15px rgba(255,0,85,0.6);
        }
        
        .minimize-btn {
            position: absolute;
            top: 18px;
            right: 15px;
            background: none;
            border: none;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            font-size: 14px;
            transition: color 0.2s;
        }
        .minimize-btn:hover {
            color: white;
        }
        
        #syncplay-chat-container.minimized {
            height: 60px;
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
            <span class="romantic-cat">😺🌹</span>
            <button class="minimize-btn" id="chat-min-btn">▼</button>
        </div>
        <div id="syncplay-chat-messages"></div>
        <div id="syncplay-chat-input-container">
            <input type="text" id="syncplay-chat-input" placeholder="Aşk dolu bir mesaj yaz..." autocomplete="off">
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

// Sayfa yenilendiğinde (veya yeni bölüme geçildiğinde) otomatik bağlan
chrome.storage.local.get(['syncActive', 'roomId', 'username'], (result) => {
    if (result.syncActive && result.roomId && result.username) {
        console.log("SyncPlay: Otomatik olarak odaya yeniden bağlanılıyor...");
        setTimeout(() => {
            connectWebSocket(result.roomId, result.username);
        }, 1500); // Netflix'in sayfayı yüklemesi için kısa bir bekleme süresi
    }
});
