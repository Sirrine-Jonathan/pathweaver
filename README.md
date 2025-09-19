# Pathweaver

A conversational interactive storytelling web application where users engage with AI game masters through natural chat conversations. The AI handles all story elements, character management, and interactive elements dynamically.

## Project Overview

Pathweaver is a web-based platform that transforms storytelling into a conversational experience. Users interact directly with LLMs (Large Language Models) that act as master storytellers, creating personalized adventures through natural dialogue.

### Key Features

- **Conversational Gameplay**: All interaction happens through natural chat conversation
- **AI Game Master**: LLM handles story creation, character management, and interactive elements
- **User-Configured LLMs**: Users provide their own API keys for OpenAI, Anthropic, or local models
- **Session Persistence**: Save and resume conversations across sessions
- **Multi-Provider Support**: Works with different LLM providers and models
- **Secure Configuration**: Client-side encryption of API keys
- **Web-Based**: Accessible from any device with a web browser

## Technical Stack

- **Frontend**: React + TypeScript with Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: Supabase Auth
- **Hosting**: Netlify (static site + serverless functions)
- **LLM Integration**: Direct API calls to user-configured providers

## Architecture Philosophy

**Conversational-First**: The entire game experience happens through chat conversation. No hardcoded game mechanics, character classes, or story paths - the LLM manages everything dynamically.

**User-Controlled AI**: Users configure their own LLM access, maintaining control over their AI interactions and associated costs.

**Minimal State**: The application maintains minimal game state, letting the LLM handle story continuity and character details through conversation context.

## Project Structure

```
pathweaver/
├── DESIGN.md           # Complete design document
├── ARCHITECTURE.md     # Technical architecture details  
├── ROADMAP.md         # 4-week implementation plan
├── GAME_PROMPT.md     # Original AI game master concept
└── README.md          # This file
```

## Development Approach

### What We Build
- Clean, responsive chat interface
- Secure user authentication and session management
- LLM provider integrations with API key encryption
- Conversation persistence and session management
- Configuration UI for LLM settings

### What We Don't Build
- Hardcoded character classes or stats
- Predefined story paths or choices
- Complex game mechanics or inventory systems
- Mini-game implementations

**The LLM handles all creative and mechanical aspects through conversation.**

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Netlify account
- LLM API access (OpenAI, Anthropic, etc.)

### Development Setup
```bash
# Clone and install
git clone <repository-url>
cd pathweaver
npm install

# Set up minimal environment (only Supabase connection)
# Create .env.local with:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Start development server
npm run dev
```

### Project Documents

1. **[DESIGN.md](./DESIGN.md)** - Complete application design including user experience, data architecture, and security considerations
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture, system design, and implementation details
3. **[ROADMAP.md](./ROADMAP.md)** - 4-week implementation plan with daily milestones and risk management
4. **[GAME_PROMPT.md](./GAME_PROMPT.md)** - Original AI game master concept and requirements

## Development Phases

### Phase 1: Foundation & Authentication (Week 1)
Web app with user authentication and basic chat interface.

### Phase 2: LLM Integration (Week 2)  
Working LLM conversations with game master prompts and session management.

### Phase 3: Game Features (Week 3)
Enhanced game master capabilities and multiple LLM provider support.

### Phase 4: Advanced Features & Polish (Week 4)
Production-ready application with performance optimization and advanced features.

## Security & Privacy

- **API Key Encryption**: User API keys encrypted client-side before storage
- **No Server Access**: Backend never sees raw API keys
- **User Data Control**: Users own their conversation data and can delete it
- **Secure Authentication**: Supabase Auth with row-level security

## Contributing

This project focuses on creating a minimal, robust conversational storytelling platform. Development priorities:

1. **Conversation Quality**: Smooth, engaging chat experience
2. **Security**: Protect user API keys and data
3. **Simplicity**: Avoid feature creep, let the LLM handle complexity
4. **Performance**: Fast, responsive interface

---

**Pathweaver** - Where every conversation weaves a new story.
