import { useState, useEffect, useRef } from "react";
import Chat from "./components/Chat";
import DynamicComponent from "./components/DynamicComponent";
import InstallPrompt from "./components/InstallPrompt";
import { LLMConfig } from "./types";
import { LLMService } from "./services/llm";

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: "http://localhost:8080",
  apiKey: "",
  model: "llama-3.3-70b-versatile", // Use the newest, most capable model
  temperature: 0.7,
  maxTokens: 2000,
};

function App() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [gameStarted, setGameStarted] = useState(false);
  const [dynamicComponentCode, setDynamicComponentCode] = useState<
    string | null
  >(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pathweaver-config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (error) {
        console.error("Error loading config:", error);
      }
    }

    // Set up rate limit callback
    LLMService.setRateLimitCallback(setRateLimitCountdown);
  }, []);

  // Handle dynamic component updates
  const handleDynamicComponentUpdate = (code: string) => {
    console.log("Updating dynamic component with code:", code);
    setDynamicComponentCode(code);
    setError(null);
  };

  const handleError = (error: unknown) => {
    console.error("Error in dynamic component:", error);
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else {
      message = "An unknown error occurred";
    }
    setError(message);
  };

  // Handle events from dynamic component
  const handleDynamicEvent = (event: any, data?: any) => {
    console.log("Dynamic component event:", event, "with data:", data);
    if (gameStarted && chatRef.current) {
      // Send event as a user message with recognizable prefix, including data
      const eventString = data ? `${event}: ${JSON.stringify(data)}` : event;
      chatRef.current.sendEventMessage(`[DYNAMIC_EVENT] ${eventString}`);
    }
  };

  const chatRef = useRef<any>(null);

  // Start the game
  const handleStartGame = () => {
    setGameStarted(true);
    // Automatically send initial message to start the adventure
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.sendEventMessage(
          "Hello! I'd like to start a new adventure.",
          true
        );
      }
    }, 100);
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Main Dynamic Component Area */}
      <div className={`flex-1 flex flex-col`}>
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {/* Ethereal floating orb */}
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600 rounded-full shadow-lg animate-[pulse_10s_ease-in-out_infinite]"></div>
              <div className="absolute inset-0 w-8 h-8 bg-gradient-to-br from-purple-300 via-blue-400 to-indigo-500 rounded-full opacity-60 animate-[ping_15s_ease-in-out_infinite]"></div>
              <div className="absolute inset-1 w-6 h-6 bg-white rounded-full opacity-20"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pathweaver</h1>
              <p className="text-gray-600 text-sm">
                Interactive AI Storytelling
              </p>
            </div>
          </div>

          {/* Loading indicator or rate limit countdown */}
          {gameStarted && (
            <>
              {rateLimitCountdown > 0 ? (
                <div className="flex items-center space-x-2 text-orange-600">
                  <div className="animate-pulse rounded-full h-4 w-4 bg-orange-600"></div>
                  <span className="text-sm">
                    Rate limited, retrying in{" "}
                    {Math.floor(rateLimitCountdown / 60)}m{" "}
                    {rateLimitCountdown % 60}s...
                  </span>
                </div>
              ) : isLoading ? (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Thinking...</span>
                </div>
              ) : null}
            </>
          )}
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          {/* Dynamic Component Area - Takes full space */}
          <div className="flex-1 min-h-0 overflow-y-auto relative">
            {!gameStarted ? (
              <div className="flex-1 h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center p-8">
                  <h1 className="text-4xl font-bold text-gray-800 mb-4">
                    Pathweaver
                  </h1>
                  <p className="text-xl text-gray-600 mb-8">
                    Interactive AI Storytelling Adventure
                  </p>
                  <button
                    onClick={handleStartGame}
                    className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Start Adventure
                  </button>
                </div>
              </div>
            ) : (
              <DynamicComponent
                onEvent={handleDynamicEvent}
                componentString={dynamicComponentCode || ""}
              />
            )}
            {error && (
              <div className="bg-red-500 text-white translate-x-[-50%] left-[50%] p-2 px-5 mx-auto max-content absolute bottom-5 rounded-md">
                Error - Please try again
                <br />
                {error}
              </div>
            )}
          </div>

          {/* Message Input - Fixed at bottom */}
          {gameStarted && (
            <div className="border-t bg-white p-4">
              <Chat
                ref={chatRef}
                config={config}
                onDynamicComponentUpdate={handleDynamicComponentUpdate}
                onError={handleError}
                onLoadingChange={setIsLoading}
              />
            </div>
          )}
        </main>
      </div>

      <InstallPrompt />
    </div>
  );
}

export default App;
