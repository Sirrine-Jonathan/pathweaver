import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { LLMService } from '../services/llm';
import { ChatMessage, LLMConfig } from '../types';

interface ChatProps {
  config: LLMConfig;
  onDynamicComponentUpdate: (code: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

const Chat = forwardRef<any, ChatProps>(({ config, onDynamicComponentUpdate, onLoadingChange }, ref) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useImperativeHandle(ref, () => ({
    sendEventMessage: (eventMessage: string) => {
      handleSendMessage(eventMessage);
    }
  }));

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    console.log('Sending message to LLM:', { text, config });

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    onLoadingChange(true);

    try {
      console.log('Calling LLMService.generateResponse...');
      await LLMService.generateResponse(
        newMessages,
        config,
        onDynamicComponentUpdate
      );
      console.log('LLMService.generateResponse completed');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex items-center space-x-2 w-full">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        disabled={isLoading}
        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
});

Chat.displayName = 'Chat';

export default Chat;
