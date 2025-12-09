using RealtimeChat.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add SignalR
builder.Services.AddSignalR();

var app = builder.Build();

// Configure static files
app.UseDefaultFiles();
app.UseStaticFiles();

// Map SignalR hub
app.MapHub<ChatHub>("/chatHub");

// Fallback to index.html
app.MapFallbackToFile("index.html");

Console.WriteLine("Chat server started! Open http://localhost:5000 in your browser.");

app.Run();
