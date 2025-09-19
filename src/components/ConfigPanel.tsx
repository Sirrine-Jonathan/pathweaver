import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { LLMConfig } from '../types';
import { LLMService } from '../services/llm';

interface ConfigPanelProps {
  config: LLMConfig;
  onConfigChange: (config: LLMConfig) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ConfigPanel({ config, onConfigChange, isOpen, onToggle }: ConfigPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const handleChange = (field: keyof LLMConfig, value: any) => {
    onConfigChange({ ...config, [field]: value });
  };

  const fetchModels = async () => {
    if (!config.baseUrl || !config.apiKey) return;
    
    setIsLoadingModels(true);
    try {
      const models = await LLMService.fetchAvailableModels(config.baseUrl, config.apiKey);
      setAvailableModels(models);
      
      // If current model isn't in the list and we have models, select the first one
      if (models.length > 0 && !models.find(m => m.id === config.model)) {
        handleChange('model', models[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Auto-fetch models when baseUrl and apiKey are available
  useEffect(() => {
    if (config.baseUrl && config.apiKey) {
      fetchModels();
    }
  }, [config.baseUrl, config.apiKey]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
      >
        <Settings className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 w-80 h-full bg-white border-l shadow-lg p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">LLM Configuration</h2>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-100 rounded"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium mb-1">Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => handleChange('baseUrl', e.target.value)}
            placeholder="https://your-llm-endpoint.com"
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium mb-1">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder="Enter your API key"
              className="w-full p-2 pr-10 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Model</label>
            <button
              onClick={fetchModels}
              disabled={!config.baseUrl || !config.apiKey || isLoadingModels}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh models"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {availableModels.length > 0 ? (
            <select
              value={config.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={config.model}
              onChange={(e) => handleChange('model', e.target.value)}
              placeholder="gpt-4, claude-3-opus, etc."
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          
          {isLoadingModels && (
            <p className="text-xs text-gray-500 mt-1">Loading available models...</p>
          )}
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Temperature: {config.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium mb-1">Max Tokens</label>
          <input
            type="number"
            value={config.maxTokens}
            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
            min="100"
            max="4000"
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          <p className="font-medium mb-2">Getting Started:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Enter your LLM endpoint URL</li>
            <li>Enter your API key</li>
            <li>Click refresh to load available models</li>
            <li>Start chatting to begin your adventure!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
