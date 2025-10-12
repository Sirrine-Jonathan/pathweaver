import { Voice, TTSSettings } from "../types";

// Default English voices that are commonly available across browsers
const DEFAULT_VOICES: Voice[] = [
  // Male voices
  { name: "Google US English Male", gender: "Male", locale: "en-US" },
  { name: "Google UK English Male", gender: "Male", locale: "en-GB" },
  {
    name: "Microsoft David - English (United States)",
    gender: "Male",
    locale: "en-US",
  },
  {
    name: "Microsoft George - English (United Kingdom)",
    gender: "Male",
    locale: "en-GB",
  },
  // Female voices
  { name: "Google US English Female", gender: "Female", locale: "en-US" },
  { name: "Google UK English Female", gender: "Female", locale: "en-GB" },
  {
    name: "Microsoft Zira - English (United States)",
    gender: "Female",
    locale: "en-US",
  },
  {
    name: "Microsoft Hazel - English (United Kingdom)",
    gender: "Female",
    locale: "en-GB",
  },
];

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private settings: TTSSettings;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private onSpeechStartCallback: ((text: string) => void) | null = null;
  private onBoundaryCallback: ((charIndex: number) => void) | null = null;
  private onSpeechEndCallback: (() => void) | null = null;
  private currentOriginalText: string = "";
  private lastSpokenText: string = "";

  constructor() {
    // Check if browser supports speech synthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;

      // Load voices
      this.loadVoices();

      // Some browsers need time to load voices
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }

    // Load settings from localStorage
    this.settings = this.loadSettings();
  }

  private loadVoices(): void {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  private loadSettings(): TTSSettings {
    try {
      const saved = localStorage.getItem("pathweaver-tts-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        // Ensure all required properties exist
        return {
          enabled: settings.enabled ?? false,
          voice: settings.voice ?? "Google US English Female",
          rate: settings.rate ?? 1.0,
          showCaptions: settings.showCaptions ?? true,
        };
      }
    } catch (error) {
      console.error("Error loading TTS settings:", error);
    }

    // Default settings - disabled by default
    return {
      enabled: false,
      voice: "Google US English Female",
      rate: 1.0,
      showCaptions: true,
    };
  }

  public saveSettings(settings: TTSSettings): void {
    this.settings = settings;
    try {
      localStorage.setItem("pathweaver-tts-settings", JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving TTS settings:", error);
    }
  }

  public getSettings(): TTSSettings {
    return { ...this.settings };
  }

  public getAvailableVoices(): Voice[] {
    if (!this.synth || this.voices.length === 0) {
      return DEFAULT_VOICES;
    }

    // Filter for English voices only
    const englishVoices = this.voices.filter(
      (voice) => voice.lang.startsWith("en-") || voice.lang === "en"
    );

    // Map to our Voice interface
    return englishVoices.map((voice) => ({
      name: voice.name,
      gender: this.inferGender(voice.name),
      locale: voice.lang,
    }));
  }

  private inferGender(voiceName: string): "Male" | "Female" {
    const lowerName = voiceName.toLowerCase();

    // Common male voice indicators
    const maleIndicators = [
      "male",
      "man",
      "david",
      "mark",
      "george",
      "daniel",
      "james",
      "thomas",
      "albert",
      "bruce",
      "eddy",
    ];

    // Common female voice indicators
    const femaleIndicators = [
      "female",
      "woman",
      "zira",
      "samantha",
      "victoria",
      "hazel",
      "susan",
      "karen",
      "heather",
      "aria",
      "jenny",
      "michelle",
    ];

    for (const indicator of maleIndicators) {
      if (lowerName.includes(indicator)) {
        return "Male";
      }
    }

    for (const indicator of femaleIndicators) {
      if (lowerName.includes(indicator)) {
        return "Female";
      }
    }

    // Default to Female if we can't determine
    return "Female";
  }

  private cleanTextForSpeech(text: string): string {
    return (
      text
        // Remove markdown bold/italic markers
        .replace(/\*\*\*/g, "") // Bold + italic
        .replace(/\*\*/g, "") // Bold
        .replace(/\*/g, "") // Italic
        .replace(/__/g, "") // Alternative bold
        .replace(/_/g, "") // Alternative italic
        // Remove markdown headers
        .replace(/^#{1,6}\s+/gm, "")
        // Remove markdown code blocks
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        // Remove markdown links but keep text
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
        // Remove HTML tags
        .replace(/<[^>]+>/g, "")
        // Remove emojis - comprehensive Unicode emoji ranges
        .replace(/[\u{1F600}-\u{1F64F}]/gu, " ") // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, " ") // Misc Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, " ") // Transport and Map
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, " ") // Regional country flags
        .replace(/[\u{2600}-\u{26FF}]/gu, " ") // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, " ") // Dingbats
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, " ") // Supplemental Symbols and Pictographs
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, " ") // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, " ") // Symbols and Pictographs Extended-A
        .replace(/[\u{FE00}-\u{FE0F}]/gu, " ") // Variation Selectors
        .replace(/[\u{1F000}-\u{1F02F}]/gu, " ") // Mahjong Tiles
        .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, " ") // Playing Cards
        // Clean up extra whitespace
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  public setSpeechCallbacks(
    onStart?: (text: string) => void,
    onBoundary?: (charIndex: number) => void,
    onEnd?: () => void
  ): void {
    this.onSpeechStartCallback = onStart || null;
    this.onBoundaryCallback = onBoundary || null;
    this.onSpeechEndCallback = onEnd || null;
  }

  public speak(text: string): void {
    if (!this.synth || !this.settings.enabled) {
      return;
    }

    // Stop any ongoing speech
    this.stop();

    // Store original text for callbacks and replay
    this.currentOriginalText = text;
    this.lastSpokenText = text;

    // Clean text for speech
    const cleanText = this.cleanTextForSpeech(text);

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Find the selected voice
    const selectedVoice = this.voices.find(
      (voice) => voice.name === this.settings.voice
    );

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Set speech parameters using settings
    utterance.rate = this.settings.rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Set up event handlers
    utterance.onstart = () => {
      if (this.onSpeechStartCallback) {
        this.onSpeechStartCallback(cleanText);
      }
    };

    utterance.onboundary = (event) => {
      if (this.onBoundaryCallback) {
        this.onBoundaryCallback(event.charIndex);
      }
    };

    utterance.onend = () => {
      if (this.onSpeechEndCallback) {
        this.onSpeechEndCallback();
      }
      this.currentOriginalText = "";
    };

    // Store reference to current utterance
    this.currentUtterance = utterance;

    // Speak
    this.synth.speak(utterance);
  }

  public getCurrentText(): string {
    return this.currentUtterance?.text || "";
  }

  public getOriginalText(): string {
    return this.currentOriginalText;
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  public pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  public resume(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }

  public isSupported(): boolean {
    return this.synth !== null;
  }

  public isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }

  public isPaused(): boolean {
    return this.synth ? this.synth.paused : false;
  }

  public hasLastSpokenText(): boolean {
    return this.lastSpokenText.length > 0;
  }

  public replay(): void {
    if (this.lastSpokenText && this.settings.enabled) {
      this.speak(this.lastSpokenText);
    }
  }
}

// Export singleton instance
export const ttsService = new TTSService();
