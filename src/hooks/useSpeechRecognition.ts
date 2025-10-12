import { useState, useEffect, useRef } from "react";

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export const useSpeechRecognition = (
  onComplete?: (finalText: string) => void
): UseSpeechRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef("");
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Keep the ref updated with the latest callback
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();

      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onaudiostart = () => {
        console.log("🎤 Audio capture started");
      };

      recognition.onaudioend = () => {
        console.log("🔇 Audio capture ended");
      };

      recognition.onsoundstart = () => {
        console.log("🔊 Sound detected");
      };

      recognition.onsoundend = () => {
        console.log("🔈 Sound ended");
      };

      recognition.onspeechstart = () => {
        console.log("🗣️ Speech detected");
      };

      recognition.onspeechend = () => {
        console.log("🤐 Speech ended");
      };

      recognition.onstart = () => {
        console.log("🟢 Speech recognition session started");
      };

      recognition.onresult = (event: any) => {
        console.log("🎯 Speech recognition result received", event);

        // Prevent processing if already completed
        if (completedRef.current) {
          console.log("⚠️ Already completed, ignoring result");
          return;
        }

        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript;
        }

        const combinedTranscript =
          finalTranscriptRef.current + interimTranscript;
        console.log("📝 Transcript updated:", {
          final: finalTranscriptRef.current,
          interim: interimTranscript,
          combined: combinedTranscript,
        });
        setTranscript(combinedTranscript);

        // Clear existing timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        // Set timeout for 2 seconds after any speech
        silenceTimeoutRef.current = setTimeout(() => {
          const finalText = finalTranscriptRef.current.trim();
          console.log("⏰ Silence timeout triggered, finalText:", finalText);

          // Double-check we haven't already completed
          if (finalText && onCompleteRef.current && !completedRef.current) {
            console.log("✅ Calling onComplete with:", finalText);
            completedRef.current = true;

            // Stop recognition AFTER setting the flag
            try {
              recognition.stop();
            } catch (e) {
              console.error("Error stopping recognition:", e);
            }

            // Call onComplete AFTER stopping
            onCompleteRef.current(finalText);
          }
        }, 2000);
      };

      recognition.onend = () => {
        console.log("🛑 Speech recognition ended");
        setIsListening(false);

        // Clear any pending timeouts
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        // Only use fallback if we haven't already completed
        // This prevents double-calling when timeout triggers stop()
        if (!completedRef.current) {
          const finalText = finalTranscriptRef.current.trim();
          console.log("🔄 onend fallback check, finalText:", finalText);

          if (finalText && onCompleteRef.current) {
            console.log("✅ Calling onComplete from fallback with:", finalText);
            completedRef.current = true;
            onCompleteRef.current(finalText);
          }
        } else {
          console.log("⏭️ Already completed, skipping onend fallback");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("❌ Speech recognition error:", event.error);
        console.error("Error details:", {
          error: event.error,
          message: event.message,
          type: event.type,
        });
        setIsListening(false);
      };
    } else {
      console.warn(
        "⚠️ Speech Recognition API is NOT supported in this browser"
      );
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - recognition instance should only be created once

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      console.log("🎙️ Starting speech recognition...");
      setTranscript("");
      finalTranscriptRef.current = "";
      completedRef.current = false;
      setIsListening(true);
      try {
        recognitionRef.current.start();
        console.log("✅ Speech recognition started successfully");
      } catch (error) {
        console.error("❌ Failed to start speech recognition:", error);
        setIsListening(false);
      }
    } else {
      console.log(
        "⚠️ Cannot start - recognitionRef:",
        !!recognitionRef.current,
        "isListening:",
        isListening
      );
    }
  };

  const stopListening = () => {
    console.log("🛑 Stopping speech recognition...");
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        console.log("✅ Speech recognition stopped successfully");
      } catch (error) {
        console.error("❌ Failed to stop speech recognition:", error);
      }
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  };

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
  };
};
