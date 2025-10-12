import { ChatMessage, LLMConfig } from "../types";
import io from "socket.io-client";
import { ttsService } from "./tts";

const GAME_MASTER_PROMPT = `You are a master storyteller running an immersive interactive adventure game (aim for 20-30 total interactions for a rich experience).

CRITICAL RULES:
1. ALWAYS use the onEvent prop in your components - this is how you receive user interactions
2. When you receive a [DYNAMIC_EVENT], respond to that specific user action and advance the story
3. Create COMPLEX, multi-layered stories with rich narrative, challenging puzzles, and meaningful choices
4. NEVER repeat the same component - always progress the story forward
5. Use the update_dynamic_component tool ONLY when you need to create a new interactive interface
6. You can respond with just text to narrate story progression - you don't always need to create components
7. CRITICAL: When using tools, ensure your JSON is properly formatted with escaped quotes and no unescaped newlines
8. NEVER include component code (JSX, onClick, onEvent, etc.) in your text responses - only use the tool for components
9. Text responses should ONLY contain narrative prose - no code fragments, no JSX, no button syntax

UI/UX REQUIREMENTS:
8. NEVER attempt to use images, icons, or visual assets - they are not supported and will break the interface
9. ALWAYS provide interactive buttons or choices when the story requires user input - never leave users without options
10. ALWAYS add proper spacing between buttons using Tailwind classes like 'space-x-4', 'space-y-4', 'gap-4', or 'mb-4'
11. Use text-based visual elements like ASCII art, emojis, or styled text instead of images
12. Ensure buttons are clearly labeled and have proper hover states using Tailwind classes

NARRATIVE EXCELLENCE REQUIREMENTS:
- Write with literary quality - use vivid, sensory descriptions that immerse the player
- Create atmospheric tension through pacing, word choice, and environmental details
- Develop complex characters with hidden motivations, flaws, and compelling backstories
- Build mysteries that unfold gradually with satisfying revelations and plot twists
- Include moral ambiguity - choices should have meaningful consequences, not clear right/wrong answers
- Use foreshadowing and symbolism to create depth and reward careful readers
- Vary sentence structure and rhythm to create engaging prose
- Show don't tell - reveal character and plot through actions and dialogue, not exposition

STORY COMPLEXITY REQUIREMENTS:
- Rich, detailed world-building with consistent internal logic and history
- Multi-step challenges that require strategy, observation, and creative thinking
- Character development arcs that evolve based on player choices
- Interconnected plot threads that weave together in surprising ways
- Environmental storytelling - let the setting reveal story through details
- Complex NPCs with their own goals, secrets, and character growth
- Consequences that ripple through the story, affecting later encounters
- Multiple possible endings based on accumulated choices and character development

WHEN TO USE TOOLS:
- Character selection screens with rich backstory previews ✓
- Inventory displays with detailed item descriptions and lore
- Complex combat interfaces with tactical options and environmental factors
- Multi-step puzzle/mini-game interfaces (riddles, locks, mechanisms, investigations)
- Story choice menus with significant moral and narrative consequences
- Character interaction dialogues with branching conversation trees
- Investigation scenes with multiple clues to examine
- Final story conclusion screens that reflect the player's journey

WHEN TO USE TEXT ONLY:
- Rich narrative descriptions that paint vivid scenes ✓
- Character development moments and internal monologue
- Atmospheric scene setting with sensory details (sounds, smells, textures)
- Describing consequences of actions with emotional weight
- Building tension and suspense through pacing and description
- Revealing backstory through environmental storytelling
- Transitional moments that connect scenes and maintain flow

IMPORTANT: When you want to create an interactive element, actually call the update_dynamic_component tool - don't just mention it in text!

CORE RESPONSIBILITIES:
- Create engaging, dynamic stories with literary merit and emotional depth
- Present 4 diverse character options at game start, each with unique voice and background
- Manage character stats, inventory, relationships, and story progression through conversation
- Create interactive elements that enhance rather than interrupt the narrative flow
- Respond to unexpected user actions creatively while maintaining story coherence
- Build toward a satisfying climax that reflects the player's choices and character growth

GAME MECHANICS:
- Track character stats, relationships, inventory, and reputation in your responses
- Present choices that feel natural and meaningful within the story context
- Create consequences that matter both immediately and in the long term
- Use interactive elements to deepen engagement with the world and characters
- Keep story moving forward while allowing for exploration and character development
- Remember and reference previous choices to create a sense of continuity and growth

TOOLS AVAILABLE:
You have access to the 'update_dynamic_component' tool to create interactive game elements.
Use this tool to create character selection screens, inventory displays, mini-games, puzzles, 
and any other interactive elements that enhance the storytelling experience.

The component code must define a function named AiDynamicComponent that accepts an onEvent prop.
ALWAYS use the onEvent function in your interface handlers (onClick, onHover, etc) to receive information
about the user's interactions.

Example: onClick={() => onEvent('action_name', data)}

Start by welcoming the player with evocative prose and using the update_dynamic_component tool to create a character selection interface that previews each character's unique story potential.`;

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "update_dynamic_component",
      description:
        "Update the dynamic React component displayed in the main game area. Use this to create interactive game elements like character selection, inventory, mini-games, puzzles, and story scenes.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "Complete React component code as a JSX/JS code string. IMPORTANT RULES:\\n" +
              "1. DO NOT use 'import' or 'export' statements inside the component. React and other dependencies are already imported.\\n" +
              "2. Write the component as a standalone function named AiDynamicComponent that accepts an onEvent prop.\\n" +
              "3. Use React hooks and components directly without additional imports.\\n" +
              "4. ALWAYS use onEvent in your click handlers: onClick={() => onEvent('action_name', data)}\\n" +
              "5. Use Tailwind CSS classes for styling (e.g., 'bg-blue-500 text-white p-4 rounded')\\n" +
              "6. CRITICAL: Use proper arrow function syntax with return statement:\\n" +
              "   CORRECT: const AiDynamicComponent = ({ onEvent }) => {\\n" +
              "     return (\\n" +
              "       <div>content</div>\\n" +
              "     );\\n" +
              "   }\\n" +
              "   WRONG: return <div>content</div>; (missing parentheses)\\n" +
              "   WRONG: return (<div>content</div>}; (wrong closing)\\n" +
              "7. Example: const AiDynamicComponent = ({ onEvent }) => {\\n" +
              "     const [state, setState] = React.useState(initialState);\\n" +
              "     return (\\n" +
              "       <div className='w-full h-full p-6 bg-gray-100 flex flex-col'>\\n" +
              "         <button className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors' onClick={() => onEvent('button_clicked', 'data')}>Click me</button>\\n" +
              "       </div>\\n" +
              "     );\\n" +
              "   }\\n" +
              "7. CRITICAL: When using tools, ensure your JSON is properly formatted with escaped quotes and no unescaped newlines\\n" +
              "8. TEXT CONTENT RULES - CRITICAL FOR JSON ENCODING:\\n" +
              "   - NEVER use apostrophes in JSX text (e.g., don't, it's, rogue's)\\n" +
              "   - Use simple words without contractions or possessives\\n" +
              "   - WRONG: 'The Rogue\\'s Lair' or 'Don\\'t go there'\\n" +
              "   - RIGHT: 'The Rogue Lair' or 'Do not go there'\\n" +
              "   - NEVER use quote marks in text content\\n" +
              "   - Keep all text simple and clean to avoid JSON encoding issues\\n" +
              "9. ALWAYS use 'w-full h-full' classes on your root div to fill the container completely\\n" +
              "10. NEVER use images, img tags, or attempt to load visual assets - use text, emojis, or ASCII art instead\\n" +
              "11. ALWAYS provide interactive elements (buttons/choices/controls) when user input is needed\\n" +
              "12. Use proper spacing between buttons: 'space-x-4 space-y-4' for flex layouts, 'gap-4' for grid layouts, or 'mb-4' for individual spacing\\n" +
              "13. Example button spacing: <div className='flex flex-col justify-end space-x-4'><button>Option 1</button><button>Option 2</button></div>\\n" +
              "14. Use hover effects on buttons: 'hover:bg-blue-700 transition-colors' for better UX\\n" +
              "15. ALWAYS style your component for mobile responsiveness (mobile first!)",
          },
        },
        required: ["code"],
      },
    },
  },
];

