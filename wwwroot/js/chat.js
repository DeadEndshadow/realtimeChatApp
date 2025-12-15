let connection = null;
let currentUsername = '';
let currentRoom = 'general';
let availableRooms = [];
let typingTimeout = null;
let isTyping = false;
let typingUsers = new Set();
let messageReactions = {};
const availableEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

// Notification settings
let notificationSound = null;
let notificationsEnabled = false;
let soundEnabled = true;

// Initialize notification sound (using Web Audio API to generate a notification sound)
function initNotificationSound() {
    soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
}

function playNotificationSound() {
    if (!soundEnabled) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('Could not play notification sound:', error);
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                localStorage.setItem('notificationsEnabled', 'true');
            }
        });
    }
}

function showDesktopNotification(sender, message) {
    if (!notificationsEnabled || document.hasFocus()) return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(`${sender} in ${currentRoom}`, {
            body: message.substring(0, 100),
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'chat-message',
            renotify: false
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 5000);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled', soundEnabled.toString());
    updateSoundButton();
}

function updateSoundButton() {
    const btn = document.getElementById('soundToggle');
    if (btn) {
        btn.textContent = soundEnabled ? '🔊' : '🔇';
        btn.title = soundEnabled ? 'Sound ON' : 'Sound OFF';
    }
}

// Relative time formatting
function getRelativeTime(timestamp) {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now - messageTime;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return messageTime.toLocaleDateString();
}

function updateRelativeTimestamps() {
    document.querySelectorAll('.message-time[data-timestamp]').forEach(element => {
        const timestamp = element.getAttribute('data-timestamp');
        element.textContent = getRelativeTime(timestamp);
    });
}

// Avatar and Dark Mode utilities
function getAvatarColor(username) {
    const colors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
        '#16a085', '#27ae60', '#2980b9', '#8e44ad',
        '#c0392b', '#d35400', '#7f8c8d', '#f1c40f'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(username) {
    return username.substring(0, 2).toUpperCase();
}

function createAvatar(username, size = 40) {
    const avatar = document.createElement('div');
    avatar.className = size === 32 ? 'user-avatar' : 'message-avatar';
    avatar.style.backgroundColor = getAvatarColor(username);
    avatar.textContent = getInitials(username);
    if (size !== 32) {
        avatar.style.width = size + 'px';
        avatar.style.height = size + 'px';
    }
    return avatar;
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
}

function loadDarkModePreference() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.textContent = '☀️';
    }
}

// Initialize SignalR connection
function initializeConnection() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Handle incoming messages
    connection.on("ReceiveMessage", (sender, message, timestamp, messageId) => {
        const isOwnMessage = sender === currentUsername;
        displayMessage(sender, message, timestamp, isOwnMessage, false, messageId);
        
        // Play notification sound and show desktop notification for messages from others
        if (!isOwnMessage) {
            playNotificationSound();
            showDesktopNotification(sender, message);
        }
    });

    // Handle private messages
    connection.on("ReceivePrivateMessage", (sender, message, timestamp) => {
        const isOwnMessage = sender.startsWith("To ");
        displayMessage(sender, message, timestamp, isOwnMessage, true);
        
        if (!isOwnMessage) {
            playNotificationSound();
            showDesktopNotification(sender, message);
        }
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

    // Handle message history
    connection.on("MessageHistory", (messages) => {
        messages.forEach(msg => {
            const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
            });
            displayMessage(msg.username, msg.message, timestamp, msg.username === currentUsername, false, msg.messageId);
        });
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

    // Handle rate limit errors
    connection.on("RateLimitError", (message) => {
        displaySystemMessage(`⚠️ ${message}`);
        const input = document.getElementById('messageInput');
        input.disabled = true;
        input.placeholder = "Rate limited...";
        
        // Re-enable after a short delay
        setTimeout(() => {
            input.disabled = false;
            input.placeholder = "Type your message...";
        }, 3000);
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
    
    // Create avatar
    const avatar = createAvatar(sender, 40);
    
    const reactionsHtml = messageId ? `
        <div class="message-reactions" id="reactions-${messageId}"></div>
        <button class="add-reaction-btn" onclick="showEmojiPicker(event, '${messageId}')">😀+</button>
    ` : '';
    
    // Parse timestamp - if it's just time (HH:mm:ss), convert to full date
    let fullTimestamp;
    if (timestamp.includes(':') && !timestamp.includes('T')) {
        // Time only format from server (HH:mm:ss)
        const today = new Date();
        const [hours, minutes, seconds] = timestamp.split(':');
        fullTimestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                                  parseInt(hours), parseInt(minutes), parseInt(seconds || 0));
    } else {
        // Full ISO timestamp from database
        fullTimestamp = new Date(timestamp);
    }
    
    const relativeTime = getRelativeTime(fullTimestamp);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.appendChild(avatar);
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${escapeHtml(sender)}</span>
            <span class="message-time" data-timestamp="${fullTimestamp.toISOString()}" title="${fullTimestamp.toLocaleString()}">${relativeTime}</span>
        </div>
        <div class="message-text">${escapeHtml(message)}</div>
        ${reactionsHtml}
    `;
    
    wrapper.appendChild(content);
    messageDiv.appendChild(wrapper);
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
    list.innerHTML = users.map(user => {
        const avatarHtml = `<div class="user-avatar" style="background-color: ${getAvatarColor(user)}">${getInitials(user)}</div>`;
        return `
            <div class="user-item">
                ${avatarHtml}
                <div class="user-info">
                    <span>${escapeHtml(user)}</span>
                    <div class="user-status"></div>
                </div>
            </div>
        `;
    }).join('');
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
    loadDarkModePreference();
    initNotificationSound();
    updateSoundButton();
    
    // Request notification permission after a short delay
    setTimeout(requestNotificationPermission, 2000);
    
    // Update relative timestamps every 30 seconds
    setInterval(updateRelativeTimestamps, 30000);
});
