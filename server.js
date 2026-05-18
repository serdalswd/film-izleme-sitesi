const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Room storage
const rooms = {};

// Helper to broadcast to a room
function broadcastToRoom(roomId, message, excludeWs = null) {
    if (!rooms[roomId]) return;
    const msgStr = JSON.stringify(message);
    rooms[roomId].users.forEach(client => {
        if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(msgStr);
        }
    });
}

wss.on('connection', (ws) => {
    ws.roomId = null;
    ws.username = null;

    ws.on('message', (messageAsString) => {
        try {
            const data = JSON.parse(messageAsString);

            switch (data.type) {
                case 'join_room':
                    {
                        const { roomId, username } = data;
                        ws.roomId = roomId;
                        ws.username = username;

                        if (!rooms[roomId]) {
                            rooms[roomId] = { time: 0, state: 'pause', users: [] };
                        }

                        rooms[roomId].users.push({ id: ws, ws: ws, name: username });

                        // Send sync state
                        ws.send(JSON.stringify({
                            type: 'sync_state',
                            time: rooms[roomId].time,
                            state: rooms[roomId].state
                        }));

                        // Notify others
                        const usersList = rooms[roomId].users.map(u => ({ name: u.name }));
                        broadcastToRoom(roomId, {
                            type: 'user_joined',
                            users: usersList,
                            message: `${username} odaya katıldı.`
                        });
                    }
                    break;

                case 'chat_message':
                    if (ws.roomId) {
                        broadcastToRoom(ws.roomId, {
                            type: 'chat_message',
                            user: ws.username,
                            text: data.text,
                            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                        });
                    }
                    break;

                case 'play':
                    if (ws.roomId && rooms[ws.roomId]) {
                        rooms[ws.roomId].state = 'play';
                        rooms[ws.roomId].time = data.time;
                        broadcastToRoom(ws.roomId, { type: 'play', time: data.time }, ws);
                        broadcastToRoom(ws.roomId, { type: 'action_notice', message: `${ws.username} videoyu başlattı.` });
                    }
                    break;

                case 'pause':
                    if (ws.roomId && rooms[ws.roomId]) {
                        rooms[ws.roomId].state = 'pause';
                        rooms[ws.roomId].time = data.time;
                        broadcastToRoom(ws.roomId, { type: 'pause', time: data.time }, ws);
                        broadcastToRoom(ws.roomId, { type: 'action_notice', message: `${ws.username} videoyu durdurdu.` });
                    }
                    break;

                case 'seek':
                    if (ws.roomId && rooms[ws.roomId]) {
                        rooms[ws.roomId].time = data.time;
                        broadcastToRoom(ws.roomId, { type: 'seek', time: data.time }, ws);
                        broadcastToRoom(ws.roomId, { type: 'action_notice', message: `${ws.username} videoyu ileri sardı.` });
                    }
                    break;
            }
        } catch (e) {
            console.error('Invalid message format', e);
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId].users = rooms[ws.roomId].users.filter(u => u.ws !== ws);
            const usersList = rooms[ws.roomId].users.map(u => ({ name: u.name }));
            
            if (rooms[ws.roomId].users.length === 0) {
                delete rooms[ws.roomId];
            } else {
                broadcastToRoom(ws.roomId, {
                    type: 'user_left',
                    users: usersList,
                    message: `${ws.username} odadan ayrıldı.`
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`WebSocket Server is running on ws://localhost:${PORT}`);
});
