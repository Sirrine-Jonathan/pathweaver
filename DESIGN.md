# Pathweaver - Conversational Interactive Storytelling

## Project Overview
Pathweaver is a web-based conversational game where users interact directly with an LLM that acts as a master storyteller and game master. The LLM manages all game elements dynamically through conversation, with minimal hardcoded mechanics.

## Core Concept
- **Pure Conversational Interface**: Chat-based interaction with the LLM storyteller
- **LLM as Game Master**: AI handles all story elements, character management, inventory, puzzles
- **User-Configured LLM**: Users provide their own LLM API keys and model preferences
- **Web-Based**: Hosted on Netlify with serverless backend

## Technical Architecture

### Web Application Stack
- **Frontend**: React + TypeScript SPA
- **Hosting**: Netlify (static site + serverless functions)
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: Supabase Auth
- **LLM Integration**: Direct API calls to user-configured LLM providers

### Core Components

#### 1. Chat Interface (`src/components/`)
```
ChatInterface
├── MessageDisplay     # Conversation history with rich formatting
├── InputArea          # User message input with send controls
├── GameStatePanel     # Optional sidebar showing current character/inventory
└── SettingsPanel      # LLM configuration and game preferences
```

#### 2. LLM Integration (`src/services/`)
```
LLMService
├── ProviderAdapters   # OpenAI, Anthropic, local model adapters
├── ConversationManager # Message history and context management
├── GamePromptManager  # System prompts for storytelling
└── ResponseParser     # Extract game state from LLM responses
```

#### 3. User Management (`src/auth/`)
```
UserSystem
├── AuthProvider       # Supabase authentication
├── UserProfile        # User preferences and settings
├── GameSessions       # Save/load conversation sessions
└── LLMConfig          # Secure storage of API keys
```

## Data Architecture

### Database Schema (Supabase)
```sql
-- Users table (handled by Supabase Auth)
users (
  id uuid primary key,
  email text,
  created_at timestamp
);

-- User LLM configurations
user_configs (
  id uuid primary key,
  user_id uuid references users(id),
  provider text, -- 'openai', 'anthropic', 'local', etc.
  api_key_encrypted text, -- Encrypted API key
  model_name text, -- 'gpt-4', 'claude-3', etc.
  max_tokens integer default 2000,
  temperature float default 0.7,
  created_at timestamp,
  updated_at timestamp
);

-- Game sessions (conversation saves)
game_sessions (
  id uuid primary key,
  user_id uuid references users(id),
  title text,
  conversation_history jsonb, -- Array of messages
  game_state jsonb, -- Current character, inventory, etc.
  created_at timestamp,
  updated_at timestamp
);
```

### Game State Structure
```typescript
// Minimal state - let LLM manage most details
interface GameState {
  sessionId: string;
  character?: {
    name: string;
    class: string;
    // LLM manages all other character details
  };
  currentScene?: string;
  // Everything else managed by LLM through conversation
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  gameStateSnapshot?: GameState;
}
```

## LLM Integration Design

### System Prompt Strategy
```typescript
const GAME_MASTER_PROMPT = `
You are a master storyteller running an interactive adventure game. 

CORE RESPONSIBILITIES:
- Create engaging, dynamic stories with twists and mysteries
- Present 4 character options at game start
- Manage character stats, inventory, and story progression through conversation
- Create interactive elements: puzzles, riddles, mini-games
- Respond to unexpected user actions creatively
- Maintain story coherence while adapting to user choices

GAME MECHANICS:
- Track character stats and inventory in your responses
- Present choices naturally in conversation
- Create consequences that matter
- Use interactive elements to engage the player
- Keep story moving forward while allowing exploration

RESPONSE FORMAT:
- Write in engaging, descriptive prose
- Present choices naturally (not as numbered lists unless appropriate)
- Include character/inventory status when relevant
- Use markdown for emphasis and formatting
`;
```

### LLM Provider Abstraction
```typescript
interface LLMProvider {
  name: string;
  apiCall(messages: Message[], config: LLMConfig): Promise<string>;
  validateConfig(config: LLMConfig): boolean;
  estimateTokens(text: string): number;
}

// Support multiple providers
const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  local: new LocalProvider(), // For local models
};
```

## User Experience Flow

### 1. Authentication & Setup
1. User signs up/logs in via Supabase Auth
2. Configure LLM provider and API key (encrypted storage)
3. Choose model and parameters (temperature, max tokens)
4. Start new game or load existing session

### 2. Game Initialization
1. LLM presents story introduction
2. LLM offers 4 character choices with descriptions
3. User selects character through conversation
4. LLM begins adventure based on character choice

### 3. Core Gameplay Loop
1. **LLM Storytelling**: AI describes scene, situation, or event
2. **User Response**: Player responds naturally in conversation
3. **LLM Processing**: AI interprets action, updates internal state
4. **Consequence & Continuation**: AI describes results and continues story
5. **Repeat**: Natural conversation flow with story progression

### 4. Session Management
- **Auto-save**: Conversation automatically saved to database
- **Load Game**: Resume any previous conversation
- **Multiple Sessions**: Users can have multiple ongoing adventures

## Security & Privacy

### API Key Management
- **Client-side Encryption**: API keys encrypted before storage
- **No Server Access**: Backend never sees raw API keys
- **User Control**: Users can update/delete keys anytime

### Data Privacy
- **User Conversations**: Stored securely in user's database records
- **No Sharing**: Conversations never shared between users
- **Deletion**: Users can delete sessions and data

## Development Approach

### Minimal Hardcoded Elements
- **No Fixed Character Classes**: LLM creates characters dynamically
- **No Predefined Inventory**: LLM manages items through conversation
- **No Hardcoded Puzzles**: LLM creates interactive elements on-demand
- **No Fixed Story Paths**: Pure emergent storytelling

### What We DO Build
- **Chat Interface**: Clean, responsive conversation UI
- **LLM Integration**: Reliable API communication with multiple providers
- **User Authentication**: Secure login and session management
- **Configuration UI**: Easy LLM setup and model selection
- **Session Persistence**: Save/load conversation history

### Design Principles
1. **LLM-First**: Let the AI handle game mechanics naturally
2. **Conversation-Driven**: Everything happens through chat
3. **User-Configured**: Users bring their own LLM access
4. **Minimal UI**: Focus on the conversation, not complex interfaces
5. **Secure**: Protect user API keys and conversation data

This design prioritizes the conversational experience and lets the LLM handle the creative and mechanical aspects of storytelling, rather than constraining it with hardcoded game systems.
