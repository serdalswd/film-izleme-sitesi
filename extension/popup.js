document.addEventListener('DOMContentLoaded', () => {
    const setupPanel = document.getElementById('setup-panel');
    const activePanel = document.getElementById('active-panel');
    const joinBtn = document.getElementById('joinBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    const usernameInput = document.getElementById('username');
    const roomIdInput = document.getElementById('roomId');
    const errorMsg = document.getElementById('errorMsg');
    const roomDisplay = document.getElementById('roomDisplay');
    const userDisplay = document.getElementById('userDisplay');

    // Check if already active
    chrome.storage.local.get(['syncActive', 'roomId', 'username'], (result) => {
        if (result.syncActive) {
            showActive(result.roomId, result.username);
        }
    });

    joinBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const roomId = roomIdInput.value.trim();

        if (!username || !roomId) {
            errorMsg.textContent = 'Lütfen tüm alanları doldurun.';
            return;
        }

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab || !currentTab.url || !currentTab.url.includes('netflix.com/watch')) {
                errorMsg.textContent = 'Lütfen Netflix\'te bir film açtıktan sonra katılın.';
                return;
            }

            // Send message to content script to connect
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'connect',
                roomId: roomId,
                username: username
            }, (response) => {
                if (chrome.runtime.lastError) {
                    errorMsg.textContent = 'Sayfayı yenileyip tekrar deneyin.';
                } else if (response && response.status === 'connected') {
                    chrome.storage.local.set({ syncActive: true, roomId, username });
                    showActive(roomId, username);
                }
            });
        });
    });

    leaveBtn.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'disconnect' });
            chrome.storage.local.remove(['syncActive', 'roomId', 'username']);
            showSetup();
        });
    });

    function showActive(room, user) {
        setupPanel.classList.add('hidden');
        activePanel.classList.remove('hidden');
        roomDisplay.textContent = `Oda: ${room}`;
        userDisplay.textContent = `Kullanıcı: ${user}`;
    }

    function showSetup() {
        setupPanel.classList.remove('hidden');
        activePanel.classList.add('hidden');
        errorMsg.textContent = '';
    }
});
