# Pathweaver + Ollama Setup

Pathweaver has been successfully updated to use Ollama instead of external LLM providers.

## Architecture

- **Frontend**: React app (http://localhost:5173) - Simple chat interface
- **Backend**: Express server (http://localhost:8080) - Proxy to Ollama
- **AI**: Ollama with qwen3:8b model

## Quick Start

1. **Start Ollama** (if not already running):
   ```bash
   ollama serve
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Start both servers**:
   ```bash
   # Terminal 1: Backend
   npm run server

   # Terminal 2: Frontend  
   npm run dev
   ```

4. **Open browser**: http://localhost:5173

## What Changed

- ✅ Removed config UI (no API keys needed)
- ✅ Added Express backend for Ollama integration
- ✅ Simplified React frontend to basic chat interface
- ✅ Direct integration with local Ollama instance
- ✅ No external dependencies or API costs

## Files Structure

```
pathweaver/
├── src/
│   ├── App.tsx              # Simple chat interface
│   ├── services/ollama.ts   # API client
│   └── ...
├── server/
│   ├── index.js            # Express proxy server
│   └── package.json        # Server dependencies
└── package.json            # Main project
```

## Testing

Both servers are working correctly:
- Backend API responds to chat requests
- Frontend serves the React app
- Ollama integration is functional
- No configuration UI needed