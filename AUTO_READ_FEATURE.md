# Auto-Read Feature Implementation

## Overview

Successfully implemented an auto-read feature for the Pathweaver interactive storytelling game that uses browser-based Text-to-Speech (TTS) to narrate the story as it progresses.

## Features Implemented

### 1. TTS Service (`src/services/tts.ts`)

- Browser-based speech synthesis using Web Speech API
- Automatic voice detection and categorization (Male/Female)
- Support for multiple English voices across different browsers
- Settings persistence using localStorage
- Disabled by default as requested

### 2. Settings Component (`src/components/Settings.tsx`)

- Modal dialog with settings controls
- Toggle switch to enable/disable auto-read feature
- Separate dropdown menus for Male and Female English voices
- "Test Voice" button to preview selected voice
- Information section explaining the feature

### 3. UI Integration (`src/App.tsx`)

- Settings icon button in the header (gear icon)
- Settings modal integrated into the app
- Clean, accessible interface

### 4. Auto-Read Integration (`src/services/llm.ts`)

- Automatic narration of story text from LLM responses
- Only reads actual narrative content (filters out system messages)
- Integrates seamlessly with the existing story flow

### 5. Type Definitions (`src/types.ts`)

- `TTSSettings` interface for storing user preferences
- `Voice` interface for voice metadata (name, gender, locale)

## User Experience

1. **Accessing Settings**: Click the gear icon in the top-right header
2. **Enabling Auto-Read**: Toggle the switch to enable the feature
3. **Selecting Voice**:
   - Choose from Female Voices dropdown
   - Choose from Male Voices dropdown
   - Each voice shows its locale (e.g., en-US, en-GB)
4. **Testing Voice**: Click "Test Voice" to hear a sample
5. **Saving**: Settings are automatically saved to localStorage
6. **Skipping Narration**: When narration is playing, a "Skip" button appears next to the message input
7. **Auto-Cancellation**: Narration automatically stops when you send a new message

## Default Behavior

- Feature is **disabled by default**
- Default voice: "Google US English Female"
- Settings persist across browser sessions

## Technical Details

### Voice Selection

The service detects available voices from the browser and filters for English-speaking voices only. Common voices include:

- **Female**: Google US/UK English Female, Microsoft Zira, Microsoft Hazel
- **Male**: Google US/UK English Male, Microsoft David, Microsoft George

### Browser Compatibility

- Uses Web Speech API (speechSynthesis)
- Works in all modern browsers (Chrome, Edge, Safari, Firefox)
- Gracefully handles browsers without TTS support

### Storage

User preferences are stored in localStorage with the key: `pathweaver-tts-settings`

## Files Modified/Created

### New Files

- `src/services/tts.ts` - TTS service implementation
- `src/components/Settings.tsx` - Settings modal component
- `AUTO_READ_FEATURE.md` - This documentation

### Modified Files

- `src/types.ts` - Added TTS-related types
- `src/App.tsx` - Integrated settings UI
- `src/services/llm.ts` - Added TTS integration for narration

## Usage Example

```typescript
// The TTS service is automatically used when:
// 1. User enables the feature in settings
// 2. LLM generates narrative text
// 3. Text is automatically spoken using selected voice

// Manual usage (if needed):
import { ttsService } from "./services/tts";

// Speak text
ttsService.speak("Hello, welcome to the adventure!");

// Stop current speech
ttsService.stop();

// Check if enabled
const settings = ttsService.getSettings();
console.log(settings.enabled); // true/false
```

## Future Enhancements (Optional)

- Playback speed control
- Volume control
- Pitch adjustment
- Voice preview with custom text
- Language selection beyond English
- Backend TTS integration using edge-tts (as referenced in /Users/jsirrine/dev/user-workspace/auraflow/backend/services/ttsService.js)

## Testing

The development server is running at http://localhost:5173/

1. Start the game
2. Click the gear icon in the header
3. Enable "Auto-Read Narration"
4. Select a voice
5. Test the voice with the button
6. Close settings and continue playing
7. Narrative text should now be read aloud automatically
