# Error Recovery & Story Continuity Improvements

## Current Issues

1. **Story saves only AFTER AI response** - User messages are lost if AI fails
2. **No retry mechanism** - Errors require dismissing and retyping messages
3. **No checkpoint system** - Catastrophic failures could lose entire story
4. **Limited context preservation** - Story state may be inconsistent after errors

## Proposed Solutions

### 1. Immediate User Message Persistence

```typescript
// Save user message BEFORE sending to AI
handleUserMessage(message) {
  // Create pending step immediately
  await storyManager.createPendingStep(message);

  // Send to AI
  const response = await llmService.generate(message);

  // Complete the step with AI response
  await storyManager.completePendingStep(response);
}
```

### 2. Retry Mechanism

```typescript
// Store last failed request for retry
interface ErrorState {
  message: string;
  lastUserMessage?: ChatMessage;
  canRetry: boolean;
  retryAction?: () => Promise<void>;
}

// In error handler:
setError({
  message: errorMessage,
  lastUserMessage: lastMessage,
  canRetry: true,
  retryAction: () => retryLastMessage(lastMessage),
});
```

### 3. Automatic Checkpoints

```typescript
// Save checkpoint before risky operations
storyManager.createCheckpoint(); // Before each AI call
storyManager.restoreCheckpoint(); // On catastrophic failure
```

### 4. Graceful Degradation

```typescript
// Multiple fallback strategies
try {
  return await primaryModel.generate();
} catch (error) {
  if (isRateLimit(error)) {
    return await fallbackModel.generate();
  }
  if (isToolError(error)) {
    return await simpleTextOnlyGenerate();
  }
  // Always allow continuation
  return createRecoveryState();
}
```

### 5. Story Continuity Guarantees

- User messages saved immediately (never lost)
- Partial AI responses preserved when possible
- Component state cached for recovery
- Conversation history always intact
- Explicit "Continue Story" button after errors

## Implementation Priority

1. **HIGH**: Immediate user message persistence
2. **HIGH**: Retry mechanism with button
3. **MEDIUM**: Checkpoint system
4. **MEDIUM**: Graceful degradation for tool errors
5. **LOW**: Advanced recovery strategies

## Expected Benefits

✅ **Zero message loss** - User input never lost
✅ **One-click recovery** - Retry button for all errors
✅ **Consistent state** - Story always valid
✅ **Better UX** - Users can always continue
✅ **Confidence** - Users trust the system won't lose work
