import React, { useState, useEffect, useRef } from 'react';
import Chat from './components/Chat';
import ConfigPanel from './components/ConfigPanel';
import DynamicComponent from './components/DynamicComponent';
import { LLMConfig } from './types';
import * as Babel from '@babel/standalone';

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: 'https://internal-ai-gateway.ancestryl1.int',
  apiKey: '',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
};

const DYNAMIC_COMPONENT_CODE_KEY = 'pathweaver_dynamic_component_code';

function App() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [dynamicComponentCode, setDynamicComponentCode] = useState<string | null>(null);
  const [DynamicComponentRendered, setDynamicComponentRendered] = useState<React.ComponentType<any> | null>(null);

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pathweaver-config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading config:', error);
      }
    } else {
      setIsConfigOpen(true); // Open config panel if no config exists
    }

    // Load dynamic component code
    const savedCode = localStorage.getItem(DYNAMIC_COMPONENT_CODE_KEY);
    if (savedCode) {
      setDynamicComponentCode(savedCode);
    }
  }, []);

  // Save config to localStorage
  const handleConfigChange = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem('pathweaver-config', JSON.stringify(newConfig));
  };

  // Handle dynamic component updates
  const handleDynamicComponentUpdate = (code: string) => {
    console.log('Updating dynamic component with code:', code);
    setDynamicComponentCode(code);
    localStorage.setItem(DYNAMIC_COMPONENT_CODE_KEY, code);
  };

  // Handle events from dynamic component
  const handleDynamicEvent = (event: any) => {
    console.log('Dynamic component event:', event);
    if (gameStarted && chatRef.current) {
      // Send event as a user message with recognizable prefix
      const eventString = typeof event === 'string' ? event : JSON.stringify(event);
      chatRef.current.sendEventMessage(`[DYNAMIC_EVENT] ${eventString}`);
    }
  };

  const chatRef = useRef<any>(null);

  // Start the game
  const handleStartGame = () => {
    setGameStarted(true);
  };

  // Transpile and evaluate dynamic component code
  useEffect(() => {
    if (!dynamicComponentCode) {
      setDynamicComponentRendered(null);
      return;
    }

    try {
      // Wrap code in a function that returns a React component
      const wrappedCode = `
        (function(React) {
          ${dynamicComponentCode}
          return AiDynamicComponent;
        })
      `;

      // Transpile to ES5 using Babel
      const transpiled = Babel.transform(wrappedCode, {
        presets: ["react", "env"],
      }).code;

      // eslint-disable-next-line no-new-func
      const componentFactory = eval(transpiled);
      const Comp = componentFactory(React);
      setDynamicComponentRendered(() => Comp);
      
      console.log('Successfully loaded dynamic component');
    } catch (error) {
      console.error('Error loading dynamic component:', error);
      // Show error component
      setDynamicComponentRendered(() => () => (
        <div className="flex-1 h-full w-full flex items-center justify-center bg-red-50">
          <div className="text-center p-8">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-red-800 mb-2">Component Error</h2>
            <p className="text-red-600 mb-4">Failed to load dynamic component</p>
            <pre className="text-xs text-left bg-red-100 p-2 rounded max-w-md overflow-auto">
              {String(error)}
            </pre>
          </div>
        </div>
      ));
    }
  }, [dynamicComponentCode]);

  const isConfigured = config.apiKey.trim() !== '' && config.baseUrl.trim() !== '';

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Main Dynamic Component Area */}
      <div className={`flex-1 flex flex-col ${isConfigOpen ? 'mr-80' : ''}`}>
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pathweaver</h1>
            <p className="text-gray-600">Interactive AI Storytelling</p>
          </div>
        </header>

        <main className="flex-1 flex min-h-0">
          {/* Dynamic Component Area - Takes up most space */}
          <div className="flex-1 min-h-0">
            {!isConfigured ? (
              <div className="flex-1 h-full flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Welcome to Pathweaver!</h2>
                  <p className="text-gray-600 mb-4">
                    Configure your LLM settings to start your adventure.
                  </p>
                  <button
                    onClick={() => setIsConfigOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Configure LLM
                  </button>
                </div>
              </div>
            ) : !gameStarted ? (
              <div className="flex-1 h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center p-8">
                  <div className="text-8xl mb-6">🎮</div>
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
              DynamicComponentRendered ? (
                <DynamicComponentRendered onEvent={handleDynamicEvent} />
              ) : (
                <DynamicComponent 
                  onEvent={handleDynamicEvent} 
                  componentString={dynamicComponentCode || ''} 
                />
              )
            )}
          </div>

          {/* Chat Sidebar - Only show when game started */}
          {gameStarted && (
            <div className="w-96 border-l bg-white flex flex-col">
              <div className="p-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-800">Game Master</h3>
              </div>
              <div className="flex-1 min-h-0">
                <Chat 
                  ref={chatRef}
                  config={config} 
                  onDynamicComponentUpdate={handleDynamicComponentUpdate}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Config Panel */}
      <ConfigPanel
        config={config}
        onConfigChange={handleConfigChange}
        isOpen={isConfigOpen}
        onToggle={() => setIsConfigOpen(!isConfigOpen)}
      />
    </div>
  );
}

export default App;
