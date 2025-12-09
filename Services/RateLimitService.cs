using System.Collections.Concurrent;

namespace RealtimeChat.Services;

public class RateLimitService
{
    private readonly ConcurrentDictionary<string, UserRateLimit> _rateLimits = new();
    private readonly int _maxMessagesPerWindow;
    private readonly TimeSpan _timeWindow;
    private readonly TimeSpan _banDuration;

    public RateLimitService(int maxMessagesPerWindow = 10, int timeWindowSeconds = 10, int banDurationSeconds = 30)
    {
        _maxMessagesPerWindow = maxMessagesPerWindow;
        _timeWindow = TimeSpan.FromSeconds(timeWindowSeconds);
        _banDuration = TimeSpan.FromSeconds(banDurationSeconds);
    }

    public RateLimitResult CheckRateLimit(string userId)
    {
        var userLimit = _rateLimits.GetOrAdd(userId, _ => new UserRateLimit());
        var now = DateTime.UtcNow;

        lock (userLimit)
        {
            // Check if user is currently banned
            if (userLimit.IsBanned && now < userLimit.BanExpiry)
            {
                var remainingBanTime = (userLimit.BanExpiry - now).TotalSeconds;
                return new RateLimitResult 
                { 
                    IsAllowed = false, 
                    Reason = $"You are temporarily banned for {Math.Ceiling(remainingBanTime)} seconds due to spam.",
                    IsBanned = true,
                    RemainingTime = remainingBanTime
                };
            }

            // Unban if ban period has expired
            if (userLimit.IsBanned && now >= userLimit.BanExpiry)
            {
                userLimit.IsBanned = false;
                userLimit.MessageTimestamps.Clear();
            }

            // Remove old timestamps outside the time window
            userLimit.MessageTimestamps.RemoveAll(ts => now - ts > _timeWindow);

            // Check if user has exceeded the limit
            if (userLimit.MessageTimestamps.Count >= _maxMessagesPerWindow)
            {
                // Ban the user
                userLimit.IsBanned = true;
                userLimit.BanExpiry = now.Add(_banDuration);
                userLimit.MessageTimestamps.Clear();

                return new RateLimitResult 
                { 
                    IsAllowed = false, 
                    Reason = $"Rate limit exceeded! You have been temporarily banned for {_banDuration.TotalSeconds} seconds.",
                    IsBanned = true,
                    RemainingTime = _banDuration.TotalSeconds
                };
            }

            // Add current timestamp and allow the message
            userLimit.MessageTimestamps.Add(now);
            var remainingMessages = _maxMessagesPerWindow - userLimit.MessageTimestamps.Count;
            
            return new RateLimitResult 
            { 
                IsAllowed = true,
                RemainingMessages = remainingMessages
            };
        }
    }

    public void ResetRateLimit(string userId)
    {
        if (_rateLimits.TryRemove(userId, out var userLimit))
        {
            lock (userLimit)
            {
                userLimit.MessageTimestamps.Clear();
                userLimit.IsBanned = false;
            }
        }
    }

    private class UserRateLimit
    {
        public List<DateTime> MessageTimestamps { get; } = new();
        public bool IsBanned { get; set; }
        public DateTime BanExpiry { get; set; }
    }
}

public class RateLimitResult
{
    public bool IsAllowed { get; set; }
    public string Reason { get; set; } = string.Empty;
    public bool IsBanned { get; set; }
    public double RemainingTime { get; set; }
    public int RemainingMessages { get; set; }
}
