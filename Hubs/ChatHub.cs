using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RealtimeChat.Data;
using RealtimeChat.Models;

namespace RealtimeChat.Hubs;

public class ChatHub : Hub
{
    private readonly ChatDbContext _dbContext;
    private static readonly Dictionary<string, string> ConnectedUsers = new();
    private static readonly Dictionary<string, string> UserRooms = new(); // ConnectionId -> RoomName
    private static readonly Dictionary<string, Dictionary<string, HashSet<string>>> MessageReactions = new();
    private static readonly Dictionary<string, RoomInfo> Rooms = new()
    {
        ["general"] = new RoomInfo { Name = "general", DisplayName = "#general", IsPrivate = false, Creator = "system" },
        ["random"] = new RoomInfo { Name = "random", DisplayName = "#random", IsPrivate = false, Creator = "system" },
        ["tech"] = new RoomInfo { Name = "tech", DisplayName = "#tech", IsPrivate = false, Creator = "system" }
    };

    public ChatHub(ChatDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task JoinChat(string username)
    {
        ConnectedUsers[Context.ConnectionId] = username;
        
        // Join default room
        await JoinRoom("general");
        
        // Send room list to caller
        await Clients.Caller.SendAsync("RoomList", GetRoomList());
    }

    public async Task JoinRoom(string roomName)
    {
        if (!ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        // Leave current room if in one
        if (UserRooms.TryGetValue(Context.ConnectionId, out var currentRoom))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, currentRoom);
            await Clients.Group(currentRoom).SendAsync("UserLeftRoom", username, currentRoom);
        }

        // Join new room
        roomName = roomName.ToLower().Replace("#", "");
        
        if (!Rooms.ContainsKey(roomName))
        {
            await Clients.Caller.SendAsync("Error", "Room does not exist");
            return;
        }

        UserRooms[Context.ConnectionId] = roomName;
        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
        
        // Notify room members
        await Clients.Group(roomName).SendAsync("UserJoinedRoom", username, roomName);
        
        // Send room info and users in room to caller
        var usersInRoom = UserRooms.Where(ur => ur.Value == roomName)
            .Select(ur => ConnectedUsers.TryGetValue(ur.Key, out var user) ? user : null)
            .Where(u => u != null)
            .ToList();
        
        // Load message history from database (last 50 messages)
        var messageHistory = await _dbContext.ChatMessages
            .Where(m => m.RoomName == roomName)
            .OrderByDescending(m => m.Timestamp)
            .Take(50)
            .OrderBy(m => m.Timestamp)
            .ToListAsync();
        
        await Clients.Caller.SendAsync("RoomJoined", Rooms[roomName], usersInRoom);
        
        // Send message history
        if (messageHistory.Any())
        {
            await Clients.Caller.SendAsync("MessageHistory", messageHistory);
        }
    }

    public async Task CreateRoom(string roomName, bool isPrivate)
    {
        if (!ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        roomName = roomName.ToLower().Replace("#", "").Trim();
        
        if (string.IsNullOrEmpty(roomName) || roomName.Length > 20)
        {
            await Clients.Caller.SendAsync("Error", "Invalid room name (1-20 characters)");
            return;
        }

        if (Rooms.ContainsKey(roomName))
        {
            await Clients.Caller.SendAsync("Error", "Room already exists");
            return;
        }

        var room = new RoomInfo
        {
            Name = roomName,
            DisplayName = isPrivate ? $"🔒 {roomName}" : $"#{roomName}",
            IsPrivate = isPrivate,
            Creator = username
        };

        Rooms[roomName] = room;
        
        // Broadcast new room to all users if public
        if (!isPrivate)
        {
            await Clients.All.SendAsync("RoomCreated", room);
        }
        else
        {
            await Clients.Caller.SendAsync("RoomCreated", room);
        }

        // Auto-join the creator
        await JoinRoom(roomName);
    }

    public async Task SendMessage(string message)
    {
        if (!ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        if (!UserRooms.TryGetValue(Context.ConnectionId, out var roomName))
            return;

        var messageId = $"msg_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        var now = DateTime.Now;
        var timestamp = now.ToString("HH:mm:ss");
        MessageReactions[messageId] = new Dictionary<string, HashSet<string>>();
        
        // Save to database
        var chatMessage = new ChatMessage
        {
            Username = username,
            Message = message,
            RoomName = roomName,
            Timestamp = now,
            MessageId = messageId
        };
        
        _dbContext.ChatMessages.Add(chatMessage);
        await _dbContext.SaveChangesAsync();
        
        await Clients.Group(roomName).SendAsync("ReceiveMessage", username, message, timestamp, messageId);
    }

    public async Task SendPrivateMessage(string targetUser, string message)
    {
        if (ConnectedUsers.TryGetValue(Context.ConnectionId, out var senderUsername))
        {
            var targetConnection = ConnectedUsers.FirstOrDefault(x => x.Value == targetUser).Key;
            
            if (!string.IsNullOrEmpty(targetConnection))
            {
                var timestamp = DateTime.Now.ToString("HH:mm:ss");
                await Clients.Client(targetConnection).SendAsync("ReceivePrivateMessage", senderUsername, message, timestamp);
                await Clients.Caller.SendAsync("ReceivePrivateMessage", $"To {targetUser}", message, timestamp);
            }
        }
    }

    public async Task StartTyping()
    {
        if (!ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        if (UserRooms.TryGetValue(Context.ConnectionId, out var roomName))
        {
            await Clients.OthersInGroup(roomName).SendAsync("UserTyping", username);
        }
    }

    public async Task StopTyping()
    {
        if (!ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        if (UserRooms.TryGetValue(Context.ConnectionId, out var roomName))
        {
            await Clients.OthersInGroup(roomName).SendAsync("UserStoppedTyping", username);
        }
    }

    public async Task ToggleReaction(string messageId, string emoji)
    {
        if (!ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        if (!MessageReactions.ContainsKey(messageId))
            MessageReactions[messageId] = new Dictionary<string, HashSet<string>>();

        var reactions = MessageReactions[messageId];
        
        if (!reactions.ContainsKey(emoji))
            reactions[emoji] = new HashSet<string>();

        // Toggle: add if not present, remove if present
        if (reactions[emoji].Contains(username))
            reactions[emoji].Remove(username);
        else
            reactions[emoji].Add(username);

        // Clean up empty reaction sets
        if (reactions[emoji].Count == 0)
            reactions.Remove(emoji);

        // Send updated reactions to all clients
        var reactionData = reactions.ToDictionary(
            r => r.Key,
            r => new { count = r.Value.Count, users = r.Value.ToList() }
        );
        
        await Clients.All.SendAsync("ReactionUpdated", messageId, reactionData);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ConnectedUsers.TryGetValue(Context.ConnectionId, out var username))
        {
            if (UserRooms.TryGetValue(Context.ConnectionId, out var roomName))
            {
                await Clients.Group(roomName).SendAsync("UserLeftRoom", username, roomName);
                UserRooms.Remove(Context.ConnectionId);
            }
            
            ConnectedUsers.Remove(Context.ConnectionId);
        }
        
        await base.OnDisconnectedAsync(exception);
    }

    private List<RoomInfo> GetRoomList()
    {
        return Rooms.Values.Where(r => !r.IsPrivate).ToList();
    }
}
