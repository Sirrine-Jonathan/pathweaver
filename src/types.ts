export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface GameSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TTSSettings {
  enabled: boolean;
  voice: string;
  rate: number;
  showCaptions: boolean;
}

export interface Voice {
  name: string;
  gender: "Male" | "Female";
  locale: string;
}
