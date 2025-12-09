let connection = null;
let currentUsername = '';
let currentRoom = 'general';
let availableRooms = [];
let typingTimeout = null;
let isTyping = false;
let typingUsers = new Set();
let messageReactions = {};
const availableEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

// Initialize SignalR connection
function initializeConnection() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Handle incoming messages
    connection.on("ReceiveMessage", (sender, message, timestamp, messageId) => {
        displayMessage(sender, message, timestamp, sender === currentUsername, false, messageId);
    });

    // Handle private messages
    connection.on("ReceivePrivateMessage", (sender, message, timestamp) => {
        displayMessage(sender, message, timestamp, sender.startsWith("To "), true);
    });

    // Handle user joined room
    connection.on("UserJoinedRoom", (username, roomName) => {
        if (roomName === currentRoom) {
            displaySystemMessage(`${username} joined the room`);
        }
    });

    // Handle user left room
    connection.on("UserLeftRoom", (username, roomName) => {
        if (roomName === currentRoom) {
            displaySystemMessage(`${username} left the room`);
        }
    });

    // Handle room list
    connection.on("RoomList", (rooms) => {
        availableRooms = rooms;
        updateRoomsList();
    });

    // Handle room joined
    connection.on("RoomJoined", (room, users) => {
        currentRoom = room.name;
        document.getElementById('currentRoomName').textContent = room.displayName;
        document.getElementById('messagesContainer').innerHTML = '';
        updateUsersList(users);
        updateRoomsList();
        typingUsers.clear();
        updateTypingIndicator();
    });

    // Handle room created
    connection.on("RoomCreated", (room) => {
        if (!room.isPrivate) {
            availableRooms.push(room);
            updateRoomsList();
        }
    });

    // Handle errors
    connection.on("Error", (message) => {
        alert(message);
    });

    // Handle typing indicators
    connection.on("UserTyping", (username) => {
        typingUsers.add(username);
        updateTypingIndicator();
    });

    connection.on("UserStoppedTyping", (username) => {
        typingUsers.delete(username);
        updateTypingIndicator();
    });

    // Handle reaction updates
    connection.on("ReactionUpdated", (messageId, reactions) => {
        messageReactions[messageId] = reactions;
        updateMessageReactions(messageId);
    });

    // Connection state handlers
    connection.onreconnecting(() => {
        updateConnectionStatus(false, "Reconnecting...");
    });

    connection.onreconnected(() => {
        updateConnectionStatus(true, "Connected");
    });

    connection.onclose(() => {
        updateConnectionStatus(false, "Disconnected");
    });

    // Start connection
    connection.start()
        .then(() => {
            updateConnectionStatus(true, "Connected");
        })
        .catch(err => {
            console.error("Connection failed:", err);
            updateConnectionStatus(false, "Connection failed");
        });
}

function joinChat() {
    const username = document.getElementById('usernameInput').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }

    currentUsername = username;
    document.getElementById('currentUser').textContent = username;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'flex';

    initializeConnection();

    // Wait for connection and then join
    const checkConnection = setInterval(() => {
        if (connection && connection.state === signalR.HubConnectionState.Connected) {
            clearInterval(checkConnection);
            connection.invoke("JoinChat", username);
        }
    }, 100);
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !connection) return;

    // Stop typing indicator when sending
    if (isTyping) {
        isTyping = false;
        if (typingTimeout) clearTimeout(typingTimeout);
        connection.invoke("StopTyping").catch(err => console.error("Typing stop failed:", err));
    }

    connection.invoke("SendMessage", message)
        .catch(err => console.error("Send failed:", err));
    
    input.value = '';
}

function displayMessage(sender, message, timestamp, isOwn, isPrivate = false, messageId = null) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''} ${isPrivate ? 'private' : ''}`;
    if (messageId) messageDiv.dataset.messageId = messageId;
    
    const reactionsHtml = messageId ? `
        <div class="message-reactions" id="reactions-${messageId}"></div>
        <button class="add-reaction-btn" onclick="showEmojiPicker(event, '${messageId}')">😀+</button>
    ` : '';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(sender)}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-text">${escapeHtml(message)}</div>
            ${reactionsHtml}
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function displaySystemMessage(message) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${escapeHtml(message)}
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function updateUsersList(users) {
    const list = document.getElementById('usersList');
    list.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-status"></div>
            <span>${escapeHtml(user)}</span>
        </div>
    `).join('');
}

function updateRoomsList() {
    const list = document.getElementById('roomsList');
    list.innerHTML = availableRooms.map(room => `
        <div class="room-item ${room.name === currentRoom ? 'active' : ''}" onclick="switchRoom('${room.name}')">
            <span>${escapeHtml(room.displayName)}</span>
        </div>
    `).join('');
}

