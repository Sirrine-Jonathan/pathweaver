# Story Auto-Save & Management Feature Plan

## Overview

Implement auto-save functionality and a sidebar interface for managing saved stories. Users should be able to save stories as they progress, view all saved stories, and load any story at any step.

## Technical Decisions

### Storage Strategy

- **Solution**: IndexedDB via `@amitkhare/indexed-storage` package
- **Rationale**:
  - Much larger storage capacity than localStorage (50%+ of disk vs 5-10MB)
  - Promise-based API for easier async operations
  - Better for storing large conversation histories + component code
  - Can warn users when approaching storage limits

### What is a "Step"?

- **Definition**: One complete interaction cycle = User message → AI response (with optional component update)
- **Rationale**:
  - Natural unit for users to understand ("Step 5: You asked about the cave")
  - Clean save points after each AI response
  - Easy to preview and navigate
  - Aligns with how users think about story progression

### Auto-Save Triggers

- **When**: After each complete AI response (including tool calls)
- **What to Save**:
  ```typescript
  interface StoryStep {
    stepNumber: number;
    userMessage: ChatMessage;
    aiResponse: ChatMessage;
    componentCode?: string; // If AI created/updated component
    timestamp: Date;
  }
  ```

### LLM History Synchronization

- **Strategy**: Full history rebuild when loading a story at step N
- **Process**:
  1. Call `LLMService.clearHistory()` to reset
  2. Load all messages from steps 1 through N
  3. Replay them into LLMService via `addToHistory()` (make this public)
  4. Existing 20-message sliding window logic automatically applies
  5. Resume conversation from there
- **Benefit**: Ensures LLM has proper context with no state mismatch

## Data Structures

```typescript
interface Story {
  id: string;
  title: string;
  steps: StoryStep[];
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoryStep {
  stepNumber: number;
  userMessage: ChatMessage;
  aiResponse: ChatMessage;
  componentCode?: string;
  timestamp: Date;
}

interface StorySummary {
  id: string;
  title: string;
  stepCount: number;
  lastPlayed: Date;
  preview: string; // First 100 chars of latest AI response
}
```

## UI/UX Design

### Sidebar Layout

- **Position**: Left sidebar, 300px wide
- **Mobile**: Collapsible/overlay
- **Structure**:
  - "New Story" button at top
  - Scrollable story list (most recent first)
  - Active story highlighted and pinned to top
  - Storage usage indicator at bottom

### Story Item Display

Each story shows:

- Title (truncated, with tooltip for full text)
- Step count badge
- Last played timestamp (relative: "2 hours ago")
- Delete button (with confirmation)

### Story Accordion

- Click title to expand/collapse steps
- Active story expanded by default
- Shows all steps with truncated previews
- Current step highlighted differently
- Click any step to load story at that point

### Story Title Generation

- **Initial**: First 50 chars of user's first message
- **Fallback**: "Story from [date]" if no message yet
- **Feature**: Rename button (inline edit)

## Component Structure

### New Components

```
src/components/
├── StorySidebar.tsx       # Main sidebar container
│   ├── StoryList.tsx      # List of all stories
│   │   └── StoryItem.tsx  # Individual story accordion
│   │       └── StoryStepList.tsx  # Steps within story
│   │           └── StoryStepItem.tsx  # Individual step
│   └── StorageWarning.tsx # Low storage warning
```

### New Services

```
src/services/
├── storage.ts         # IndexedDB wrapper using @amitkhare/indexed-storage
└── storyManager.ts    # High-level story CRUD operations
```

### Updated Files

```
src/types.ts           # Add Story, StoryStep, StorySummary interfaces
src/services/llm.ts    # Expose addToHistory, clearHistory methods
src/App.tsx            # Integrate sidebar, handle story state
src/components/Chat.tsx # Trigger saves after AI responses
```

## Edge Cases & Error Handling

### Loading Story While One is Active

- Show confirmation modal: "Starting a new story will save your current progress. Continue?"
- Auto-save current story first
- Then load selected story

### Storage Full

- Monitor storage usage continuously
- Show warning banner at 80% capacity
- Provide easy delete interface
- Guide users to free up space

### First Run / No Stories

- Show helpful empty state
- Message: "No saved stories yet. Start your first adventure!"
- Highlight "Start Adventure" button

### Story Syncing

- Auto-save after every AI response
- Update both in-memory state and IndexedDB
- Show "Saving..." indicator briefly

### Failed Loads

- Show error message: "Failed to load story"
- Offer retry button
- Don't crash app, gracefully handle corruption

## Implementation Order

### Phase 1: Foundation (Setup & Types)

1. Install `@amitkhare/indexed-storage` dependency
2. Define types in `src/types.ts` (Story, StoryStep, StorySummary)
3. Create `src/services/storage.ts` with IndexedDB wrapper
4. Update `src/services/llm.ts` to expose history methods

### Phase 2: Story Management Service

5. Create `src/services/storyManager.ts` with CRUD operations
6. Implement storage quota monitoring
7. Add utility functions for step navigation

### Phase 3: UI Components

8. Build `StorySidebar.tsx` main container
9. Build `StoryList.tsx` and `StoryItem.tsx` components
10. Build `StoryStepList.tsx` and `StoryStepItem.tsx` components
11. Build `StorageWarning.tsx` component

### Phase 4: Integration

12. Update `App.tsx` to include sidebar in layout
13. Add active story state management
14. Connect story loading/saving handlers
15. Implement auto-save after AI responses in Chat component

### Phase 5: Polish & Testing

16. Add storage monitoring and warnings
17. Implement confirmation dialogs
18. Add loading states and error handling
19. Ensure mobile responsiveness
20. Test edge cases thoroughly

## Stretch Goals (Optional)

### Regenerate Response

- Add "↻" button next to each AI response in step list
- Delete everything after that step
- Resend previous user message to get new response
- **Complexity**: Medium
- **Value**: High (lets users explore different story branches)

### Quick Back Button

- Add "← Back" button in main UI
- Loads previous step of current story
- **Complexity**: Low (reuses step loading logic)
- **Value**: Medium (convenience feature)

### Export/Import Stories

- Export story as JSON file
- Import previously exported stories
- **Complexity**: Low
- **Value**: Medium (backup capability)

### Search/Filter Stories

- Search by title or content
- Filter by date, step count
- **Complexity**: Medium
- **Value**: Medium (useful with many stories)

## Success Criteria

- ✅ Stories automatically save after each AI response
- ✅ Sidebar displays all saved stories with previews
- ✅ Users can load any story at any step
- ✅ Active story is clearly indicated
- ✅ LLM context properly syncs when loading stories
- ✅ Storage warnings appear before running out of space
- ✅ UI is responsive on mobile devices
- ✅ No data loss during normal operation
- ✅ Graceful error handling for edge cases

## Testing Plan

1. **Auto-Save Testing**

   - Start new story, verify save after each response
   - Reload page, verify story persists
   - Check IndexedDB contains correct data

2. **Navigation Testing**

   - Load story at different steps
   - Verify LLM context is correct
   - Ensure component state matches step

3. **Edge Case Testing**

   - Fill storage to capacity
   - Try loading corrupted data
   - Switch between stories rapidly
   - Delete active story

4. **Mobile Testing**

   - Verify sidebar works on small screens
   - Test touch interactions
   - Ensure no layout breaks

5. **Performance Testing**
   - Test with 50+ stories
   - Test with stories of 100+ steps
   - Verify no UI lag
