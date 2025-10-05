import { ChatMessage, LLMConfig } from '../types';
import { io, Socket } from 'socket.io-client';

const GAME_MASTER_PROMPT = `You are a master storyteller running an immersive interactive adventure game (aim for 20-30 total interactions for a rich experience).

CRITICAL RULES:
1. ALWAYS use the onEvent prop in your components - this is how you receive user interactions
2. When you receive a [DYNAMIC_EVENT], respond to that specific user action and advance the story
3. Create COMPLEX, multi-layered stories with rich narrative, challenging puzzles, and meaningful choices
4. NEVER repeat the same component - always progress the story forward
5. Use the update_dynamic_component tool ONLY when you need to create a new interactive interface
6. You can respond with just text to narrate story progression - you don't always need to create components

STORY COMPLEXITY REQUIREMENTS:
- Rich, detailed world-building and atmospheric descriptions
- Multi-step challenges that require strategy and thinking
- Character development and meaningful backstory
- Plot twists, mysteries, and unexpected revelations
- Moral dilemmas and consequences that matter
- Environmental storytelling and immersive details
- Complex NPCs with their own motivations and secrets

WHEN TO USE TOOLS:
- Character selection screens ✓
- Inventory displays with detailed item descriptions
- Complex combat interfaces with multiple options
- Multi-step puzzle/mini-game interfaces (riddles, locks, mechanisms)
- Story choice menus with significant consequences
- Character interaction dialogues with branching options
- Final story conclusion screens

WHEN TO USE TEXT ONLY:
- Rich narrative descriptions and world-building ✓
- Character development and backstory reveals
- Atmospheric scene setting and mood creation
- Describing consequences of actions in detail
- Building tension and suspense
- Responding to character selections with story advancement

IMPORTANT: When you want to create an interactive element, actually call the update_dynamic_component tool - don't just mention it in text!

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

TOOLS AVAILABLE:
You have access to the 'update_dynamic_component' tool to create interactive game elements.
Use this tool to create character selection screens, inventory displays, mini-games, puzzles, 
and any other interactive elements that enhance the storytelling experience.

The component code must define a function named AiDynamicComponent that accepts an onEvent prop.
ALWAYS use the onEvent function in your interface handlers (onClick, onHover, etc) to receive information
about the user's interactions.

Example: onClick={() => onEvent('action_name', data)}

Start by welcoming the player and using the update_dynamic_component tool to create a character selection interface.`;

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "update_dynamic_component",
      description: "Update the dynamic React component displayed in the main game area. Use this to create interactive game elements like character selection, inventory, mini-games, puzzles, and story scenes.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Complete React component code as a JSX/JS code string. IMPORTANT RULES:\n" +
              "1. DO NOT use 'import' or 'export' statements inside the component. React and other dependencies are already imported.\n" +
              "2. Write the component as a standalone function named AiDynamicComponent that accepts an onEvent prop.\n" +
              "3. Use React hooks and components directly without additional imports.\n" +
              "4. ALWAYS use onEvent in your click handlers: onClick={() => onEvent('action_name', data)}\n" +
              "5. Use Tailwind CSS classes for styling (e.g., 'bg-blue-500 text-white p-4 rounded')\n" +
              "6. CRITICAL: Use proper arrow function syntax with return statement:\n" +
              "   CORRECT: const AiDynamicComponent = ({ onEvent }) => {\n" +
              "     return (\n" +
              "       <div>content</div>\n" +
              "     );\n" +
              "   }\n" +
              "   WRONG: return <div>content</div>; (missing parentheses)\n" +
              "   WRONG: return (<div>content</div>}; (wrong closing)\n" +
              "7. Example: const AiDynamicComponent = ({ onEvent }) => {\n" +
              "     const [state, setState] = React.useState(initialState);\n" +
              "     return (\n" +
              "       <div className='w-full h-full p-6 bg-gray-100 flex flex-col'>\n" +
              "         <button className='bg-blue-500 text-white px-4 py-2 rounded' onClick={() => onEvent('button_clicked', 'data')}>Click me</button>\n" +
              "       </div>\n" +
              "     );\n" +
              "   }\n" +
              "8. ALWAYS use 'w-full h-full' classes on your root div to fill the container completely",
          }
        },
        required: ["code"]
      }
    }
  }
];

export class LLMService {
  private static socket: Socket | null = null;
  private static conversationHistory: ChatMessage[] = [];

  private static getSocket(): Socket {
    if (!this.socket) {
      this.socket = io('http://localhost:8080');
    }
    return this.socket;
  }

  private static addToHistory(message: ChatMessage) {
    this.conversationHistory.push(message);
    
    // Keep only last 20 messages to prevent context overflow
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  static async generateResponse(
    messages: ChatMessage[], 
    config: LLMConfig,
    onDynamicComponentUpdate?: (code: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = this.getSocket();

      // Add new user message to history
      const userMessage = messages[messages.length - 1];
      this.addToHistory(userMessage);

      // Build full conversation with system prompt + history
      const fullMessages = [
        { role: 'system', content: GAME_MASTER_PROMPT },
        ...this.conversationHistory
      ];

      // Set up event listeners
      const handleResponse = (data: any) => {
        console.log('Received chat response:', data);
        
        // Add assistant response to history, but filter out [TOOL_CALL] mentions
        if (data.content) {
          const cleanContent = data.content.replace(/\[TOOL_CALL\]\s*update_dynamic_component/g, '').trim();
          if (cleanContent) {
            this.addToHistory({
              id: Date.now().toString(),
              role: 'assistant',
              content: cleanContent,
              timestamp: new Date()
            });
          }
        }
        
        resolve(data.content || '');
        cleanup();
      };

      const handleError = (error: any) => {
        console.error('Chat error:', error);
        reject(new Error(error.error || 'Unknown error'));
        cleanup();
      };

      const handleDynamicUpdate = (data: any) => {
        console.log('Received dynamic component update:', data);
        if (onDynamicComponentUpdate && data.code) {
          onDynamicComponentUpdate(data.code);
          
          // Add tool call to history for context
          this.addToHistory({
            id: Date.now().toString(),
            role: 'assistant',
            content: `[TOOL_CALL] update_dynamic_component`,
            timestamp: new Date()
          });
        }
      };

      const cleanup = () => {
        socket.off('chat_response', handleResponse);
        socket.off('chat_error', handleError);
        socket.off('dynamic_component_update', handleDynamicUpdate);
      };

      // Register event listeners
      socket.on('chat_response', handleResponse);
      socket.on('chat_error', handleError);
      socket.on('dynamic_component_update', handleDynamicUpdate);

      // Send the chat request with full conversation history
      socket.emit('chat_request', {
        messages: fullMessages,
        model: config.model,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto'
      });
    });
  }

  // Method to clear conversation history if needed
  static clearHistory() {
    this.conversationHistory = [];
  }
}