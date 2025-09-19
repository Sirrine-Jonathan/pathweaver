import { ChatMessage, LLMConfig } from '../types';

const GAME_MASTER_PROMPT = `You are a master storyteller running an interactive adventure game.

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
Use the onEvent function in your interface handlers (onClick, onHover, etc) to receive information
about the user's interactions.

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
              "4. Example: const AiDynamicComponent = ({ onEvent }) => {\n" +
              "     const [state, setState] = React.useState(initialState);\n" +
              "     return <div><button onClick={() => onEvent('button_clicked')}>Click me</button></div>;\n" +
              "   }",

          }
        },
        required: ["code"]
      }
    }
  }
];

export class LLMService {
  static async fetchAvailableModels(baseUrl: string, apiKey: string): Promise<any[]> {
    try {
      // Use a proxy to handle CORS issues
      const proxyUrl = '/api/models';

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data ? data.data.sort((a: any, b: any) => a.id.localeCompare(b.id)) : [];
    } catch (error) {
      console.error('Error fetching models:', error);
      // Fallback to a default list of models if fetch fails
      return [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
      ];
    }
  }

  static async generateResponse(
    messages: ChatMessage[], 
    config: LLMConfig,
    onDynamicComponentUpdate?: (code: string) => void
  ): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: GAME_MASTER_PROMPT },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        tools: TOOL_DEFINITIONS,
        tool_choice: "required"
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    
    // Handle tool calls
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function.name === 'update_dynamic_component') {
          const args = JSON.parse(toolCall.function.arguments);
          console.log('LLM called update_dynamic_component with code:', args.code);
          if (onDynamicComponentUpdate) {
            onDynamicComponentUpdate(args.code);
          }
        }
      }
    }
    
    // Return the actual LLM message content, not a generic message
    return choice.message.content || '';
  }
}