export class LLMService {
  private static socket: SocketIOClient.Socket | null = null;
  private static conversationHistory: ChatMessage[] = [];
  private static rateLimitCallback: ((seconds: number) => void) | null = null;

  private static getSocket(): SocketIOClient.Socket | null {
    if (!this.socket) {
      // Use backend server URL for development, current domain for production
      const socketUrl =
        process.env.NODE_ENV === "production"
          ? window.location.origin
          : "http://localhost:8080";
      console.log("Connecting to WebSocket at:", socketUrl);
      this.socket = io(socketUrl);
    }
    return this.socket;
  }

  private static handleRateLimit(seconds: number, retryCallback: () => void) {
    let countdown = seconds;

    // Notify UI about rate limit
    if (this.rateLimitCallback) {
      this.rateLimitCallback(countdown);
    }

    const timer = setInterval(() => {
      countdown--;
      if (this.rateLimitCallback) {
        this.rateLimitCallback(countdown);
      }

      if (countdown <= 0) {
        clearInterval(timer);
        if (this.rateLimitCallback) {
          this.rateLimitCallback(0); // Clear countdown
        }
        retryCallback();
      }
    }, 1000);
  }

  static setRateLimitCallback(callback: (seconds: number) => void) {
    this.rateLimitCallback = callback;
  }

