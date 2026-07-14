export class VADManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private lastSpeechTime = 0;

  public volumeThreshold = 0.015; // Speaking amplitude threshold
  public silenceTimeoutMs = 1800; // Customizable silence limit (1.2-2 seconds)

  // Real-time diagnostics
  public isConnected = false;
  public currentVolume = 0;
  public framesPerSecond = 0;
  public isSpeechDetected = false;
  public silenceDurationMs = 0;

  private onVoiceStart?: () => void;
  private onVoiceEnd?: () => void;
  private onSilenceFinalized?: () => void;
  private onVolumeChange?: (volume: number) => void;

  public isSpeaking = false;
  public hasSpokenSomething = false;

  constructor(options?: {
    threshold?: number;
    silenceTimeoutMs?: number;
    onVoiceStart?: () => void;
    onVoiceEnd?: () => void;
    onSilenceFinalized?: () => void;
    onVolumeChange?: (volume: number) => void;
  }) {
    if (options) {
      if (options.threshold !== undefined) this.volumeThreshold = options.threshold;
      if (options.silenceTimeoutMs !== undefined) this.silenceTimeoutMs = options.silenceTimeoutMs;
      this.onVoiceStart = options.onVoiceStart;
      this.onVoiceEnd = options.onVoiceEnd;
      this.onSilenceFinalized = options.onSilenceFinalized;
      this.onVolumeChange = options.onVolumeChange;
    }
  }

  public start(stream: MediaStream) {
    this.stop();

    if (typeof window === "undefined") return;

    try {
      this.micStream = stream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("[VADManager] Web Audio API not supported in this browser.");
        return;
      }

      this.audioContext = new AudioContextClass();
      
      const audioTracks = stream.getAudioTracks();
      const settings = audioTracks[0]?.getSettings();
      console.log("[VADManager] Microphone connected:", {
        sampleRate: settings?.sampleRate || this.audioContext.sampleRate,
        deviceId: settings?.deviceId,
        label: audioTracks[0]?.label,
        active: stream.active
      });

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.lastSpeechTime = Date.now();
      this.isSpeaking = false;
      this.hasSpokenSomething = false;
      this.isConnected = true;

      this.monitorVolume();
    } catch (e) {
      console.warn("[VADManager] Failed to start AudioContext VAD:", e);
    }
  }

  public setHasSpokenSomething(val: boolean) {
    this.hasSpokenSomething = val;
    if (val) {
      this.lastSpeechTime = Date.now();
    }
  }

  private monitorVolume() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    let lastFpsTime = Date.now();
    let frameCount = 0;

    const check = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(dataArray);

      frameCount++;
      const now = Date.now();
      if (now - lastFpsTime >= 1000) {
        this.framesPerSecond = frameCount;
        frameCount = 0;
        lastFpsTime = now;
      }

      // Root Mean Square (RMS) calculation for volume amplitude
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);

      // Map RMS to a visualizer height value (0-100 scale)
      const mappedVolume = Math.min(Math.floor(rms * 250), 100);
      this.currentVolume = mappedVolume;
      this.onVolumeChange?.(mappedVolume);

      if (rms > this.volumeThreshold) {
        this.lastSpeechTime = now;
        this.hasSpokenSomething = true; // Flag immediate speech detection for auto-silence timer
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.isSpeechDetected = true;
          this.onVoiceStart?.();
        }
      } else {
        // Filter tiny micro-pauses by verifying silence duration
        if (this.isSpeaking && now - this.lastSpeechTime > 300) {
          this.isSpeaking = false;
          this.isSpeechDetected = false;
          this.onVoiceEnd?.();
        }

        const silenceDuration = now - this.lastSpeechTime;
        this.silenceDurationMs = this.isSpeaking ? 0 : Math.max(0, silenceDuration);

        if (this.hasSpokenSomething && silenceDuration >= this.silenceTimeoutMs) {
          console.log(`[VADManager] Silence threshold matched: ${silenceDuration}ms. Auto-finalizing speech.`);
          this.hasSpokenSomething = false;
          this.onSilenceFinalized?.();
        }
      }

      this.animationFrameId = requestAnimationFrame(check);
    };

    check();
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try {
        if (this.audioContext.state !== "closed") {
          this.audioContext.close();
        }
      } catch (e) {}
      this.audioContext = null;
    }

    this.analyser = null;
    this.micStream = null;
    this.isSpeaking = false;
    this.hasSpokenSomething = false;
    this.isConnected = false;
    this.currentVolume = 0;
    this.framesPerSecond = 0;
    this.isSpeechDetected = false;
    this.silenceDurationMs = 0;
  }
}
