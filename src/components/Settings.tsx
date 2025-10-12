import { useState, useEffect } from "react";
import { ttsService } from "../services/tts";
import { Voice, TTSSettings } from "../types";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings = ({ isOpen, onClose }: SettingsProps) => {
  const [settings, setSettings] = useState<TTSSettings>({
    enabled: false,
    voice: "Google US English Female",
    rate: 1.0,
    showCaptions: true,
  });
  const [voices, setVoices] = useState<Voice[]>([]);
  const [maleVoices, setMaleVoices] = useState<Voice[]>([]);
  const [femaleVoices, setFemaleVoices] = useState<Voice[]>([]);

  useEffect(() => {
    // Load current settings
    const currentSettings = ttsService.getSettings();
    setSettings(currentSettings);

    // Load available voices
    const availableVoices = ttsService.getAvailableVoices();
    setVoices(availableVoices);

    // Separate into male and female voices
    setMaleVoices(availableVoices.filter((v) => v.gender === "Male"));
    setFemaleVoices(availableVoices.filter((v) => v.gender === "Female"));
  }, [isOpen]);

  const handleToggleEnabled = () => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    setSettings(newSettings);
    ttsService.saveSettings(newSettings);
  };

  const handleVoiceChange = (voiceName: string) => {
    const newSettings = { ...settings, voice: voiceName };
    setSettings(newSettings);
    ttsService.saveSettings(newSettings);
  };

  const handleRateChange = (rate: number) => {
    const newSettings = { ...settings, rate };
    setSettings(newSettings);
    ttsService.saveSettings(newSettings);
  };

  const handleToggleCaptions = () => {
    const newSettings = { ...settings, showCaptions: !settings.showCaptions };
    setSettings(newSettings);
    ttsService.saveSettings(newSettings);
  };

  const handleTestVoice = () => {
    ttsService.speak("Hello! This is a test of the text-to-speech voice.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto-Read Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-gray-700 font-medium">
              Auto-Read Narration
            </label>
            <button
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Voice Selection */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Voice Selection
            </label>

            {/* Female Voices */}
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Female Voices</p>
              <select
                value={
                  femaleVoices.find((v) => v.name === settings.voice)
                    ? settings.voice
                    : ""
                }
                onChange={(e) => handleVoiceChange(e.target.value)}
                disabled={!settings.enabled}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select female voice...</option>
                {femaleVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.locale})
                  </option>
                ))}
              </select>
            </div>

            {/* Male Voices */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Male Voices</p>
              <select
                value={
                  maleVoices.find((v) => v.name === settings.voice)
                    ? settings.voice
                    : ""
                }
                onChange={(e) => handleVoiceChange(e.target.value)}
                disabled={!settings.enabled}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select male voice...</option>
                {maleVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.locale})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Speech Rate Control */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Speech Rate: {settings.rate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              disabled={!settings.enabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5x (Slower)</span>
              <span>1.0x (Normal)</span>
              <span>2.0x (Faster)</span>
            </div>
          </div>

          {/* Show Captions Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-gray-700 font-medium">Show Captions</label>
            <button
              onClick={handleToggleCaptions}
              disabled={!settings.enabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.showCaptions && settings.enabled
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.showCaptions ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Test Voice Button */}
          <div>
            <button
              onClick={handleTestVoice}
              disabled={!settings.enabled}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Test Voice
            </button>
          </div>

          {/* Info Text */}
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium mb-1">About Auto-Read:</p>
            <p>
              When enabled, the narrative text will be automatically read aloud
              using the selected voice as the story progresses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
