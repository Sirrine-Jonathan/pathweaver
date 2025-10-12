import { useState, useEffect, useRef } from "react";
import Chat from "./components/Chat";
import DynamicComponent from "./components/DynamicComponent";
import InstallPrompt from "./components/InstallPrompt";
import Settings from "./components/Settings";
import Captions from "./components/Captions";
import StorySidebar from "./components/StorySidebar";
import { LLMConfig, ChatMessage } from "./types";
import { LLMService } from "./services/llm";
import { ttsService } from "./services/tts";
import { storyManager } from "./services/storyManager";

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
  const [currentModelName, setCurrentModelName] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    model?: string;
    switchedModel?: boolean;
    retryModel?: string;
    message?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSettings, setTTSSettings] = useState(ttsService.getSettings());
  const [currentSpeechText, setCurrentSpeechText] = useState("");
  const [hasReplayAvailable, setHasReplayAvailable] = useState(false);

  // Story management state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Open by default
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<ChatMessage | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [storySidebarKey, setStorySidebarKey] = useState(0); // Force refresh

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
    LLMService.setRateLimitCallback((countdown, info) => {
      setRateLimitCountdown(countdown);
      if (info) {
        setRateLimitInfo(info);
      }
      if (countdown === 0) {
        setRateLimitInfo(null);
      }
    });
  }, []);

  // Handle dynamic component updates
  const handleDynamicComponentUpdate = (code: string, modelName?: string) => {
    console.log(
      "Updating dynamic component with code:",
      code,
      "from model:",
      modelName
    );
    setDynamicComponentCode(code);
    if (modelName) {
      setCurrentModelName(modelName);
    }
    setError(null);
  };

  const handleError = (error: unknown) => {
    console.error("Error in dynamic component:", error);
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else if (typeof error === "object" && error !== null) {
      // Handle error objects from the server (e.g., rate limit errors)
      const errorObj = error as {
        error?: string;
        details?: string;
        message?: string;
      };
      if (errorObj.details) {
        // If we have details, show both error and details
        message = errorObj.error
          ? `${errorObj.error}: ${errorObj.details}`
          : errorObj.details;
      } else if (errorObj.error) {
        message = errorObj.error;
      } else if (errorObj.message) {
        message = errorObj.message;
      } else {
        message = "An unknown error occurred";
      }
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
    // Create a new story
    const story = storyManager.createNewStory();
    setCurrentStoryId(story.id);
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

  // Handle new story creation
  const handleNewStory = () => {
    const story = storyManager.createNewStory();
    setCurrentStoryId(story.id);
    setGameStarted(true);
    setDynamicComponentCode(null);
    setError(null);
    // Automatically send initial message to start the new adventure
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.sendEventMessage(
          "Hello! I'd like to start a new adventure.",
          true
        );
      }
    }, 100);
  };

  // Handle loading a story
  const handleLoadStory = async (storyId: string, stepNumber?: number) => {
    try {
      const story = await storyManager.loadStory(storyId, stepNumber);
      setCurrentStoryId(story.id);
      setGameStarted(true);

      // Load the component code from the current step if it exists
      const currentStep = story.steps[story.currentStep - 1];
      if (currentStep?.componentCode) {
        setDynamicComponentCode(currentStep.componentCode);
      } else {
        setDynamicComponentCode(null);
      }

      setError(null);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error("Failed to load story:", error);
      setError("Failed to load story");
    }
  };

  // Handle deleting a story
  const handleDeleteStory = async (storyId: string) => {
    try {
      await storyManager.deleteStory(storyId);

      // If we deleted the current story, reset
      if (storyId === currentStoryId) {
        setCurrentStoryId(null);
        setGameStarted(false);
        setDynamicComponentCode(null);
      }
    } catch (error) {
      console.error("Failed to delete story:", error);
      setError("Failed to delete story");
    }
  };

  // Auto-save after AI responses
  const handleAIResponse = async (
    aiMessage: ChatMessage,
    componentCode?: string
  ) => {
    if (lastUserMessage && currentStoryId) {
      setIsSaving(true);
      try {
        await storyManager.addStep(lastUserMessage, aiMessage, componentCode);
        setLastUserMessage(null); // Clear after saving
        // Force sidebar to refresh
        setStorySidebarKey((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to save story step:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Main Dynamic Component Area */}
      <div className={`flex-1 flex flex-col min-w-0`}>
        <header className="bg-white border-b p-3 md:p-4 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              {/* Ethereal floating orb */}
              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600 rounded-full shadow-lg animate-[pulse_10s_ease-in-out_infinite]"></div>
              <div className="absolute inset-0 w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-purple-300 via-blue-400 to-indigo-500 rounded-full opacity-60 animate-[ping_15s_ease-in-out_infinite]"></div>
              <div className="absolute inset-1 w-4 h-4 md:w-6 md:h-6 bg-white rounded-full opacity-20"></div>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">
                Pathweaver
              </h1>
              <p className="text-gray-600 text-xs md:text-sm hidden sm:block">
                Interactive AI Storytelling
              </p>
            </div>
          </div>

          {/* Right side of header */}
          <div className="flex items-center space-x-1 md:space-x-4 flex-shrink-0">
            {/* Saving indicator - hidden on small screens */}
            {gameStarted && isSaving && (
              <div className="hidden sm:flex items-center space-x-2 text-green-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                <span className="text-xs">Saving...</span>
              </div>
            )}

            {/* TTS Controls - Only show when enabled */}
            {ttsSettings.enabled && (
              <>
                {/* Rate Control - hidden on mobile */}
                <div className="hidden lg:flex items-center space-x-2">
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

                {/* Skip/Play Button - compact on mobile */}
                {isSpeaking ? (
                  <button
                    onClick={() => ttsService.stop()}
                    className="px-2 py-1 md:px-3 md:py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-1"
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
                    <span className="hidden md:inline">Skip</span>
                  </button>
                ) : hasReplayAvailable ? (
                  <button
                    onClick={() => ttsService.replay()}
                    className="px-2 py-1 md:px-3 md:py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
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
                    <span className="hidden md:inline">Play</span>
                  </button>
                ) : null}
              </>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 md:h-6 md:w-6 text-gray-600"
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

            {/* Stories Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              title="Toggle stories sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 md:h-6 md:w-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Dynamic Component Area - Takes full space */}
          <div className="flex-1 min-h-0">
            <div className="relative h-full">
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
              {currentModelName && (
                <div className="absolute bottom-0 bg-slate-200 right-0 px-6 py-1 rounded-tl-lg opacity-80 text-xs text-gray-500 pointer-events-none">
                  {currentModelName}
                </div>
              )}
            </div>
          </div>

          {/* Captions/Status Area - Between dynamic component and chat */}
          {gameStarted && (
            <>
              {/* Rate limit / Model switch status */}
              {rateLimitCountdown > 0 || rateLimitInfo ? (
                <div
                  className={`w-full border-t ${
                    rateLimitInfo?.switchedModel
                      ? "bg-blue-50 border-blue-200"
                      : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <div
                    className={`p-4 flex items-center justify-center space-x-3 ${
                      rateLimitInfo?.switchedModel
                        ? "text-blue-700"
                        : "text-orange-700"
                    }`}
                  >
                    <div
                      className={`rounded-full h-4 w-4 ${
                        rateLimitInfo?.switchedModel
                          ? "bg-blue-500 animate-spin border-2 border-blue-200 border-t-transparent"
                          : "bg-orange-500 animate-pulse"
                      }`}
                    ></div>
                    <div className="text-center">
                      {rateLimitInfo?.switchedModel ? (
                        <>
                          <span className="font-semibold">
                            Switching Models
                          </span>
                          <span className="text-sm ml-2 block sm:inline">
                            Using{" "}
                            {rateLimitInfo.retryModel || rateLimitInfo.model}{" "}
                            instead
                          </span>
                        </>
                      ) : rateLimitCountdown > 0 ? (
                        <>
                          <span className="font-semibold">Rate Limited</span>
                          {rateLimitInfo?.model && (
                            <span className="text-xs block sm:inline sm:ml-2">
                              ({rateLimitInfo.model})
                            </span>
                          )}
                          <span className="text-sm ml-2 block sm:inline">
                            Retrying in {Math.floor(rateLimitCountdown / 60)}m{" "}
                            {rateLimitCountdown % 60}s
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : ttsSettings.enabled &&
                ttsSettings.showCaptions &&
                isSpeaking ? (
                /* Captions */
                <Captions text={currentSpeechText} isVisible={true} />
              ) : isLoading ? (
                /* Thinking indicator */
                <div className="w-full bg-blue-50 border-t border-blue-200">
                  <div className="p-4 flex items-center justify-center space-x-3 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <div className="text-center">
                      <span className="font-semibold">Thinking...</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
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
                onUserMessage={setLastUserMessage}
                onAIResponse={handleAIResponse}
              />
            </div>
          )}
        </main>
      </div>

      {/* Story Sidebar - Right side */}
      <StorySidebar
        key={storySidebarKey}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentStoryId={currentStoryId}
        onLoadStory={handleLoadStory}
        onNewStory={handleNewStory}
        onDeleteStory={handleDeleteStory}
      />

      <InstallPrompt />
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
