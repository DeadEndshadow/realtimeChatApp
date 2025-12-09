# 💬 Realtime Chat Application

A modern, feature-rich real-time chat application built with ASP.NET Core, SignalR, and vanilla JavaScript.

## ✨ Features

### Core Functionality
- **Real-time messaging** - Instant message delivery using SignalR WebSockets
- **Multiple chat rooms** - Join #general, #random, #tech or create your own
- **Private rooms** - Create private rooms visible only to you
- **Typing indicators** - See when other users are typing
- **Message reactions** - React to messages with emojis (👍 ❤️ 😂 😮 😢 🎉)
- **User presence** - See who's online in each room

### User Experience
- **Modern UI** - Clean, gradient-based design with smooth animations
- **Responsive layout** - Works on desktop and mobile devices
- **Room switching** - Instantly switch between different chat rooms
- **Visual feedback** - Connection status, typing indicators, and more

## 🚀 Getting Started

### Prerequisites
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd realtimeChat
```

2. Run the application:
```bash
dotnet run --urls "http://localhost:5000"
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

### Usage

1. **Join the chat** - Enter a username to join
2. **Switch rooms** - Click on any room in the sidebar to join it
3. **Create a room** - Click "+ Create Room" to make your own public or private room
4. **Send messages** - Type and press Enter or click Send
5. **React to messages** - Hover over a message and click the 😀+ button to add reactions
6. **See who's typing** - Watch for typing indicators at the bottom of the chat

## 🏗️ Project Structure

```
realtimeChat/
├── Hubs/
│   └── ChatHub.cs          # SignalR hub for real-time communication
├── Models/
│   └── RoomInfo.cs         # Room data model
├── wwwroot/
│   ├── index.html          # Main HTML page
│   ├── css/
│   │   └── style.css       # Application styles
│   └── js/
│       └── chat.js         # Client-side JavaScript logic
├── Program.cs              # Application entry point
├── RealtimeChat.csproj     # Project configuration
├── appsettings.json        # Application settings
└── README.md               # This file
```

## 🛠️ Technology Stack

- **Backend**: ASP.NET Core 8.0
- **Real-time**: SignalR
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Communication**: WebSockets

## 📋 Architecture

### Server-Side
- **ChatHub.cs** - SignalR hub handling all real-time communication
- **RoomInfo.cs** - Model class for room data

#### Hub Methods
- `JoinChat(username)` - Register a user and join default room
- `JoinRoom(roomName)` - Switch to a different room
- `CreateRoom(roomName, isPrivate)` - Create a new chat room
- `SendMessage(message)` - Broadcast message to current room
- `StartTyping()` / `StopTyping()` - Notify room members of typing status
- `ToggleReaction(messageId, emoji)` - Add/remove emoji reactions

### Client-Side
- **index.html** - Clean HTML structure
- **style.css** - Complete application styling
- **chat.js** - All client-side logic including:
  - SignalR connection management
  - Room management UI
  - Message display and reactions
  - Typing indicators
  - User interface interactions

## 🎨 Features in Detail

### Chat Rooms
- **Default Rooms**: #general, #random, #tech
- **Custom Rooms**: Create unlimited public rooms
- **Private Rooms**: Create rooms visible only to you (🔒 prefix)
- **Room Switching**: One-click navigation between rooms
- **Room-Scoped**: Messages and typing indicators are isolated per room

### Message Reactions
- Click 😀+ on any message to add a reaction
- Choose from: 👍 ❤️ 😂 😮 😢 🎉
- Click again to remove your reaction
- Hover to see who reacted
- Real-time updates across all clients

### Typing Indicators
- Shows "[User] is typing..." when someone is composing
- Automatically clears after 2 seconds of inactivity
- Handles multiple users typing simultaneously
- Room-specific (only see typing in your current room)

## 🔮 Future Enhancements

See [TODO.md](TODO.md) for planned features including:
- Message history with database storage
- User avatars
- Dark mode
- File/image sharing
- Markdown support
- User authentication
- And much more!

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is open source and available under the MIT License.

## 👨‍💻 Development

### Running in Development
```bash
dotnet watch run --urls "http://localhost:5000"
```

### Building for Production
```bash
dotnet publish -c Release -o ./publish
```

### Testing
Open multiple browser tabs or windows to simulate multiple users and test:
- Real-time message delivery
- Room switching
- Typing indicators
- Message reactions
- User presence

## 🐛 Troubleshooting

**Port already in use?**
```bash
# Kill existing process
pkill -f "dotnet.*realtimeChat"

# Or use a different port
dotnet run --urls "http://localhost:5001"
```

**Connection issues?**
- Check that the server is running
- Ensure no firewall is blocking port 5000
- Try refreshing the browser page

## 📧 Contact

For questions or feedback, please open an issue in the repository.

---

Built with ❤️ using ASP.NET Core and SignalR
