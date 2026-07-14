export interface SpeechChunk {
  text: string;
  pauseAfter: number;
}

export class SpeechManager {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private queue: SpeechChunk[] = [];
  private currentChunkIndex = 0;
  private playbackTimeout: NodeJS.Timeout | null = null;
  private safetyTimeout: NodeJS.Timeout | null = null;
  private isCancelled = false;

  private currentSpeechId: string | null = null;
  public currentPlaybackId: string | null = null;
  public spokenQuestionId: string | null = null;
  public speechRate = 0.95;
  public pitch = 1.0;
  public personality = "FAANG Style";

  private onStartCallback?: () => void;
  private onEndCallback?: () => void;

  constructor(options?: {
    rate?: number;
    pitch?: number;
    personality?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }) {
    if (options) {
      if (options.rate !== undefined) this.speechRate = options.rate;
      if (options.pitch !== undefined) this.pitch = options.pitch;
      if (options.personality !== undefined) this.personality = options.personality;
      this.onStartCallback = options.onStart;
      this.onEndCallback = options.onEnd;
    }
  }

  /**
   * Splits the speech text into paragraphs and sentences.
   * Delays are assigned to paragraphs (850ms) and sentences (400ms).
   */
  public chunkText(text: string): SpeechChunk[] {
    const paragraphs = text.split(/\n+/);
    const chunks: SpeechChunk[] = [];

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx].trim();
      if (!paragraph) continue;

      // Split sentences on . ! ? followed by space, avoiding acronyms
      const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const sentence = sentences[sIdx].trim();
        if (!sentence) continue;

        const isLastInParagraph = sIdx === sentences.length - 1;
        const isLastOverall = isLastInParagraph && pIdx === paragraphs.length - 1;

        chunks.push({
          text: sentence,
          pauseAfter: isLastOverall ? 0 : isLastInParagraph ? 850 : 400
        });
      }
    }
    return chunks;
  }

  public cancelPreviousSpeech() {
    this.cancel();
    this.currentSpeechId = null;
  }

  public speak(
    text: string,
    playbackId: string,
    questionId: string | null,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onStart?.();
      setTimeout(() => onEnd?.(), 1000);
      return;
    }

    // Ignore duplicate speech requests
    if (playbackId === this.currentSpeechId) {
      console.log(`[SpeechManager] Duplicate utterance ignored: ${playbackId}`);
      return;
    }

    // Cancel any active speech first
    this.cancelPreviousSpeech();

    this.isCancelled = false; // Reset cancellation flag
    this.currentSpeechId = playbackId;
    this.currentPlaybackId = playbackId;
    if (questionId) {
      this.spokenQuestionId = questionId;
    }

    if (onStart) this.onStartCallback = onStart;
    if (onEnd) this.onEndCallback = onEnd;

    this.queue = this.chunkText(text);
    this.currentChunkIndex = 0;

    if (this.queue.length === 0) {
      this.onEndCallback?.();
      return;
    }

    this.onStartCallback?.();
    this.playNext();
  }

  private playNext() {
    if (this.isCancelled) {
      console.log("[SpeechManager] playNext called after cancellation. Ignoring.");
      return;
    }

    if (this.currentChunkIndex >= this.queue.length) {
      this.onEndCallback?.();
      return;
    }

    const chunk = this.queue[this.currentChunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    this.activeUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((v) => v.lang.startsWith("en-") && v.name.includes("Google")) ||
      voices.find((v) => v.lang.startsWith("en-")) ||
      voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.rate = this.speechRate;
    utterance.pitch = this.pitch;

    const handleSpeechEnd = () => {
      if (this.isCancelled) {
        console.log("[SpeechManager] handleSpeechEnd called after cancellation. Ignoring.");
        return;
      }
      this.clearSafetyTimeout();
      this.activeUtterance = null;
      this.currentChunkIndex++;

      if (chunk.pauseAfter > 0) {
        this.playbackTimeout = setTimeout(() => this.playNext(), chunk.pauseAfter);
      } else {
        this.playNext();
      }
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = (e) => {
      console.warn("[SpeechManager] Chunk speaking error:", e);
      handleSpeechEnd();
    };

    // Calculate dynamic safety fallback timeout based on words count
    const wordCount = chunk.text.split(/\s+/).length;
    const expectedDurationMs = wordCount * (600 / this.speechRate) + 3000;
    this.safetyTimeout = setTimeout(() => {
      console.warn("[SpeechManager] Safety timeout triggered for chunk: " + chunk.text.substring(0, 20) + "...");
      window.speechSynthesis.cancel();
      handleSpeechEnd();
    }, expectedDurationMs);

    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }

  public cancel() {
    this.isCancelled = true;
    this.clearPlaybackTimeout();
    this.clearSafetyTimeout();

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterance = null;
    this.queue = [];
    this.currentChunkIndex = 0;
  }

  private clearPlaybackTimeout() {
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
  }

  private clearSafetyTimeout() {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
  }
}