function switchRoom(roomName) {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    if (roomName === currentRoom) return;
    
    connection.invoke("JoinRoom", roomName)
        .catch(err => console.error("Join room failed:", err));
}

function showCreateRoomModal() {
    document.getElementById('createRoomModal').classList.add('show');
    document.getElementById('roomNameInput').value = '';
    document.getElementById('privateRoomCheckbox').checked = false;
}

function closeCreateRoomModal() {
    document.getElementById('createRoomModal').classList.remove('show');
}

function createRoom() {
    const roomName = document.getElementById('roomNameInput').value.trim();
    const isPrivate = document.getElementById('privateRoomCheckbox').checked;
    
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }

    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    
    connection.invoke("CreateRoom", roomName, isPrivate)
        .then(() => {
            closeCreateRoomModal();
        })
        .catch(err => {
            console.error("Create room failed:", err);
            alert('Failed to create room');
        });
}

function updateConnectionStatus(connected, text) {
    const dot = document.getElementById('statusDot');
    const status = document.getElementById('connectionStatus');
    
    dot.className = `status-dot ${connected ? 'connected' : ''}`;
    status.textContent = text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Emoji reactions functions
function showEmojiPicker(event, messageId) {
    event.stopPropagation();
    
    // Remove any existing picker
    const existingPicker = document.querySelector('.emoji-picker.show');
    if (existingPicker) existingPicker.remove();
    
    const picker = document.createElement('div');
    picker.className = 'emoji-picker show';
    picker.innerHTML = availableEmojis.map(emoji => 
        `<button onclick="addReaction('${messageId}', '${emoji}')">${emoji}</button>`
    ).join('');
    
    // Position the picker
    const rect = event.target.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.left = `${rect.left}px`;
    picker.style.top = `${rect.top - 50}px`;
    
    document.body.appendChild(picker);
    
    // Close picker when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closePicker(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closePicker);
            }
        });
    }, 0);
}

function addReaction(messageId, emoji) {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    
    connection.invoke("ToggleReaction", messageId, emoji)
        .catch(err => console.error("Reaction failed:", err));
    
    // Close the picker
    const picker = document.querySelector('.emoji-picker.show');
    if (picker) picker.remove();
}

function updateMessageReactions(messageId) {
    const reactionsContainer = document.getElementById(`reactions-${messageId}`);
    if (!reactionsContainer) return;
    
    const reactions = messageReactions[messageId] || {};
    
    reactionsContainer.innerHTML = Object.entries(reactions).map(([emoji, data]) => {
        const isActive = data.users && data.users.includes(currentUsername);
        const tooltip = data.users ? data.users.join(', ') : '';
        return `
            <button class="reaction-btn ${isActive ? 'active' : ''}" 
                    onclick="addReaction('${messageId}', '${emoji}')"
                    title="${tooltip}">
                <span>${emoji}</span>
                <span class="count">${data.count}</span>
            </button>
        `;
    }).join('');
}

// Handle typing indicator
function handleTyping() {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;

    if (!isTyping) {
        isTyping = true;
        connection.invoke("StartTyping").catch(err => console.error("Typing start failed:", err));
    }

    // Clear existing timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }

    // Set new timeout to stop typing after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
        isTyping = false;
        connection.invoke("StopTyping").catch(err => console.error("Typing stop failed:", err));
    }, 2000);
}

function updateTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    const users = Array.from(typingUsers);

    if (users.length === 0) {
        indicator.innerHTML = '';
    } else if (users.length === 1) {
        indicator.innerHTML = `<strong>${escapeHtml(users[0])}</strong> is typing<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
    } else if (users.length === 2) {
        indicator.innerHTML = `<strong>${escapeHtml(users[0])}</strong> and <strong>${escapeHtml(users[1])}</strong> are typing<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
    } else {
        indicator.innerHTML = `<strong>${users.length} people</strong> are typing<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
    }
}

// Handle Enter key
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (document.getElementById('loginScreen').style.display !== 'none') {
            joinChat();
        } else if (document.getElementById('createRoomModal').classList.contains('show')) {
            createRoom();
        } else {
            sendMessage();
        }
    }
});

// Close modal on outside click
document.getElementById('createRoomModal').addEventListener('click', (e) => {
    if (e.target.id === 'createRoomModal') {
        closeCreateRoomModal();
    }
});

// Handle input for typing indicator
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('messageInput').addEventListener('input', handleTyping);
});
