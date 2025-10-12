# Model Fallback System

## Overview

The server now implements an intelligent model fallback system that automatically switches to alternative models when rate limits are encountered, instead of waiting for the rate limit to clear.

## Fallback Priority List

When a 429 rate limit error occurs, the system tries models in this order:

1. **llama-3.3-70b-versatile** (Primary)

   - Best quality and capability
   - Lower rate limits (100K tokens/day on free tier)
   - Used by default

2. **llama-3.1-8b-instant** (Fallback 1)

   - Faster responses
   - Higher rate limits
   - Good for most interactions

3. **mixtral-8x7b-32768** (Fallback 2)

   - Alternative architecture
   - Large context window (32K tokens)
   - Different rate limit pool

4. **gemma2-9b-it** (Fallback 3)
   - Additional fallback option
   - Separate rate limit pool

## How It Works

### Rate Limit Detection

When the server receives a 429 error from Groq:

```
Rate limit reached for model `llama-3.3-70b-versatile` in organization...
Limit 100000, Used 100076, Requested 2185.
Please try again in 32m34.341s.
```

### Automatic Fallback

Instead of waiting 32+ minutes:

1. Server immediately switches to the next model in the fallback list
2. Retries the request with the new model
3. If that model is also rate limited, tries the next one
4. Only waits if all models in the list are exhausted

### Client Notification

The client receives WebSocket events:

```javascript
socket.on("rate_limit", (data) => {
  // data.switchedModel: true if switching models
  // data.currentModel: the new model being used
  // data.retryAfter: 0 for model switch, or seconds to wait
});

socket.on("retry_success", (data) => {
  // data.modelUsed: which model succeeded
  // data.message: success message
});
```

## Implementation Details

### Model Selection

```javascript
// Start with primary model or use provided model if in fallback list
let currentModel =
  model && MODEL_FALLBACK_LIST.includes(model) ? model : MODEL_FALLBACK_LIST[0];
```

### Fallback Function

```javascript
function getNextModel(currentModel) {
  const currentIndex = MODEL_FALLBACK_LIST.indexOf(currentModel);
  if (currentIndex === -1 || currentIndex >= MODEL_FALLBACK_LIST.length - 1) {
    return null; // No more fallback models
  }
  return MODEL_FALLBACK_LIST[currentIndex + 1];
}
```

### Retry Logic

```javascript
if (response.status === 429) {
  const nextModel = getNextModel(currentModel);

  if (nextModel) {
    // Switch to fallback model and retry immediately
    requestBody.model = nextModel;
    currentModel = nextModel;
    // Retry...
  } else {
    // All models exhausted, wait for rate limit
    await new Promise((resolve) =>
      setTimeout(resolve, retryAfterSeconds * 1000)
    );
    // Retry with same model...
  }
}
```

## Coverage

The fallback system applies to:

- ✅ Initial chat requests
- ✅ Follow-up requests (tool calls)
- ✅ Nested fallbacks (if first fallback also hits limit)

## Benefits

1. **Minimal Downtime**: Usually switches models in <1 second vs waiting 30+ minutes
2. **Seamless Experience**: Users may not even notice the switch
3. **Quality Preservation**: Tries best models first, falls back only when needed
4. **Rate Limit Distribution**: Spreads load across different model pools

## Testing

To test the fallback system:

1. Use the app until you hit the primary model's rate limit
2. The server will automatically switch to `llama-3.1-8b-instant`
3. Check server logs to see model switching messages:
   ```
   Rate limited on llama-3.3-70b-versatile. Switching to fallback model: llama-3.1-8b-instant
   ```

## Future Enhancements

Potential improvements:

- Add model quality metrics to track performance differences
- Implement smart model selection based on request complexity
- Add user preference for primary model
- Cache responses to reduce API calls
- Implement request queuing during high load
