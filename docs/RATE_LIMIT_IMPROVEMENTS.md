# Rate Limit Improvements

## Overview

We've significantly improved rate limit handling and user experience to provide proactive monitoring and better feedback when API limits are approached or reached.

## Key Improvements

### 1. Proactive Rate Limit Monitoring

**What Changed:**

- Server now parses rate limit headers from EVERY Groq API response
- Headers include: remaining requests/tokens, limits, and reset times
- This data is sent to the client in real-time

**Why It Matters:**

- We can warn users BEFORE hitting limits (< 20% capacity)
- Shows exactly how many requests/tokens remain
- Better capacity planning and user awareness

**Headers Parsed:**

```javascript
x-ratelimit-limit-requests: 14400      // Total daily requests allowed
x-ratelimit-limit-tokens: 18000        // Total tokens per minute
x-ratelimit-remaining-requests: 14370  // Requests left today
x-ratelimit-remaining-tokens: 17997    // Tokens left this minute
x-ratelimit-reset-requests: 2m59.56s   // When request limit resets
x-ratelimit-reset-tokens: 7.66s        // When token limit resets
```

### 2. Enhanced UX Feedback

**Warning Display (Yellow Banner):**

- Appears when capacity falls below 20%
- Shows percentage remaining
- Displays specific limits on desktop (requests/tokens)
- Helps users understand they're approaching limits

**Capacity Indicator:**

- Always shows current capacity percentage in status bar
- Non-intrusive on desktop, compact on mobile
- Only shows warning banner when critical (< 20%)

**Example States:**

```
Normal Operation:
┌─────────────────────────────────────┐
│ llama-3.3-70b-versatile • 85% cap   │ ← Status bar only
└─────────────────────────────────────┘

Low Capacity Warning:
┌─────────────────────────────────────┐
│ ⚠️ API Capacity Low: 15% remaining  │ ← Yellow warning banner
│    (2,160/14,400 requests, 2.7K/    │
│     18K tokens)                      │
└─────────────────────────────────────┘
│ llama-3.3-70b-versatile • 15% cap   │ ← Status bar
└─────────────────────────────────────┘
```

### 3. Improved Model Fallback Messages

**Before:**

- Blue "Switching Models" banner with no context
- Users didn't understand why models changed

**After:**

- Clear explanation of model switches
- Shows which model is being used
- Distinguishes between:
  - Proactive model switches (blue, quick)
  - Rate limit waits (orange, with countdown)

**Example Messages:**

```
Proactive Switch:
"Switching Models - Using llama-3.1-8b-instant instead"

Rate Limited (all models exhausted):
"Rate Limited (llama-3.3-70b-versatile)
 Retrying in 32m 45s"
```

## Technical Implementation

### Server-Side (`server/index.js`)

```javascript
// Parse headers after EVERY request
const rateLimitHeaders = {
  limitRequests: response.headers.get("x-ratelimit-limit-requests"),
  limitTokens: response.headers.get("x-ratelimit-limit-tokens"),
  remainingRequests: response.headers.get("x-ratelimit-remaining-requests"),
  remainingTokens: response.headers.get("x-ratelimit-remaining-tokens"),
  resetRequests: response.headers.get("x-ratelimit-reset-requests"),
  resetTokens: response.headers.get("x-ratelimit-reset-tokens"),
};

// Calculate percentages and emit to client
const requestsPercentage = (remainingReqs / limitReqs) * 100;
const tokensPercentage = (remainingTokens / limitTokens) * 100;
const isLowCapacity = requestsPercentage < 20 || tokensPercentage < 20;

socket.emit("rate_limit_status", {
  model: currentModel,
  limits: { requests: limitReqs, tokens: limitTokens },
  remaining: { requests: remainingReqs, tokens: remainingTokens },
  percentage: { requests: requestsPercentage, tokens: tokensPercentage },
  resetTime: { requests: resetRequests, tokens: resetTokens },
  warning: isLowCapacity,
});
```

### Client-Side Types (`src/types.ts`)

```typescript
export interface RateLimitStatus {
  model: string;
  limits: {
    requests: number;
    tokens: number;
  };
  remaining: {
    requests: number;
    tokens: number;
  };
  percentage: {
    requests: number;
    tokens: number;
  };
  resetTime: {
    requests: string;
    tokens: string;
  };
  warning: boolean; // true when < 20% capacity
}
```

### LLM Service (`src/services/llm.ts`)

