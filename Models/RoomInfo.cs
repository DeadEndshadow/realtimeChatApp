namespace RealtimeChat.Models;

public class RoomInfo
{
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool IsPrivate { get; set; }
    public string Creator { get; set; } = "";
}
