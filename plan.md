# Pathweaver Heroku Deployment Plan

Based on AuraFlow's successful Heroku deployment with Groq integration.

## Phase 1: Replace Ollama with Groq (Following AuraFlow Pattern)

### 1.1 Update server dependencies
```bash
cd server
npm remove ollama
# No need for groq-sdk - AuraFlow uses direct API calls to Groq's OpenAI-compatible endpoint
```

### 1.2 Replace Ollama with Groq API calls
- **Key insight from AuraFlow**: Uses `https://api.groq.com/openai/v1` as base URL
- Replace `ollama.chat()` calls with `fetch()` to Groq's OpenAI-compatible API
- Maintain WebSocket functionality for real-time responses
- Use same request/response format as OpenAI API

### 1.3 Environment variables (from AuraFlow)
```bash
LLM_API_KEY=your_groq_api_key
LLM_BASE_URL=https://api.groq.com/openai/v1
PORT=8080
NODE_ENV=production
```

## Phase 2: Restructure for Heroku (AuraFlow Pattern)

### 2.1 Create root package.json (like AuraFlow)
```json
{
  "name": "pathweaver",
  "scripts": {
    "start": "cd server && npm start",
    "heroku-postbuild": "npm run build",
    "build": "cd server && npm install && cd .. && npm run build:frontend",
    "build:frontend": "npm install && npm run build"
  },
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### 2.2 Create Procfile (exactly like AuraFlow)
```
web: cd server && npm start
```

### 2.3 Update server for static file serving
- Serve built frontend files from Express
- Update CORS origins for Heroku domain
- Handle production vs development environment

## Phase 3: Implement Groq Integration

### 3.1 Update server/index.js
Replace Ollama calls with:
```javascript
const response = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LLM_API_KEY}`
  },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant', // Fast model from AuraFlow
    messages: messages,
    temperature: 0.3,
    tools: tools, // If using tools
    tool_choice: 'auto'
  })
});
```

### 3.2 Handle streaming (if needed)
- Groq supports streaming via `stream: true` parameter
- Maintain WebSocket streaming for real-time UI updates

## Phase 4: Deploy to Heroku

### 4.1 Create Heroku app
```bash
heroku create pathweaver-app
```

### 4.2 Set environment variables
```bash
heroku config:set LLM_API_KEY=gsk_your_groq_api_key
heroku config:set LLM_BASE_URL=https://api.groq.com/openai/v1
heroku config:set NODE_ENV=production
```

### 4.3 Deploy
```bash
git add .
git commit -m "Add Groq integration and Heroku deployment"
git push heroku main
```

## Key Differences from Original Plan:
1. **No Groq SDK needed** - AuraFlow uses direct fetch() calls
2. **OpenAI-compatible API** - Same request format as OpenAI
3. **Root-level package.json** - Heroku builds from root
4. **Static file serving** - Server serves built frontend files
5. **Proven model**: `llama-3.1-8b-instant` works well for AuraFlow