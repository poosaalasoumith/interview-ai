export class RecognitionManager {
  private recognition: any = null;
  private isStarted = false;

  private onStartCallback?: () => void;
  private onEndCallback?: () => void;
  private onResultCallback?: (data: { final: string; interim: string; confidence?: number }) => void;
  private onErrorCallback?: (error: string) => void;

  // Fallback MediaRecorder properties
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentStream: MediaStream | null = null;
  public recognitionEngineMode: "web-speech" | "gemini-stt" = "web-speech";
  public recognitionState: "started" | "stopped" | "error" = "stopped";

  constructor(options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onResult?: (data: { final: string; interim: string; confidence?: number }) => void;
    onError?: (error: string) => void;
  }) {
    if (options) {
      this.onStartCallback = options.onStart;
      this.onEndCallback = options.onEnd;
      this.onResultCallback = options.onResult;
      this.onErrorCallback = options.onError;
    }
  }

  public start(stream?: MediaStream) {
    if (typeof window === "undefined") return;

    this.recognitionState = "started";
    this.audioChunks = [];
    this.currentStream = stream || null;

    // 1. Initialize and start background MediaRecorder backup
    if (stream && window.MediaRecorder) {
      try {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
        this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        this.mediaRecorder.onstop = async () => {
          if (this.recognitionEngineMode === "gemini-stt" && this.audioChunks.length > 0) {
            await this.transcribeAudioChunks();
          }
        };
        this.mediaRecorder.start(250);
        console.log("[RecognitionManager] Background MediaRecorder backup started.");
      } catch (e) {
        console.warn("[RecognitionManager] Failed to start MediaRecorder backup:", e);
      }
    }

    // 2. Start browser Web Speech Recognition
    if (this.recognitionEngineMode === "web-speech") {
      if (this.recognition) {
        try {
          this.recognition.onstart = null;
          this.recognition.onresult = null;
          this.recognition.onerror = null;
          this.recognition.onend = null;
          this.recognition.abort();
        } catch (e) {}
        this.recognition = null;
      }
      this.isStarted = false;

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn("[RecognitionManager] Web Speech API not supported. Falling back to Gemini STT.");
        this.recognitionEngineMode = "gemini-stt";
        this.onStartCallback?.();
        return;
      }

      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this.isStarted = true;
          this.onStartCallback?.();
        };

        this.recognition.onresult = (event: any) => {
          let interim = "";
          let final = "";
          let confidence = 1.0;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
              confidence = event.results[i][0].confidence || 1.0;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          this.onResultCallback?.({ final, interim, confidence });
        };

        this.recognition.onerror = (event: any) => {
          const errorType = event.error || "unknown";
          console.warn("[RecognitionManager] Web Speech API error:", errorType);
          this.recognitionState = "error";

          if (errorType === "no-speech") {
            return;
          }

          // Switch engine to Gemini fallback if we hit a permission/service issue
          if (["not-allowed", "service-not-allowed", "network"].includes(errorType)) {
            console.log("[RecognitionManager] Web Speech API failed. Switching to Gemini STT fallback.");
            this.recognitionEngineMode = "gemini-stt";
          }

          this.onErrorCallback?.(errorType);
        };

        this.recognition.onend = () => {
          this.isStarted = false;
          if (this.recognitionEngineMode === "web-speech") {
            this.recognitionState = "stopped";
            this.onEndCallback?.();
          }
        };

        this.recognition.start();
      } catch (e) {
        console.warn("[RecognitionManager] Failed to start Web Speech Recognition:", e);
        this.recognitionEngineMode = "gemini-stt";
        this.onStartCallback?.();
      }
    } else {
      // Direct fallback mode
      this.onStartCallback?.();
    }
  }

  public stop() {
    this.recognitionState = "stopped";

    // Stop browser recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isStarted = false;

    // Stop MediaRecorder (triggers transcription onstop in gemini-stt mode)
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    this.onEndCallback?.();
  }

  public abort() {
    this.recognitionState = "stopped";

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
    this.isStarted = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
  }

  public get active(): boolean {
    return this.isStarted || (this.mediaRecorder !== null && this.mediaRecorder.state === "recording");
  }

  /**
   * Compiles the recorded audio chunks and uploads them to the fallback STT endpoint.
   */
  public async transcribeAudioChunks() {
    if (this.audioChunks.length === 0) return;
    console.log("[RecognitionManager] Sending recorded audio to fallback STT API...");
    
    // Notify the UI we are transcribing audio
    this.onResultCallback?.({ final: "", interim: "[Transcribing fallback audio...]" });

    try {
      const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      const response = await fetch("/api/ai/stt", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.transcript) {
        console.log("[RecognitionManager] Fallback STT transcription received:", data.transcript);
        this.onResultCallback?.({ final: data.transcript, interim: "", confidence: 0.95 });
      } else {
        console.log("[RecognitionManager] Fallback STT returned empty transcription.");
        this.onResultCallback?.({ final: "", interim: "" });
      }
    } catch (e: any) {
      console.warn("[RecognitionManager] Fallback STT API failed:", e);
      this.onErrorCallback?.(`stt-api-failed: ${e.message}`);
    }
  }
}
