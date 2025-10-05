import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL] 
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;

// Environment variables
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
const LLM_API_KEY = process.env.LLM_API_KEY;

if (!LLM_API_KEY) {
  console.warn('⚠️  LLM_API_KEY not set. Chat functionality will not work.');
}

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle chat requests via WebSocket
  socket.on('chat_request', async (data) => {
    try {
      if (!LLM_API_KEY) {
        socket.emit('chat_error', { 
          error: 'API key not configured',
          details: 'LLM_API_KEY environment variable is not set' 
        });
        return;
      }

      const { 
        messages, 
        model, 
        tools = [],
        tool_choice = 'auto' 
      } = data;
      
      // Use requested model if it's a valid Groq model, otherwise fallback to best available model
      const groqModel = (model && (model.includes('llama') || model.includes('mixtral') || model.includes('gemma') || model.includes('deepseek'))) 
        ? model 
        : 'llama-3.3-70b-versatile'; // Use the newest 70B model
      
      console.log('Received WebSocket chat request:', { 
        messagesCount: messages.length, 
        toolCount: tools.length,
        requestedModel: model,
        usingModel: groqModel
      });

      // Clean messages to only include role and content (Groq doesn't support id/timestamp)
      const cleanMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const requestBody = {
        model: groqModel,
        messages: cleanMessages,
        temperature: 0.3,
        top_p: 0.8
      };

      // Add tools to request if provided
      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'required'; // Force tool usage for first message, auto for others
      }

      console.log('Sending to Groq:', JSON.stringify(requestBody, null, 2));

      // Temporarily disable TLS verification for API calls (like AuraFlow)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error response:', response.status, errorText);
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      const aiMessage = responseData.choices[0].message;

      console.log('Groq response:', {
        content: aiMessage.content,
        toolCalls: aiMessage.tool_calls
      });

      // Handle dynamic component tool calls
      if (aiMessage.tool_calls) {
        console.log('Tool calls:', JSON.stringify(aiMessage.tool_calls));
        for (const toolCall of aiMessage.tool_calls) {
          if (toolCall.function.name === 'update_dynamic_component') {
            console.log('Handling dynamic component update:', JSON.stringify(toolCall));
            try {
              const args = JSON.parse(toolCall.function.arguments);
              console.log('Emitting dynamic component update:', args);
              
              // Emit the dynamic component code back to the client
              socket.emit('dynamic_component_update', {
                code: args.code,
                toolCallId: toolCall.id
              });
            } catch (parseError) {
              console.error('Error parsing dynamic component:', parseError);
            }
          }
        }
      }

      // Emit the chat response
      socket.emit('chat_response', {
        content: aiMessage.content || '',
        tool_calls: aiMessage.tool_calls || []
      });

    } catch (error) {
      console.error('Groq WebSocket error:', error);
      socket.emit('chat_error', { 
        error: 'Failed to get response from Groq',
        details: error.message 
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Fallback REST endpoint (optional)
app.post('/api/chat', async (req, res) => {
  try {
    if (!LLM_API_KEY) {
      return res.status(500).json({ 
        error: 'API key not configured',
        details: 'LLM_API_KEY environment variable is not set' 
      });
    }

    const { 
      messages, 
      model, // Don't use default here, we'll override it
      tools = [],
      tool_choice = 'auto' 
    } = req.body;
    
    // Force use of valid Groq model regardless of what frontend sends
    const groqModel = 'llama-3.1-8b-instant';
    
    // Clean messages to only include role and content (Groq doesn't support id/timestamp)
    const cleanMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const requestBody = {
      model: groqModel,
      messages: cleanMessages,
      temperature: 0.3,
      top_p: 0.8
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = tool_choice;
    }

    // Temporarily disable TLS verification for API calls (like AuraFlow)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const aiMessage = responseData.choices[0].message;

    res.json({
      content: aiMessage.content || '',
      tool_calls: aiMessage.tool_calls || []
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get response from Groq',
      details: error.message 
    });
  }
});

// Get available models from Groq
app.get('/api/models', async (req, res) => {
  console.log('📡 Models API called');
  try {
    if (!LLM_API_KEY) {
      console.log('❌ No API key configured');
      return res.status(500).json({ 
        error: 'API key not configured',
        details: 'LLM_API_KEY environment variable is not set' 
      });
    }

    console.log('🔑 API key found, calling Groq models API...');
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const response = await fetch(`${LLM_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LLM_API_KEY}`
      }
    });

    console.log('📊 Groq models API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Groq models API error:', response.status, errorText);
      throw new Error(`Models API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Received models:', data.data?.length || 0, 'models');
    
    // Filter for models that support tools (exclude guard/prompt models)
    const toolCapableModels = data.data.filter(model => 
      (model.id.includes('llama') || model.id.includes('mixtral') || model.id.includes('gemma') || model.id.includes('deepseek')) &&
      !model.id.includes('guard') && 
      !model.id.includes('prompt-guard') &&
      model.max_completion_tokens >= 4096 // Ensure decent output length
    );

    console.log('🛠️  Tool-capable models:', toolCapableModels.length);

    // Find the best available model (prefer 70b models, then newer versions)
    const bestModel = toolCapableModels.find(m => m.id === 'llama-3.3-70b-versatile') ||
                     toolCapableModels.find(m => m.id === 'deepseek-r1-distill-llama-70b') ||
                     toolCapableModels.find(m => m.id.includes('70b')) ||
                     toolCapableModels.find(m => m.id.includes('32b')) ||
                     toolCapableModels.find(m => m.id === 'llama-3.1-8b-instant') ||
                     toolCapableModels[0];

    res.json({
      models: toolCapableModels,
      recommended: bestModel ? bestModel.id : 'llama-3.1-8b-instant'
    });
  } catch (error) {
    console.error('💥 Models API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      details: error.message 
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Pathweaver server running on http://localhost:${PORT}`);
});
