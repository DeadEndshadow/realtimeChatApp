# Testing Rate Limiting & Encryption

## Quick Test Guide

### Test Rate Limiting (Anti-Spam)

1. **Open the chat**: Navigate to http://localhost:5000
2. **Join as a user**: Enter any username and join
3. **Spam test**: Copy this text and paste it rapidly, pressing Enter after each:
   ```
   Test 1
   Test 2
   Test 3
   Test 4
   Test 5
   Test 6
   Test 7
   Test 8
   Test 9
   Test 10
   Test 11
   ```
4. **Expected Result**:
   - After message 10, you should see: "⚠️ Rate limit exceeded! You have been temporarily banned for 30 seconds."
   - Message input becomes disabled with gray background
   - Placeholder changes to "Rate limited..."
   - After 30 seconds, input re-enables automatically

### Test Message Encryption

1. **Send messages**: Send several messages through the chat
2. **Check database**: Open a terminal and run:
   ```bash
   sqlite3 chat.db
   SELECT Username, Message, RoomName FROM ChatMessages LIMIT 5;
   .exit
   ```
3. **Expected Result**:
   - Messages in the database are Base64-encoded encrypted strings
   - Example: `SGVsbG8gV29ybGQ=` instead of `Hello World`
   
4. **Verify decryption works**:
   - Switch to a different room (e.g., #random)
   - Switch back to #general
   - Message history loads correctly with plain text visible
   - All old messages display properly

### Advanced Testing

#### Test Rate Limit Parameters
Messages allowed: 10 per 10 seconds
- Send 9 messages rapidly → Should work
- Send 10th message → Should work
- Send 11th message → Should be blocked

#### Test Encryption/Decryption Cycle
```bash
# View raw encrypted data
sqlite3 chat.db "SELECT Message FROM ChatMessages WHERE RoomName='general' ORDER BY Timestamp DESC LIMIT 1;"

# Should see Base64 string, not plain text
```

#### Test Multiple Users
1. Open chat in two browser windows (or incognito)
2. Have both users spam messages
3. Each user has their own rate limit (tracked by connection)
4. Messages from other users remain visible

## Verification Checklist

### Rate Limiting ✓
- [ ] Can send 10 messages in quick succession
- [ ] 11th message triggers rate limit warning
- [ ] Input field gets disabled visually
- [ ] System message appears in chat
- [ ] Auto re-enables after 30 seconds
- [ ] Other users not affected

### Message Encryption ✓
- [ ] Messages stored as Base64 in database
- [ ] Messages display correctly in chat
- [ ] History loads with decrypted messages
- [ ] New and old messages both work
- [ ] No error messages in console

## Configuration Testing

To test different rate limit settings, edit `Program.cs`:

```csharp
// More restrictive (3 messages per 5 seconds, 60 second ban)
builder.Services.AddSingleton<RateLimitService>(sp => 
    new RateLimitService(maxMessagesPerWindow: 3, timeWindowSeconds: 5, banDurationSeconds: 60));

// More lenient (20 messages per 15 seconds, 10 second ban)
builder.Services.AddSingleton<RateLimitService>(sp => 
    new RateLimitService(maxMessagesPerWindow: 20, timeWindowSeconds: 15, banDurationSeconds: 10));
```

Then rebuild and restart:
```bash
dotnet build
dotnet run
```

## Troubleshooting

### Rate Limiting Not Working
- Check browser console for errors
- Verify `RateLimitError` event handler is registered
- Check server logs for exceptions

### Messages Not Encrypted
- Verify `EncryptionService` is registered in `Program.cs`
- Check database: messages should be Base64
- Look for encryption errors in server logs

### Messages Not Decrypting
- Ensure encryption key hasn't changed
- Check for decryption errors in server logs
- Verify message format in database

## Performance Monitoring

Watch server logs while testing:
- Rate limit checks are logged
- Database operations show timing
- Any encryption errors appear in logs

Normal operation should show:
```
info: Microsoft.EntityFrameworkCore.Database.Command[20101]
      Executed DbCommand (1ms) [Parameters=[], CommandType='Text', CommandTimeout='30']
      INSERT INTO "ChatMessages" ...
```

## Database Inspection

Useful SQLite commands:
```bash
# Open database
sqlite3 chat.db

# View encrypted messages
SELECT Username, substr(Message, 1, 20) || '...' as EncryptedMsg, Timestamp 
FROM ChatMessages 
ORDER BY Timestamp DESC 
LIMIT 10;

# Count messages per room
SELECT RoomName, COUNT(*) FROM ChatMessages GROUP BY RoomName;

# Exit
.exit
```