  static addToHistory(message: ChatMessage) {
    this.conversationHistory.push(message);

    // Keep only last 20 messages to prevent context overflow
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  static async generateResponse(
    messages: ChatMessage[],
    config: LLMConfig,
    onDynamicComponentUpdate?: (code: string) => void,
    onError?: (error: Error | null) => void
  ): Promise<string> {
    console.log("LLMService.generateResponse called with:", {
      messagesCount: messages.length,
      config: { ...config, apiKey: "[REDACTED]" },
    });

    return new Promise((resolve, reject) => {
      const socket = this.getSocket();
      console.log("Socket obtained, setting up listeners...");

      // Add new user message to history
      const userMessage = messages[messages.length - 1];
      this.addToHistory(userMessage);

      // Build full conversation with system prompt + history
      const fullMessages = [
        { role: "system", content: GAME_MASTER_PROMPT },
        ...this.conversationHistory,
      ];

      console.log("Full conversation built:", {
        systemPrompt: !!GAME_MASTER_PROMPT,
        historyCount: this.conversationHistory.length,
        totalMessages: fullMessages.length,
      });

      // Set up event listeners
      const handleResponse = (data: any) => {
        console.log("Received chat response:", data);

        // Add assistant response to history, but filter out [TOOL_CALL] mentions and component code
        if (data.content) {
          const cleanContent = data.content
            .replace(/\[TOOL_CALL\]\s*update_dynamic_component/g, "")
            // Remove onClick handlers that may leak through
            .replace(/onClick=\{[^}]*\}>/g, "")
            // Remove onEvent calls that may leak through
            .replace(/onEvent\([^)]*\)[^>]*>/g, "")
            // Remove any remaining JSX fragments
            .replace(/<button[^>]*>/gi, "")
            .replace(/<\/button>/gi, "")
            .replace(/<div[^>]*>/gi, "")
            .replace(/<\/div>/gi, "")
            // Clean up any double spaces left by replacements
            .replace(/\s+/g, " ")
            .trim();
          if (cleanContent) {
            this.addToHistory({
              id: Date.now().toString(),
              role: "assistant",
              content: cleanContent,
              timestamp: new Date(),
            });

            // Auto-read the narrative text if TTS is enabled
            // Only read if it's actual narrative content (not just tool calls or system messages)
            // Filter out any remaining tool call mentions before speaking
            const textToSpeak = cleanContent
              .replace(/\[TOOL_CALL\][^\]]*$/g, "")
              .replace(/update_dynamic_component/g, "")
              .trim();

            if (textToSpeak.length > 0) {
              ttsService.speak(textToSpeak);
            }
          }
        }

        resolve(data.content || "");
        cleanup();
      };

      const handleRateLimit = (data: any) => {
        console.log("Rate limit received:", data);
        const { retryAfter, message, limit, used, requested } = data;

        // Start countdown in UI
        if (this.rateLimitCallback && retryAfter) {
          let countdown = Math.ceil(retryAfter);
          this.rateLimitCallback(countdown);

          const timer = setInterval(() => {
            countdown--;
            if (this.rateLimitCallback) {
              this.rateLimitCallback(countdown);
            }

            if (countdown <= 0) {
              clearInterval(timer);
            }
          }, 1000);
        }

        // Server will automatically retry, so we just wait for retry_success or response
      };

      const handleRetrySuccess = (data: any) => {
        console.log("Retry successful:", data);
        // Clear countdown
        if (this.rateLimitCallback) {
          this.rateLimitCallback(0);
        }
        // Server will emit the response next, so we don't need to do anything here
      };

      const handleError = (error: any) => {
        console.error("Chat error:", error);
        socket?.emit("chat_error", {
          error,
        });
        onError?.(error);

        // If it's a retry error, automatically send feedback to LLM
        if (error.retry) {
          console.log("Retrying with error feedback...");
          // Add error feedback to conversation and retry
          this.addToHistory({
            id: Date.now().toString(),
            role: "system",
            content: `Error: ${error.details}. Please retry with a simpler approach.`,
            timestamp: new Date(),
          });

          // Retry the request with error feedback
          const retryMessages = [
            { role: "system", content: GAME_MASTER_PROMPT },
            ...this.conversationHistory,
          ];

          socket?.emit("chat_request", {
            messages: retryMessages,
            model: config.model,
            tools: TOOL_DEFINITIONS,
            tool_choice: "required",
          });
          return; // Don't reject, let the retry handle it
        }

        reject(new Error(error.error || "Unknown error"));
        cleanup();
      };

      const handleDynamicUpdate = (data: any) => {
        console.log("Received dynamic component update:", data);
        if (onDynamicComponentUpdate && data.code) {
          onDynamicComponentUpdate(data.code);

          // Add tool call to history for context
          this.addToHistory({
            id: Date.now().toString(),
            role: "assistant",
            content: `[TOOL_CALL] update_dynamic_component`,
            timestamp: new Date(),
          });
        }
      };

      const cleanup = () => {
        socket?.off("chat_response", handleResponse);
        socket?.off("chat_error", handleError);
        socket?.off("dynamic_component_update", handleDynamicUpdate);
        socket?.off("rate_limit", handleRateLimit);
        socket?.off("retry_success", handleRetrySuccess);
      };

      // Register event listeners
      socket?.on("chat_response", handleResponse);
      socket?.on("chat_error", handleError);
      socket?.on("dynamic_component_update", handleDynamicUpdate);
      socket?.on("rate_limit", handleRateLimit);
      socket?.on("retry_success", handleRetrySuccess);

      // Send the chat request with full conversation history
      console.log("Emitting chat_request to server...");
      socket?.emit("chat_request", {
        messages: fullMessages,
        model: config.model,
        tools: TOOL_DEFINITIONS,
        tool_choice: "required",
      });
      console.log("chat_request emitted");
    });
  }

  // Method to clear conversation history if needed
  static clearHistory() {
    this.conversationHistory = [];
  }
}
