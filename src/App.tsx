import { useState, useEffect, useRef } from "react";
import Chat from "./components/Chat";
import DynamicComponent from "./components/DynamicComponent";
import InstallPrompt from "./components/InstallPrompt";
import Settings from "./components/Settings";
import Captions from "./components/Captions";
import { LLMConfig } from "./types";
import { LLMService } from "./services/llm";
import { ttsService } from "./services/tts";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSettings, setTTSSettings] = useState(ttsService.getSettings());
  const [currentSpeechText, setCurrentSpeechText] = useState("");
  const [hasReplayAvailable, setHasReplayAvailable] = useState(false);

  // Set up TTS callbacks for captions
  useEffect(() => {
    ttsService.setSpeechCallbacks(
      (text) => {
        setCurrentSpeechText(text);
      },
      undefined,
      () => {
        setCurrentSpeechText("");
      }
    );
  }, []);

  // Check TTS speaking status and settings periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeaking(ttsService.isSpeaking());
      setTTSSettings(ttsService.getSettings());
      setHasReplayAvailable(
        ttsService.hasLastSpokenText() && !ttsService.isSpeaking()
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

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
      chatRef.current.sendEventMessage(
        `[DYNAMIC_EVENT - respond to this specific user action and advance the story] ${eventString}`
      );
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

          {/* Right side of header */}
          <div className="flex items-center space-x-4">
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

            {/* TTS Controls - Only show when enabled */}
            {ttsSettings.enabled && (
              <>
                {/* Rate Control */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    className={`text-sm text-gray-600 ${
                      ttsSettings.rate === 1
                        ? "cursor-default"
                        : "cursor-pointer"
                    }`}
                    onClick={() => {
                      const newSettings = {
                        ...ttsSettings,
                        rate: parseFloat("1.0"),
                      };
                      ttsService.saveSettings(newSettings);
                      setTTSSettings(newSettings);
                    }}
                  >
                    Narration speed:
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={ttsSettings.rate}
                    onChange={(e) => {
                      const newSettings = {
                        ...ttsSettings,
                        rate: parseFloat(e.target.value),
                      };
                      ttsService.saveSettings(newSettings);
                      setTTSSettings(newSettings);
                    }}
                    className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    title={`Speech rate: ${ttsSettings.rate.toFixed(1)}x`}
                  />
                  <span className="text-xs text-gray-500 w-8">
                    {ttsSettings.rate.toFixed(1)}x
                  </span>
                </div>

                {/* Skip/Play Button */}
                {isSpeaking ? (
                  <button
                    onClick={() => ttsService.stop()}
                    className="px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-1"
                    title="Skip narration"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" />
                    </svg>
                    <span>Skip</span>
                  </button>
                ) : hasReplayAvailable ? (
                  <button
                    onClick={() => ttsService.replay()}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
                    title="Replay narration"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Play</span>
                  </button>
                ) : null}
              </>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
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

          {/* Captions Area - Between dynamic component and chat */}
          {gameStarted && (
            <Captions
              text={currentSpeechText}
              isVisible={
                ttsSettings.enabled && ttsSettings.showCaptions && isSpeaking
              }
            />
          )}

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
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
