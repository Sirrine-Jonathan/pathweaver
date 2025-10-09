import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { LLMService } from "../services/llm";
import { ChatMessage, LLMConfig } from "../types";

interface ChatProps {
  config: LLMConfig;
  onDynamicComponentUpdate: (code: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: Error | null) => void;
}

const Chat = forwardRef<any, ChatProps>(
  ({ config, onDynamicComponentUpdate, onLoadingChange, onError }, ref) => {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [lastMessage, setLastMessage] = useState<string | null>(null);

    const lastMessageRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      sendEventMessage: (eventMessage: string, isFirst: boolean = false) => {
        handleSendMessage(eventMessage, isFirst);
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
      setInput("");
      setIsLoading(true);
      onLoadingChange(true);

      try {
        console.log("Calling LLMService.generateResponse...");
        await LLMService.generateResponse(
          newMessages,
          config,
          onDynamicComponentUpdate,
          onError
        );
        console.log("LLMService.generateResponse completed");
      } catch (error) {
        console.error("Error sending message:", error);
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

    return (
      <div className="flex items-start space-x-2 w-full relative">
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
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 z-10 h-24"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!input.trim() || isLoading}
          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    );
  }
);

Chat.displayName = "Chat";

export default Chat;
