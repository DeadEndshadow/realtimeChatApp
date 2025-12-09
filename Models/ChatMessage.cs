namespace RealtimeChat.Models;

public class ChatMessage
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string Message { get; set; } = "";
    public string RoomName { get; set; } = "";
    public DateTime Timestamp { get; set; }
    public string MessageId { get; set; } = "";
}