```typescript
// New callback for rate limit status
static setRateLimitStatusCallback(
  callback: (status: RateLimitStatus) => void
) {
  this.rateLimitStatusCallback = callback;
}

// Listen for rate_limit_status events
socket.on("rate_limit_status", handleRateLimitStatus);

const handleRateLimitStatus = (data: any) => {
  if (this.rateLimitStatusCallback) {
    this.rateLimitStatusCallback(data);
  }
};
```

### UI Components (`src/App.tsx`)

**State Management:**

```typescript
const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(
  null
);

// Setup callback in useEffect
LLMService.setRateLimitStatusCallback((status) => {
  setRateLimitStatus(status);
});
```

**Warning Banner (shows when < 20%):**

```jsx
{
  rateLimitStatus && rateLimitStatus.warning && (
    <div className="bg-yellow-50 border-t border-yellow-200">
      <div className="p-3 flex items-center justify-center space-x-2">
        <svg>⚠️</svg>
        <div className="text-xs">
          <span className="font-semibold">API Capacity Low:</span>
          <span>{Math.min(percentage).toFixed(0)}% remaining</span>
          <span className="hidden sm:inline">
            ({remaining.requests}/{limits.requests} requests,
            {remaining.tokens}K/{limits.tokens}K tokens)
          </span>
        </div>
      </div>
    </div>
  );
}
```

**Status Bar (always shows):**

```jsx
{
  currentModelName && (
    <div className="bg-slate-800 text-center p-2 text-xs text-white">
      {currentModelName}
      {rateLimitStatus && !rateLimitStatus.warning && (
        <span className="ml-2 text-slate-400">
          • {Math.min(percentage).toFixed(0)}% capacity
        </span>
      )}
    </div>
  );
}
```

## Benefits

### For Users

1. **No Surprises**: See capacity before hitting limits
2. **Better Understanding**: Know exactly what limits apply
3. **Informed Decisions**: Can pace usage or wait for resets
4. **Clear Communication**: Understand model switches and waits

### For Development

1. **Better Debugging**: See exact capacity in real-time
2. **Proactive Monitoring**: Catch issues before they become problems
3. **Usage Insights**: Understand API consumption patterns
4. **Future Planning**: Data for implementing request queuing/throttling

## Groq API Rate Limits Reference

### Free Tier Limits (Most Restrictive)

| Model                   | RPD    | TPM | TPD  |
| ----------------------- | ------ | --- | ---- |
| llama-3.3-70b-versatile | 1,000  | 12K | 100K |
| llama-3.1-8b-instant    | 14,400 | 6K  | 500K |

**Key Insight:** The 8b model has 14x more daily requests! Consider using it as primary for free tier.

### Rate Limit Headers Always Present

```
x-ratelimit-limit-requests     // Daily request limit
x-ratelimit-limit-tokens       // Per-minute token limit
x-ratelimit-remaining-requests // Requests left today
x-ratelimit-remaining-tokens   // Tokens left this minute
x-ratelimit-reset-requests     // Time until daily reset
x-ratelimit-reset-tokens       // Time until minute reset
```

### Understanding the Limits

**You hit whichever limit comes first:**

- If RPD = 50 and TPM = 200K:
  - 50 requests with 100 tokens each = Rate limited (hit RPM)
  - Even though you only used 5K tokens (well under 200K)

**Our Strategy:**

1. Parse headers on every response
2. Warn at 20% remaining capacity
3. Show exact numbers to help users understand
4. Use model fallback when limits hit

## Future Enhancements

### Potential Improvements

1. **Request Queuing**: Queue requests when approaching limits
2. **Auto-Throttling**: Slow down requests to stay under TPM
3. **Smart Caching**: Cache/reuse responses for repeated queries
4. **Usage Analytics**: Track and visualize API usage over time
5. **Tier Detection**: Auto-detect free vs paid tier for better defaults

### Predictive Features

- Estimate time until limit based on usage pattern
- Suggest optimal model for current capacity
- Auto-switch to high-capacity models when low
- Warn before starting interactions that might hit limits

## Testing

To test the improvements:

1. **Start the app**: `npm run dev`
2. **Use the app normally** - rate limit status appears automatically
3. **Watch for warnings** when capacity drops below 20%
4. **Check status bar** to see current capacity percentage
5. **Look for model switches** when approaching/hitting limits

## Conclusion

These improvements transform rate limit handling from reactive (dealing with errors) to proactive (preventing them). Users now have visibility into API capacity and understand what's happening when limits are reached.

The system now provides:

- ✅ Real-time capacity monitoring
- ✅ Proactive warnings (< 20% capacity)
- ✅ Clear, contextual messaging
- ✅ Better model fallback communication
- ✅ Detailed capacity information for debugging

This creates a significantly better user experience and sets the foundation for future smart rate limit management features.
