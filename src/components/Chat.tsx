import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { LLMService } from "../services/llm";
import { ChatMessage, LLMConfig } from "../types";
import { ttsService } from "../services/tts";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { storyManager } from "../services/storyManager";

interface ChatProps {
  config: LLMConfig;
  onDynamicComponentUpdate: (code: string, modelName?: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: Error | null) => void;
  onUserMessage?: (message: ChatMessage) => void;
  onAIResponse?: (message: ChatMessage, componentCode?: string) => void;
}

const Chat = forwardRef<any, ChatProps>(
  (
    {
      config,
      onDynamicComponentUpdate,
      onLoadingChange,
      onError,
      onUserMessage,
      onAIResponse,
    },
    ref
  ) => {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [lastMessage, setLastMessage] = useState<string | null>(null);

    const lastMessageRef = useRef<HTMLDivElement>(null);

    const {
      isListening,
      transcript,
      isSupported,
      startListening,
      stopListening,
    } = useSpeechRecognition((finalText) => {
      console.log(
        "🎤 useSpeechRecognition onComplete callback called with:",
        finalText
      );
      if (finalText) {
        console.log("✅ Sending message from speech recognition:", finalText);
        handleSendMessage(finalText);
        setInput("");
      } else {
        console.warn("⚠️ onComplete called with empty text");
      }
    });

    useEffect(() => {
      console.log("📝 Transcript or isListening changed:", {
        transcript,
        isListening,
      });
      if (transcript && isListening) {
        console.log("✏️ Setting input to transcript:", transcript);
        setInput(transcript);
      }
    }, [transcript, isListening]);

    useImperativeHandle(ref, () => ({
      sendEventMessage: (eventMessage: string, isFirst: boolean = false) => {
        handleSendMessage(eventMessage, isFirst);
      },
      retryMessage: async (message: ChatMessage) => {
        console.log("Retrying message:", message);
        await handleSendMessage(message.content, false);
      },
    }));

    const animationFrameHandleRef = useRef<number | null>(null);
    const playLastMessage = (text: string) => {
      if (animationFrameHandleRef.current) {
        cancelAnimationFrame(animationFrameHandleRef.current);
        resetLastMessage();
      }
      setLastMessage(text);
      let startTime: number | undefined;
      const duration = 1000 * 3; // 3 seconds
      function resetLastMessage() {
        setLastMessage(null);
        if (lastMessageRef.current) {
          lastMessageRef.current.style.opacity = "0";
          lastMessageRef.current.style.top = "-20px";
        }
      }
      function animateLastMessage(timestamp: number) {
        if (startTime === undefined) {
          startTime = timestamp;
        }
        const elapsed = timestamp - startTime;

        if (timestamp > startTime + duration) {
          resetLastMessage();
          if (animationFrameHandleRef.current) {
            cancelAnimationFrame(animationFrameHandleRef.current);
          }
        } else {
          const progress = elapsed / duration;
          const opacity = 1 - progress;
          if (lastMessageRef.current) {
            lastMessageRef.current.style.position = "absolute";
            // float upward from top
            lastMessageRef.current.style.top = `${-150 + opacity * 150}px`;
            lastMessageRef.current.style.fontSize = "1.2rem";
            lastMessageRef.current.style.left = "20px";
            lastMessageRef.current.style.width = "max-content";
            lastMessageRef.current.style.width = "calc(100% - 110px)";
            lastMessageRef.current.style.opacity = opacity.toString();
          }
          animationFrameHandleRef.current =
            requestAnimationFrame(animateLastMessage);
        }
      }
      animationFrameHandleRef.current =
        requestAnimationFrame(animateLastMessage);
    };

    const handleSendMessage = async (
      messageText?: string,
      isFirst: boolean = false
    ) => {
      const text = messageText || input.trim();
      if (!text || isLoading) return;

      // Stop any ongoing narration when user sends a message
      ttsService.stop();

      console.log("Sending message to LLM:", { text, config });
      if (!isFirst && !text.includes("[DYNAMIC_EVENT")) {
        playLastMessage(text);
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      // Don't clear input yet - wait for successful response
      setIsLoading(true);
      onLoadingChange(true);

      // Store pending message immediately (before AI call)
      storyManager.setPendingUserMessage(userMessage);

      // Notify App.tsx about user message for auto-save
      if (onUserMessage) {
        onUserMessage(userMessage);
      }

      // Track component code from this interaction
      let componentCodeFromThisResponse: string | undefined;
      const originalOnDynamicComponentUpdate = onDynamicComponentUpdate;
      const wrappedOnDynamicComponentUpdate = (
        code: string,
        modelName?: string
      ) => {
        componentCodeFromThisResponse = code;
        originalOnDynamicComponentUpdate(code, modelName);
      };

      try {
        console.log("Calling LLMService.generateResponse...");
        const response = await LLMService.generateResponse(
          newMessages,
          config,
          wrappedOnDynamicComponentUpdate,
          onError
        );
        console.log("LLMService.generateResponse completed");

        // Create AI message and notify App.tsx for auto-save
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };

        if (onAIResponse) {
          onAIResponse(aiMessage, componentCodeFromThisResponse);
        }

        // Clear input only after successful response
        setInput("");
        onError(null); // Clear any previous errors
      } catch (error) {
        console.error("Error sending message:", error);
        // Keep input on error so user can retry
        // Note: pending message is still stored in storyManager for retry
      } finally {
        setIsLoading(false);
        onLoadingChange(false);
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    };

    const toggleListening = () => {
      console.log(
        "🎙️ Toggle listening button clicked, isListening:",
        isListening
      );
      if (isListening) {
        console.log("🛑 Stopping listening...");
        stopListening();
      } else {
        console.log("▶️ Starting listening...");
        startListening();
      }
    };

    return (
      <div className="flex items-stretch space-x-2 w-full relative">
        <div ref={lastMessageRef} className="absolute">
          {lastMessage && (
            <div className="whitespace-nowrap overflow-hidden text-ellipsis">
              {lastMessage}
            </div>
          )}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          name="user-message"
          onKeyPress={handleKeyPress}
          placeholder={isListening ? "Listening..." : "Type your message..."}
          disabled={isLoading}
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 z-10 resize-none self-stretch"
        />
        <div className="flex flex-col items-stretch gap-2">
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
          {isSupported && (
            <button
              onClick={toggleListening}
              disabled={isLoading}
              className={`flex justify-center px-4 py-3 rounded-lg transition-colors ${
                isListening
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-purple-600 hover:bg-purple-700"
              } text-white disabled:bg-gray-400 disabled:cursor-not-allowed`}
              title={isListening ? "Stop recording" : "Start recording"}
            >
              {isListening ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }
);

Chat.displayName = "Chat";

export default Chat;
