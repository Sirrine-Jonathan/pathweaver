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

export interface StoryStep {
  stepNumber: number;
  userMessage: ChatMessage;
  aiResponse: ChatMessage;
  componentCode?: string;
  timestamp: Date;
}

export interface Story {
  id: string;
  title: string;
  steps: StoryStep[];
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorySummary {
  id: string;
  title: string;
  stepCount: number;
  lastPlayed: Date;
  preview: string;
}
