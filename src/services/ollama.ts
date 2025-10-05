import io from 'socket.io-client';

// Safely handle environment variables
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export class OllamaService {
  private static socket: any;
  private static connectionAttempts = 0;
  private static MAX_CONNECTION_ATTEMPTS = 3;

  private static async ensureSocketConnection() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.connectionAttempts >= this.MAX_CONNECTION_ATTEMPTS) {
      throw new Error('Max connection attempts exceeded');
    }

    return new Promise((resolve, reject) => {
      const socketOptions = {
        transports: ['websocket'], // Force WebSocket transport
        withCredentials: false,
        reconnection: false,
        timeout: 10000, // 10 second timeout
      };

      this.socket = io(SOCKET_URL, socketOptions);

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        this.connectionAttempts = 0;
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error: any) => {
        this.connectionAttempts++;
        console.error(`WebSocket connection error (Attempt ${this.connectionAttempts}):`, error);
        
        if (this.connectionAttempts >= this.MAX_CONNECTION_ATTEMPTS) {
          reject(new Error('Failed to establish WebSocket connection'));
        }
      });

      this.socket.on('disconnect', (reason: string) => {
        console.warn('WebSocket disconnected:', reason);
        this.socket = null;
      });
    });
  }

  static async sendMessage(
    messages: ChatMessage[], 
    model = 'qwen3:8b', 
    tools?: ToolDefinition[]
  ): Promise<{
    content: string;
    toolCalls?: any[];
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        const socket = await this.ensureSocketConnection();

        console.log('Sending WebSocket chat request:', { 
          model, 
          messageCount: messages.length,
          toolCount: tools?.length || 0
        });

        // Set up response listeners
        const responseHandler = (response: any) => {
          console.log('Received WebSocket chat response:', response);
          socket.off('chat_response', responseHandler);
          socket.off('chat_error', errorHandler);
          clearTimeout(timeoutId);
          
          resolve({
            content: response.content || '',
            toolCalls: response.tool_calls || []
          });
        };

        const errorHandler = (error: any) => {
          console.error('WebSocket chat error:', error);
          socket.off('chat_response', responseHandler);
          socket.off('chat_error', errorHandler);
          clearTimeout(timeoutId);
          
          reject(new Error(error.details || 'Unknown WebSocket error'));
        };

        // Set up timeout
        const timeoutId = setTimeout(() => {
          socket.off('chat_response', responseHandler);
          socket.off('chat_error', errorHandler);
          reject(new Error('WebSocket request timed out'));
        }, 60000); // 60 second timeout

        // Register listeners
        socket.on('chat_response', responseHandler);
        socket.on('chat_error', errorHandler);

        // Send chat request
        socket.emit('chat_request', { 
          messages, 
          model, 
          tools,
          tool_choice: 'auto',
          options: {
            temperature: 0.3,
            top_p: 0.8
          }
        });

      } catch (error) {
        console.error('Detailed Ollama send error:', error);
        
        // Fallback to HTTP request if WebSocket fails
        try {
          const httpResponse = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, model, tools })
          });

          if (!httpResponse.ok) {
            throw new Error('HTTP request failed');
          }

          const data = await httpResponse.json();
          resolve({
            content: data.content || '',
            toolCalls: data.tool_calls || []
          });
        } catch (httpError) {
          reject(new Error('Failed to communicate with Ollama: ' + httpError));
        }
      }
    });
  }

  // Method to handle dynamic component updates
  static onDynamicComponentUpdate(callback: (code: string) => void) {
    try {
      const socket = this.ensureSocketConnection();
      socket.on('dynamic_component_update', (data: any) => {
        console.log('Received dynamic component update:', data);
        callback(data.code);
      });
    } catch (error) {
      console.error('Error setting up dynamic component update listener:', error);
    }
  }
}

// Maintain backwards compatibility
export async function sendMessage(
  messages: ChatMessage[], 
  model = 'qwen3:8b', 
  tools?: ToolDefinition[]
): Promise<{
  content: string;
  toolCalls?: any[];
}> {
  return OllamaService.sendMessage(messages, model, tools);
}
