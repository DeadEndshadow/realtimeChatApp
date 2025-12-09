using Microsoft.EntityFrameworkCore;
using RealtimeChat.Data;
using RealtimeChat.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add database
builder.Services.AddDbContext<ChatDbContext>(options =>
    options.UseSqlite("Data Source=chat.db"));

// Add SignalR
builder.Services.AddSignalR();

var app = builder.Build();

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
    db.Database.EnsureCreated();
}

// Configure static files
app.UseDefaultFiles();
app.UseStaticFiles();

// Map SignalR hub
app.MapHub<ChatHub>("/chatHub");

// Fallback to index.html
app.MapFallbackToFile("index.html");

Console.WriteLine("Chat server started! Open http://localhost:5000 in your browser.");

app.Run();
