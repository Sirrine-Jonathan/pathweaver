import React, { useState, useEffect, useRef } from 'react';
import Chat from './components/Chat';
import DynamicComponent from './components/DynamicComponent';
import { LLMConfig } from './types';
import * as Babel from '@babel/standalone';

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: 'http://localhost:8080',
  apiKey: '',
  model: 'llama-3.3-70b-versatile', // Use the newest, most capable model
  temperature: 0.7,
  maxTokens: 2000,
};

interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

const DYNAMIC_COMPONENT_CODE_KEY = 'pathweaver_dynamic_component_code';

function App() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [dynamicComponentCode, setDynamicComponentCode] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<GroqModel[]>([]);
  const [recommendedModel, setRecommendedModel] = useState<string>('llama-3.1-8b-instant');

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pathweaver-config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading config:', error);
      }
    }
    
    // Fetch available models
    fetchAvailableModels();
  }, []);

  // Fetch available models from server
  const fetchAvailableModels = async () => {
    console.log('🔍 Fetching available models...');
    try {
      const response = await fetch('http://localhost:8080/api/models');
      console.log('📡 Models API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Received models data:', data);
        setAvailableModels(data.models);
        setRecommendedModel(data.recommended);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch models:', response.status, errorText);
      }
    } catch (error) {
      console.error('💥 Failed to fetch models:', error);
    }
  };

  // Handle dynamic component updates
  const handleDynamicComponentUpdate = (code: string) => {
    console.log('Updating dynamic component with code:', code);
    setDynamicComponentCode(code);
  };

  // Handle events from dynamic component
  const handleDynamicEvent = (event: any, data?: any) => {
    console.log('Dynamic component event:', event, 'with data:', data);
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
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Main Dynamic Component Area */}
      <div className={`flex-1 flex flex-col`}>
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🎭</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pathweaver</h1>
              <p className="text-gray-600 text-sm">Interactive AI Storytelling</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
        </header>

        <main className="flex-1 flex min-h-0">
          {/* Dynamic Component Area - Takes up most space */}
          <div className="flex-1 min-h-0">
            {!gameStarted ? (
              <div className="flex-1 h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center p-8">
                  <h1 className="text-4xl font-bold text-gray-800 mb-4">Pathweaver</h1>
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
                componentString={dynamicComponentCode || ''} 
              />
            )}
          </div>

          {/* Chat Sidebar - Only show when game started */}
          {gameStarted && (
            <div className="w-96 border-l bg-white flex flex-col">
              <div className="flex-1 min-h-0">
                <Chat 
                  ref={chatRef}
                  config={config} 
                  onDynamicComponentUpdate={handleDynamicComponentUpdate}
                />
              </div>
            </div>
          )}

          {/* Settings Sidebar */}
          {isSettingsOpen && (
            <div className="w-80 border-l bg-white flex flex-col">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Settings</h2>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-4 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Model
                  </label>
                  <select
                    value={config.model}
                    onChange={(e) => {
                      const newConfig = { ...config, model: e.target.value };
                      setConfig(newConfig);
                      localStorage.setItem('pathweaver-config', JSON.stringify(newConfig));
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {availableModels.length > 0 ? (
                      availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.id} {model.id === recommendedModel ? '(Recommended)' : ''}
                        </option>
                      ))
                    ) : (
                      <option value={config.model}>{config.model} (Loading models...)</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose the AI model for your adventure
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature: {config.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => {
                      const newConfig = { ...config, temperature: parseFloat(e.target.value) };
                      setConfig(newConfig);
                      localStorage.setItem('pathweaver-config', JSON.stringify(newConfig));
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Higher = more creative, Lower = more focused
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    step="100"
                    value={config.maxTokens}
                    onChange={(e) => {
                      const newConfig = { ...config, maxTokens: parseInt(e.target.value) };
                      setConfig(newConfig);
                      localStorage.setItem('pathweaver-config', JSON.stringify(newConfig));
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum response length
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
