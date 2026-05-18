const socket = io();
const video = document.getElementById('videoPlayer');

// UI Elements
const joinModal = document.getElementById('joinModal');
const appContainer = document.getElementById('appContainer');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const myNameDisplay = document.getElementById('myNameDisplay');
const myAvatar = document.getElementById('myAvatar');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// Chat & Users UI
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const usersList = document.getElementById('usersList');
const userCountDisplay = document.getElementById('userCount');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

let currentRoom = null;
let myUsername = '';
let isRemoteUpdate = false;

// Helpers
const getAvatarInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

// Join Room Logic
joinBtn.addEventListener('click', () => {
    const room = roomInput.value.trim();
    const username = usernameInput.value.trim();
    
    if (room && username) {
        currentRoom = room;
        myUsername = username;
        
        socket.emit('join_room', { roomId: room, username: username });
        
        // Update UI
        roomNameDisplay.textContent = `Oda: ${room}`;
        myNameDisplay.textContent = username;
        myAvatar.textContent = getAvatarInitial(username);
        
        // Switch Views
        joinModal.classList.add('hidden');
        appContainer.classList.remove('hidden');
    }
});

leaveRoomBtn.addEventListener('click', () => {
    window.location.reload();
});

// Tabs Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.target}Tab`).classList.add('active');
    });
});

// Chat Logic
const sendMessage = () => {
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        chatInput.value = '';
    }
};

sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function addMessage(user, text, time, isMine) {
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isMine ? 'mine' : ''}`;
    
    wrapper.innerHTML = `
        ${!isMine ? `<div class="msg-header"><span>${user}</span> <span>${time}</span></div>` : `<div class="msg-header"><span>${time}</span></div>`}
        <div class="msg-bubble">${text}</div>
    `;
    
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'system-message';
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Socket Events
socket.on('sync_state', (data) => {
    isRemoteUpdate = true;
    video.currentTime = data.time;
    if (data.state === 'play') {
        video.play().catch(e => console.log('Auto-play prevented'));
    } else {
        video.pause();
    }
    setTimeout(() => { isRemoteUpdate = false; }, 100);
});

socket.on('user_joined', (data) => {
    addSystemMessage(data.message);
    updateUsersList(data.users);
});

socket.on('user_left', (data) => {
    addSystemMessage(data.message);
    updateUsersList(data.users);
});

socket.on('chat_message', (data) => {
    addMessage(data.user, data.text, data.time, data.user === myUsername);
});

socket.on('action_notice', (msg) => {
    addSystemMessage(msg);
});

function updateUsersList(users) {
    usersList.innerHTML = '';
    userCountDisplay.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
            <div class="avatar">${getAvatarInitial(user.name)}</div>
            <span class="user-item-name">${user.name} ${user.name === myUsername ? '(Sen)' : ''}</span>
        `;
        usersList.appendChild(li);
    });
}

// Video sync
video.addEventListener('play', () => {
    if (!currentRoom || isRemoteUpdate) return;
    socket.emit('play', { roomId: currentRoom, time: video.currentTime });
});

video.addEventListener('pause', () => {
    if (!currentRoom || isRemoteUpdate) return;
    socket.emit('pause', { roomId: currentRoom, time: video.currentTime });
});

video.addEventListener('seeked', () => {
    if (!currentRoom || isRemoteUpdate) return;
    socket.emit('seek', { roomId: currentRoom, time: video.currentTime });
});

socket.on('play', (time) => {
    isRemoteUpdate = true;
    video.currentTime = time;
    video.play().catch(e => console.log('Auto-play prevented'));
    setTimeout(() => { isRemoteUpdate = false; }, 100);
});

socket.on('pause', (time) => {
    isRemoteUpdate = true;
    video.currentTime = time;
    video.pause();
    setTimeout(() => { isRemoteUpdate = false; }, 100);
});

socket.on('seek', (time) => {
    isRemoteUpdate = true;
    video.currentTime = time;
    setTimeout(() => { isRemoteUpdate = false; }, 100);
});
