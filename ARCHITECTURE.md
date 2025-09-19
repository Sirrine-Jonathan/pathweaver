# Pathweaver Technical Architecture

## System Overview

Pathweaver is a web-based conversational storytelling platform where users interact directly with LLMs through a chat interface. The LLM acts as game master, handling all story elements, character management, and interactive elements through natural conversation.

## Technology Stack

### Frontend
- **React 18+ with TypeScript**: Modern component-based UI
- **Vite**: Fast development and build tooling
- **Tailwind CSS**: Utility-first styling
- **React Query**: Server state management and caching
- **Supabase Client**: Authentication and database integration

### Backend/Infrastructure
- **Netlify**: Static site hosting with serverless functions
- **Supabase**: PostgreSQL database with real-time features
- **Supabase Auth**: User authentication and session management
- **Netlify Functions**: Serverless API endpoints for LLM calls

### External Services
- **OpenAI API**: GPT models (user-configured)
- **Anthropic API**: Claude models (user-configured)
- **Local LLM Support**: Ollama or similar (future)

## Project Structure

```
pathweaver/
├── src/                     # React frontend
│   ├── components/
│   │   ├── chat/            # Chat interface components
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── TypingIndicator.tsx
│   │   │   └── ChatContainer.tsx
│   │   ├── auth/            # Authentication components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── settings/        # Configuration components
│   │   │   ├── LLMConfig.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   └── UserProfile.tsx
│   │   └── ui/              # Reusable UI components
│   ├── services/            # API and business logic
│   │   ├── llm/             # LLM integration
│   │   │   ├── providers/   # Provider-specific adapters
│   │   │   ├── LLMService.ts
│   │   │   └── PromptManager.ts
│   │   ├── auth/            # Authentication service
│   │   ├── database/        # Supabase integration
│   │   └── encryption/      # Client-side encryption
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript definitions
│   └── utils/               # Utility functions
├── netlify/
│   └── functions/           # Serverless functions
│       ├── llm-proxy.ts     # Secure LLM API calls
│       └── health.ts        # Health check endpoint
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed.sql            # Initial data
└── package.json
```

## Core Systems

### 1. Chat Interface System

```typescript
// Core chat message structure
interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokenCount?: number;
    model?: string;
    gameState?: any;
  };
}

// Chat session management
interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  gameState: any; // Minimal state, mostly managed by LLM
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. LLM Integration Architecture

```typescript
// Provider abstraction
interface LLMProvider {
  name: string;
  models: string[];
  call(messages: ChatMessage[], config: LLMConfig): Promise<string>;
  validateConfig(config: LLMConfig): boolean;
  estimateTokens(text: string): number;
}

// User LLM configuration
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  apiKey: string; // Encrypted client-side
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

// Provider implementations
class OpenAIProvider implements LLMProvider {
  async call(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    // Direct API call from client with encrypted key
  }
}
```

### 3. Database Schema

```sql
-- Users (managed by Supabase Auth)
-- No custom users table needed

-- User LLM configurations
user_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  api_key_encrypted text not null,
  temperature float default 0.7,
  max_tokens integer default 2000,
  system_prompt text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Game sessions
game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  messages jsonb not null default '[]',
  game_state jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Row Level Security
alter table user_configs enable row level security;
alter table game_sessions enable row level security;

-- Policies
create policy "Users can only access their own configs" on user_configs
  for all using (auth.uid() = user_id);

create policy "Users can only access their own sessions" on game_sessions
  for all using (auth.uid() = user_id);
```

## Security Architecture

### 1. API Key Management
```typescript
// Client-side encryption before storage
class EncryptionService {
  private static readonly ENCRYPTION_KEY = 'user-derived-key';
  
  static encrypt(plaintext: string, userKey: string): string {
    // Use Web Crypto API for client-side encryption
    // Never send raw API keys to server
  }
  
  static decrypt(ciphertext: string, userKey: string): string {
    // Decrypt on client-side only
  }
}
```

### 2. Secure LLM Calls
```typescript
// Option 1: Direct client calls (preferred for privacy)
class DirectLLMService {
  async callLLM(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const decryptedKey = EncryptionService.decrypt(config.apiKey, userKey);
    // Direct API call from browser
    return fetch(providerEndpoint, {
      headers: { Authorization: `Bearer ${decryptedKey}` }
    });
  }
}

// Option 2: Proxy through Netlify function (if CORS issues)
class ProxyLLMService {
  async callLLM(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    // Send encrypted key to Netlify function
    // Function decrypts and makes API call
    return fetch('/.netlify/functions/llm-proxy', {
      method: 'POST',
      body: JSON.stringify({ messages, encryptedConfig: config })
    });
  }
}
```

## Data Flow

### 1. User Authentication Flow
```
User → Supabase Auth → JWT Token → Client State → Database Access
```

### 2. LLM Conversation Flow
```
User Input → Chat Interface → LLM Service → Provider API → Response → Chat Display → Database Save
```

### 3. Session Management Flow
```
Load Session → Fetch Messages → Restore Chat → Continue Conversation → Auto-save
```

## Performance Considerations

### 1. Message Management
- **Pagination**: Load recent messages first, lazy load history
- **Token Limits**: Truncate conversation history to stay within model limits
- **Caching**: Cache LLM responses to avoid duplicate calls

### 2. Real-time Features
- **Typing Indicators**: Show when LLM is generating response
- **Streaming**: Stream LLM responses for better UX (if supported)
- **Optimistic Updates**: Show user messages immediately

### 3. Offline Support
- **Service Worker**: Cache app shell for offline access
- **Local Storage**: Temporary message storage when offline
- **Sync**: Sync messages when connection restored

## Deployment Architecture

### 1. Netlify Deployment
```yaml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 2. Environment Configuration
```typescript
// Minimal environment variables - only for Supabase connection
interface Config {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  // All LLM configuration handled through UI and stored in database
  // No other environment variables needed
}
```

This architecture prioritizes user privacy, security, and the conversational nature of the game while keeping the technical complexity minimal and focused on the chat experience.
