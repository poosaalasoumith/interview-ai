import { SpeechManager } from "./SpeechManager";
import { VADManager } from "./VADManager";
import { RecognitionManager } from "./RecognitionManager";
import { ConversationManager, ConversationTurn } from "./ConversationManager";
import { ReportEngine } from "./ReportEngine";

export type InterviewerState =
  | "INITIALIZING"
  | "GREETING"
  | "QUESTION_GENERATION"
  | "AI_SPEAKING"
  | "WAITING_FOR_TTS_FINISH"
  | "START_MIC"
  | "LISTENING"
  | "SPEECH_DETECTED"
  | "TRANSCRIBING"
  | "FINAL_TRANSCRIPT"
  | "ANALYZING"
  | "GENERATING_RESPONSE"
  | "FOLLOW_UP_REQUIRED"
  | "NEXT_QUESTION"
  | "FINAL_FEEDBACK"
  | "REPORT_GENERATION"
  | "SESSION_COMPLETE";

export interface OrchestratorLog {
  timestamp: string;
  interviewId: string;
  questionId: string;
  currentState: InterviewerState;
  nextState: InterviewerState;
  micState: "ON" | "OFF" | "SUSPENDED";
  ttsState: "PLAYING" | "IDLE" | "PAUSED";
  transcript: string;
  speechConfidence: number;
  silenceDuration: number;
  aiResponseTime: number;
  errors: string | null;
}

export interface VoiceDiagnostics {
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  mediaStreamStatus: "active" | "inactive" | "null";
  audioLevel: number;
  framesPerSecond: number;
  vadState: "idle" | "speaking" | "silence_countdown";
  recognitionState: "started" | "stopped" | "error";
  transcriptLength: number;
  recognitionConfidence: number;
  currentState: InterviewerState;
  currentQuestion: string;
  currentQuestionIndex: number;
  currentTurn: number;
  sessionId: string;
  sttEngineName: string;
  activeMicrophone: string;
  sampleRate: number;
  audioLatency: number;
  lastTranscriptTimestamp: string;
  lastAiResponseTimestamp: string;
  ttsState: "PLAYING" | "IDLE" | "PAUSED";
  partialTranscript: string;
  finalTranscript: string;
  sttRunningStatus: "active" | "inactive";
  aiProcessingState: "idle" | "processing";
}

export class InterviewOrchestrator {
  public state: InterviewerState = "INITIALIZING";
  public speechManager: SpeechManager;
  public vadManager: VADManager;
  public recognitionManager: RecognitionManager;
  public conversationManager: ConversationManager;
  public onFinishCallback?: () => void;

  public logs: OrchestratorLog[] = [];
  public micState: "ON" | "OFF" | "SUSPENDED" = "OFF";
  public ttsState: "PLAYING" | "IDLE" | "PAUSED" = "IDLE";

  private stateTimer: NodeJS.Timeout | null = null;
  private stateRetryCount = 0;
  private lastStateTransitionTime = Date.now();

  private isReconnecting = false;
  private diagnosticsInterval: NodeJS.Timeout | null = null;

  // Diagnostics internal values
  public micPermission: VoiceDiagnostics["micPermission"] = "unknown";
  public activeMicLabel = "None";
  public activeMicSampleRate = 0;
  public lastAudioLatency = 0;
  public lastTranscriptTimeStr = "None";
  public lastAiResponseTimeStr = "None";
  public recognitionConfidence = 1.0;

  private onStateChangeCallbacks: ((state: InterviewerState) => void)[] = [];
  private onLogsChangeCallbacks: ((logs: OrchestratorLog[]) => void)[] = [];
  private onChatLogChangeCallbacks: ((chatLog: ConversationTurn[]) => void)[] = [];
  private onVolumeChangeCallbacks: ((volume: number) => void)[] = [];
  private onInterimTextChangeCallbacks: ((text: string) => void)[] = [];
  private onCandidateTextChangeCallbacks: ((text: string) => void)[] = [];
  private onDiagnosticsCallbacks: ((diagnostics: VoiceDiagnostics) => void)[] = [];

  public micStream: MediaStream | null = null;
  public candidateText = "";
  public interimText = "";
  public micVolume = 0;

  constructor(interviewId: string) {
    this.conversationManager = new ConversationManager(interviewId);

    this.speechManager = new SpeechManager({
      onStart: () => {
        this.ttsState = "PLAYING";
        this.logEvent(this.state, this.state, null);
        
        // Prevent race condition: verify we are in a speaking/greeting state before transitioning
        if (this.state === "AI_SPEAKING" || this.state === "GREETING") {
          this.transitionTo("WAITING_FOR_TTS_FINISH");
        }
      },
      onEnd: () => {
        this.ttsState = "IDLE";
        this.logEvent(this.state, this.state, null);
        
        // Prevent race conditions: if state has already transitioned (e.g. candidate interrupted), ignore
        if (this.state !== "WAITING_FOR_TTS_FINISH" && this.state !== "AI_SPEAKING" && this.state !== "GREETING") {
          console.log("[InterviewOrchestrator] TTS finished after state transition occurred. Ignoring.");
          return;
        }

        if (this.state === "WAITING_FOR_TTS_FINISH" || this.state === "AI_SPEAKING" || this.state === "GREETING") {
          this.transitionTo("START_MIC");
        } else if (this.state === "FINAL_FEEDBACK") {
          this.transitionTo("REPORT_GENERATION");
        }
      }
    });

    this.vadManager = new VADManager({
      onVoiceStart: () => {
        // Interruption handling: candidate speaking while AI is speaking
        if (this.state === "AI_SPEAKING" || this.state === "WAITING_FOR_TTS_FINISH") {
          this.handleInterruption();
        } else if (this.state === "LISTENING") {
          this.transitionTo("SPEECH_DETECTED");
        }
      },
      onSilenceFinalized: () => {
        // Prevent out-of-order VAD silence updates
        if (this.state === "SPEECH_DETECTED" || this.state === "LISTENING") {
          if (this.candidateText.trim() || this.interimText.trim()) {
            this.transitionTo("TRANSCRIBING");
          } else {
            console.log("[InterviewOrchestrator] Silence detected but no speech recognized. Staying in LISTENING.");
            this.vadManager.setHasSpokenSomething(false);
            if (this.state === "SPEECH_DETECTED") {
              this.transitionTo("LISTENING");
            }
          }
        }
      },
      onVolumeChange: (vol) => {
        this.micVolume = vol;
        this.notifyVolumeChange(vol);
      }
    });

    this.recognitionManager = new RecognitionManager({
      onStart: () => {
        this.micState = "ON";
        this.logEvent(this.state, this.state, null);
      },
      onEnd: () => {
        this.micState = "OFF";
        this.logEvent(this.state, this.state, null);

        // Auto-reconnect SpeechRecognition if it unexpectedly ends while listening
        if (
          (this.state === "LISTENING" || this.state === "SPEECH_DETECTED") &&
          !this.isReconnecting &&
          this.recognitionManager.recognitionEngineMode === "web-speech"
        ) {
          setTimeout(() => {
            if (
              (this.state === "LISTENING" || this.state === "SPEECH_DETECTED") &&
              !this.isReconnecting &&
              this.recognitionManager.recognitionEngineMode === "web-speech"
            ) {
              this.recognitionManager.start(this.micStream || undefined);
            }
          }, 300);
        }
      },
      onResult: (data) => {
        // Handle streaming results
        if (data.final) {
          const trimmed = data.final.trim();
          this.candidateText += (this.candidateText === "" || this.candidateText.endsWith(" ") ? "" : " ") + trimmed;
          this.notifyCandidateTextChange(this.candidateText);
          
          this.interimText = "";
          this.notifyInterimTextChange("");
          
          this.recognitionConfidence = data.confidence || 0.95;
          this.lastTranscriptTimeStr = new Date().toLocaleTimeString();
          this.vadManager.setHasSpokenSomething(true);
        }
        if (data.interim) {
          this.interimText = data.interim;
          this.notifyInterimTextChange(data.interim);
          this.vadManager.setHasSpokenSomething(true);
        }
      },
      onError: (err) => {
        this.logEvent(this.state, this.state, `STT Error: ${err}`);
      }
    });

    this.checkMicPermission();

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);

      // Start 150ms diagnostics tick emitter
      this.diagnosticsInterval = setInterval(() => {
        this.emitDiagnostics();
      }, 150);
    }
  }

  public destroy() {
    this.clearStateTimer();
    if (this.diagnosticsInterval) {
      clearInterval(this.diagnosticsInterval);
      this.diagnosticsInterval = null;
    }
    this.speechManager.cancel();
    this.vadManager.stop();
    this.recognitionManager.stop();
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  private async checkMicPermission() {
    if (typeof window === "undefined" || !navigator.permissions) return;
    try {
      const status = await navigator.permissions.query({ name: "microphone" as any });
      this.micPermission = status.state as any;
      status.onchange = () => {
        this.micPermission = status.state as any;
      };
    } catch (e) {
      console.warn("[InterviewOrchestrator] Permissions query failed:", e);
    }
  }

  public getDiagnostics(): VoiceDiagnostics {
    const isStreamActive = this.micStream ? (this.micStream.active ? "active" : "inactive") : "null";
    let vadState: VoiceDiagnostics["vadState"] = "idle";
    if (this.vadManager && this.vadManager.isConnected) {
      if (this.vadManager.isSpeechDetected) {
        vadState = "speaking";
      } else if (this.vadManager.hasSpokenSomething) {
        vadState = "silence_countdown";
      }
    }

    const currentQIdx = this.conversationManager.currentQuestionIndex;
    const currentQText = this.conversationManager.questionsList[currentQIdx] || "N/A";

    return {
      micPermission: this.micPermission,
      mediaStreamStatus: isStreamActive as any,
      audioLevel: this.vadManager ? this.vadManager.currentVolume : 0,
      framesPerSecond: this.vadManager ? this.vadManager.framesPerSecond : 0,
      vadState,
      recognitionState: this.recognitionManager ? this.recognitionManager.recognitionState : "stopped",
      transcriptLength: this.candidateText.length + this.interimText.length,
      recognitionConfidence: this.recognitionConfidence,
      currentState: this.state,
      currentQuestion: currentQText,
      currentQuestionIndex: currentQIdx,
      currentTurn: this.conversationManager.chatLog.length,
      sessionId: this.conversationManager.interviewId,
      sttEngineName: this.recognitionManager
        ? this.recognitionManager.recognitionEngineMode === "web-speech"
          ? "Browser SpeechRecognition"
          : "Fallback Gemini STT API"
        : "None",
      activeMicrophone: this.activeMicLabel,
      sampleRate: this.activeMicSampleRate,
      audioLatency: this.lastAudioLatency,
      lastTranscriptTimestamp: this.lastTranscriptTimeStr,
      lastAiResponseTimestamp: this.lastAiResponseTimeStr,
      ttsState: this.ttsState,
      partialTranscript: this.interimText,
      finalTranscript: this.candidateText,
      sttRunningStatus: this.recognitionManager && this.recognitionManager.active ? "active" : "inactive",
      aiProcessingState: (this.state === "ANALYZING" || this.state === "GENERATING_RESPONSE") ? "processing" : "idle"
    };
  }

  private emitDiagnostics() {
    // Watchdog check: Auto-recover if the microphone, STT, or TTS fails/hangs without restarting the interview
    if (
      (this.state === "LISTENING" || this.state === "SPEECH_DETECTED") &&
      this.recognitionManager &&
      !this.recognitionManager.active &&
      !this.isReconnecting
    ) {
      console.warn("[InterviewOrchestrator Watchdog] STT is inactive in LISTENING state. Auto-recovering...");
      try {
        this.recognitionManager.start(this.micStream || undefined);
      } catch (err) {
        console.error("[InterviewOrchestrator Watchdog] Failed to auto-recover STT:", err);
      }
    }

    const diag = this.getDiagnostics();
    this.onDiagnosticsCallbacks.forEach((cb) => cb(diag));
  }

  public onStateChange(cb: (state: InterviewerState) => void) {
    this.onStateChangeCallbacks.push(cb);
    cb(this.state);
  }
  public onLogsChange(cb: (logs: OrchestratorLog[]) => void) {
    this.onLogsChangeCallbacks.push(cb);
    cb(this.logs);
  }
  public onChatLogChange(cb: (chatLog: ConversationTurn[]) => void) {
    this.onChatLogChangeCallbacks.push(cb);
    cb(this.conversationManager.chatLog);
  }
  public onVolumeChange(cb: (volume: number) => void) {
    this.onVolumeChangeCallbacks.push(cb);
  }
  public onInterimTextChange(cb: (text: string) => void) {
    this.onInterimTextChangeCallbacks.push(cb);
  }
  public onCandidateTextChange(cb: (text: string) => void) {
    this.onCandidateTextChangeCallbacks.push(cb);
  }
  public onDiagnostics(cb: (diagnostics: VoiceDiagnostics) => void) {
    this.onDiagnosticsCallbacks.push(cb);
    cb(this.getDiagnostics());
  }

  public notifyChatLogChange() { this.onChatLogChangeCallbacks.forEach((cb) => cb(this.conversationManager.chatLog)); }
  private notifyStateChange() { this.onStateChangeCallbacks.forEach((cb) => cb(this.state)); }
  private notifyLogsChange() { this.onLogsChangeCallbacks.forEach((cb) => cb(this.logs)); }
  private notifyVolumeChange(vol: number) { this.onVolumeChangeCallbacks.forEach((cb) => cb(vol)); }
  private notifyInterimTextChange(txt: string) { this.onInterimTextChangeCallbacks.forEach((cb) => cb(txt)); }
  private notifyCandidateTextChange(txt: string) { this.onCandidateTextChangeCallbacks.forEach((cb) => cb(txt)); }

  public transitionTo(newState: InterviewerState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateTransitionTime = Date.now();
    this.stateRetryCount = 0;

    this.logEvent(oldState, newState, null);
    this.notifyStateChange();

    this.clearStateTimer();
    this.setupStateTimeout(newState);
    this.runStateBehavior(newState);
  }

  private setupStateTimeout(state: InterviewerState) {
    let timeoutMs = 0;
    switch (state) {
      case "AI_SPEAKING":
        timeoutMs = 30000;
        break;
      case "WAITING_FOR_TTS_FINISH":
        timeoutMs = 45000;
        break;
      case "START_MIC":
        timeoutMs = 10000;
        break;
      case "LISTENING":
        timeoutMs = 60000;
        break;
      case "SPEECH_DETECTED":
        timeoutMs = 60000;
        break;
      case "TRANSCRIBING":
        timeoutMs = 15000;
        break;
      case "FINAL_TRANSCRIPT":
        timeoutMs = 10000;
        break;
      case "ANALYZING":
        timeoutMs = 15000;
        break;
      case "GENERATING_RESPONSE":
        timeoutMs = 15000;
        break;
      case "QUESTION_GENERATION":
        timeoutMs = 15000;
        break;
      default:
        return;
    }

    this.stateTimer = setTimeout(() => {
      this.handleStateTimeout(state);
    }, timeoutMs);
  }

  private handleStateTimeout(timeoutState: InterviewerState) {
    this.logEvent(timeoutState, timeoutState, `TIMEOUT EXCEEDED in state ${timeoutState}`);

    if (this.stateRetryCount < 1) {
      this.stateRetryCount++;
      console.warn(`[InterviewOrchestrator] State timeout retry for state ${timeoutState}`);
      this.runStateBehavior(timeoutState);
    } else {
      console.error(`[InterviewOrchestrator] Permanent state timeout recovery invoked for ${timeoutState}`);
      switch (timeoutState) {
        case "AI_SPEAKING":
        case "WAITING_FOR_TTS_FINISH":
          this.speechManager.cancel();
          this.transitionTo("START_MIC");
          break;
        case "START_MIC":
          this.transitionTo("LISTENING");
          break;
        case "LISTENING":
        case "SPEECH_DETECTED":
          this.transitionTo("TRANSCRIBING");
          break;
        case "TRANSCRIBING":
          this.transitionTo("FINAL_TRANSCRIPT");
          break;
        case "FINAL_TRANSCRIPT":
          this.transitionTo("ANALYZING");
          break;
        case "ANALYZING":
          this.handleAnalysisFallback();
          break;
        case "GENERATING_RESPONSE":
          this.transitionTo("NEXT_QUESTION");
          break;
        case "QUESTION_GENERATION":
          this.transitionTo("GREETING");
          break;
      }
    }
  }

  private runStateBehavior(state: InterviewerState) {
    switch (state) {
      case "INITIALIZING":
        break;
      case "GREETING":
        this.playWelcome();
        break;
      case "QUESTION_GENERATION":
        break;
      case "AI_SPEAKING":
        break;
      case "WAITING_FOR_TTS_FINISH":
        break;
      case "START_MIC":
        this.initializeAndStartMic();
        break;
      case "LISTENING":
        break;
      case "SPEECH_DETECTED":
        break;
      case "TRANSCRIBING":
        this.stopMicrophone();
        this.transitionTo("FINAL_TRANSCRIPT");
        break;
      case "FINAL_TRANSCRIPT":
        const finalAnswer = this.candidateText.trim() || this.interimText.trim();
        this.processCandidateResponse(finalAnswer);
        break;
      case "ANALYZING":
        break;
      case "GENERATING_RESPONSE":
        break;
      case "FOLLOW_UP_REQUIRED":
        break;
      case "NEXT_QUESTION":
        this.moveToNextQuestion();
        break;
      case "FINAL_FEEDBACK":
        break;
      case "REPORT_GENERATION":
        this.generateReport();
        break;
      case "SESSION_COMPLETE":
        break;
    }
  }

  private async initializeAndStartMic() {
    console.log("[InterviewOrchestrator] START_MIC: Activating audio pipeline...");
    this.candidateText = "";
    this.interimText = "";
    this.notifyCandidateTextChange("");
    this.notifyInterimTextChange("");

    try {
      // Reacquire MediaStream if null or inactive
      if (!this.micStream || !this.micStream.active) {
        console.log("[InterviewOrchestrator] Requesting MediaStream via getUserMedia...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        this.micStream = stream;
      }

      // Collect microphone diagnostics
      const audioTracks = this.micStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        const settings = track.getSettings();
        this.activeMicLabel = track.label || "System Default";
        this.activeMicSampleRate = settings.sampleRate || 48000;
        this.micPermission = "granted";
      }

      // Start capture nodes
      if (this.micStream) {
        this.vadManager.start(this.micStream);
      }
      this.recognitionManager.start(this.micStream || undefined);
      
      this.transitionTo("LISTENING");
    } catch (err: any) {
      console.error("[InterviewOrchestrator] Microphone start failed:", err);
      this.logEvent("START_MIC", "LISTENING", `Microphone activation failure: ${err.message || err}`);
      this.micPermission = "denied";
      
      // Auto-advance to LISTENING to allow text input recovery
      this.transitionTo("LISTENING");
    }
  }

  private handleInterruption() {
    console.log("[InterviewOrchestrator] Candidate interruption detected. Cancelling TTS.");
    this.speechManager.cancel();

    const currentQText =
      this.conversationManager.questionsList[this.conversationManager.currentQuestionIndex] ||
      "intro";

    const logTurn: ConversationTurn = {
      sender: "user",
      text: "[Candidate interrupted AI]",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      turnId: this.conversationManager.generateId("interrupted"),
      interviewId: this.conversationManager.interviewId,
      questionId: currentQText,
      followUpId: null,
      transcriptId: this.conversationManager.generateId("interrupted-stt"),
      analysisId: this.conversationManager.generateId("interrupted-analysis"),
      ttsId: this.conversationManager.generateId("interrupted-tts"),
      recognitionId: this.conversationManager.generateId("interrupted-recognition"),
      analysis: { relevance: 100, completeness: 0, score: 0 }
    };
    
    this.conversationManager.addTurn(logTurn);
    this.notifyChatLogChange();

    this.transitionTo("START_MIC");
  }

  private async processCandidateResponse(answer: string) {
    if (!answer.trim()) {
      this.transitionTo("START_MIC");
      return;
    }

    const currentQIdx = this.conversationManager.currentQuestionIndex;
    const currentQObj = this.conversationManager.generatedQuestions[currentQIdx];
    const currentQText = this.conversationManager.questionsList[currentQIdx] || "Intro";

    const turnId = this.conversationManager.generateId("turn");
    const transcriptId = this.conversationManager.generateId("transcript");
    const analysisId = this.conversationManager.generateId("analysis");
    const recognitionId = this.conversationManager.generateId("recog");

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userTurn: ConversationTurn = {
      sender: "user",
      text: answer,
      timestamp,
      turnId,
      interviewId: this.conversationManager.interviewId,
      questionId: currentQText,
      followUpId:
        this.conversationManager.followUpCount > 0
          ? `followup-${this.conversationManager.followUpCount}`
          : null,
      transcriptId,
      analysisId,
      ttsId: "",
      recognitionId
    };

    this.conversationManager.chatLog.push(userTurn);
    this.notifyChatLogChange();
    
    this.transitionTo("ANALYZING");

    const startTime = Date.now();

    try {
      if (this.isReconnecting) {
        throw new Error("Network offline during analysis.");
      }

      const response = await fetch("/api/ai/mock/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQObj,
          candidateResponse: answer,
          chatHistory: this.conversationManager.chatLog,
          attemptCount: this.conversationManager.followUpCount,
          personality: this.conversationManager.personality,
          round: this.conversationManager.roundType
        })
      });

      if (!response.ok) throw new Error("API call failed.");
      const data = await response.json();

      const aiResponseTime = Date.now() - startTime;
      this.lastAudioLatency = aiResponseTime;
      userTurn.analysis = data.analysis || { relevance: 100, completeness: 100, score: 90 };

      this.conversationManager.saveState();
      
      this.transitionTo("GENERATING_RESPONSE");
      this.lastAiResponseTimeStr = new Date().toLocaleTimeString();
      this.handleAnalysisResult(data, aiResponseTime);
    } catch (e: any) {
      console.warn("[InterviewOrchestrator] Response processing error:", e);
      this.logEvent("ANALYZING", "ANALYZING", `Error: ${e.message}`);
      this.lastAudioLatency = Date.now() - startTime;
      this.handleAnalysisFallback();
    }
  }

  private handleAnalysisResult(data: any, aiResponseTime: number) {
    const aiText = data.response;
    const currentQIdx = this.conversationManager.currentQuestionIndex;
    const currentQText = this.conversationManager.questionsList[currentQIdx] || "";
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Handle intents that do NOT submit/move past the question, or are special actions
    if (data.status === "repeat") {
      const aiTurn: ConversationTurn = {
        sender: "ai",
        text: aiText,
        timestamp,
        turnId: this.conversationManager.generateId("turn"),
        interviewId: this.conversationManager.interviewId,
        questionId: currentQText,
        followUpId: null,
        transcriptId: "",
        analysisId: "",
        ttsId: this.conversationManager.generateId("tts"),
        recognitionId: ""
      };
      this.conversationManager.addTurn(aiTurn);
      this.notifyChatLogChange();
      this.transitionTo("AI_SPEAKING");
      this.speechManager.speak(aiText, aiTurn.ttsId, currentQText);
      return;
    }

    if (data.status === "skip") {
      const nextIdx = currentQIdx + 1;
      const aiTurn: ConversationTurn = {
        sender: "ai",
        text: aiText,
        timestamp,
        turnId: this.conversationManager.generateId("turn"),
        interviewId: this.conversationManager.interviewId,
        questionId: currentQText,
        followUpId: null,
        transcriptId: "",
        analysisId: "",
        ttsId: this.conversationManager.generateId("tts"),
        recognitionId: ""
      };

      if (nextIdx < this.conversationManager.questionsList.length) {
        const nextQText = this.conversationManager.questionsList[nextIdx];
        const combinedText = `${aiText} ${nextQText}`;
        aiTurn.text = combinedText;
        aiTurn.questionId = nextQText;
        this.conversationManager.currentQuestionIndex = nextIdx;
        this.conversationManager.followUpCount = 0;
        this.conversationManager.addTurn(aiTurn);
        this.notifyChatLogChange();
        this.transitionTo("AI_SPEAKING");
        this.speechManager.speak(combinedText, aiTurn.ttsId, nextQText);
      } else {
        const closingMsg = `${aiText} Thank you. That completes our interview. I will now compile your detailed performance report.`;
        aiTurn.text = closingMsg;
        aiTurn.questionId = "closing";
        this.conversationManager.addTurn(aiTurn);
        this.notifyChatLogChange();
        this.transitionTo("FINAL_FEEDBACK");
        this.speechManager.speak(closingMsg, aiTurn.ttsId, "closing");
      }
      return;
    }

    if (data.status === "end") {
      const aiTurn: ConversationTurn = {
        sender: "ai",
        text: aiText,
        timestamp,
        turnId: this.conversationManager.generateId("turn"),
        interviewId: this.conversationManager.interviewId,
        questionId: "closing",
        followUpId: null,
        transcriptId: "",
        analysisId: "",
        ttsId: this.conversationManager.generateId("tts"),
        recognitionId: ""
      };
      this.conversationManager.addTurn(aiTurn);
      this.notifyChatLogChange();
      this.transitionTo("FINAL_FEEDBACK");
      this.speechManager.speak(aiText, aiTurn.ttsId, "closing");
      return;
    }

    if (
      data.status === "hint" ||
      data.status === "clarify" ||
      data.status === "chit_chat" ||
      data.status === "continue"
    ) {
      const aiTurn: ConversationTurn = {
        sender: "ai",
        text: aiText,
        timestamp,
        turnId: this.conversationManager.generateId("turn"),
        interviewId: this.conversationManager.interviewId,
        questionId: currentQText,
        followUpId: null,
        transcriptId: "",
        analysisId: "",
        ttsId: this.conversationManager.generateId("tts"),
        recognitionId: ""
      };
      this.conversationManager.addTurn(aiTurn);
      this.notifyChatLogChange();
      this.transitionTo("AI_SPEAKING");
      this.speechManager.speak(aiText, aiTurn.ttsId, currentQText);
      return;
    }

    // Default: technical evaluation answer_submission
    const isFollowUp = data.status === "follow_up" && this.conversationManager.followUpCount < 2;
    const aiTurn: ConversationTurn = {
      sender: "ai",
      text: aiText,
      timestamp,
      turnId: this.conversationManager.generateId("turn"),
      interviewId: this.conversationManager.interviewId,
      questionId: currentQText,
      followUpId: isFollowUp ? `followup-${this.conversationManager.followUpCount + 1}` : null,
      transcriptId: "",
      analysisId: "",
      ttsId: this.conversationManager.generateId("tts"),
      recognitionId: ""
    };

    if (isFollowUp) {
      this.conversationManager.followUpCount++;
      this.conversationManager.addTurn(aiTurn);
      this.notifyChatLogChange();

      this.transitionTo("AI_SPEAKING");
      this.speechManager.speak(aiText, aiTurn.ttsId, currentQText);
    } else {
      this.conversationManager.followUpCount = 0;
      const nextIdx = currentQIdx + 1;

      if (nextIdx < this.conversationManager.questionsList.length) {
        const nextQText = this.conversationManager.questionsList[nextIdx];
        const combinedText = `${aiText} ${nextQText}`;
        aiTurn.text = combinedText;
        aiTurn.questionId = nextQText;

        this.conversationManager.currentQuestionIndex = nextIdx;
        this.conversationManager.addTurn(aiTurn);
        this.notifyChatLogChange();

        this.transitionTo("AI_SPEAKING");
        this.speechManager.speak(combinedText, aiTurn.ttsId, nextQText);
      } else {
        const closingMsg = `${aiText} Thank you. That completes our interview. I will now compile your detailed performance report and study blueprint.`;
        aiTurn.text = closingMsg;
        aiTurn.questionId = "closing";

        this.conversationManager.addTurn(aiTurn);
        this.notifyChatLogChange();

        this.transitionTo("FINAL_FEEDBACK");
        this.speechManager.speak(closingMsg, aiTurn.ttsId, "closing");
      }
    }
  }

  private handleAnalysisFallback() {
    const currentQIdx = this.conversationManager.currentQuestionIndex;
    const nextIdx = currentQIdx + 1;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (nextIdx < this.conversationManager.questionsList.length) {
      const nextQText = this.conversationManager.questionsList[nextIdx];
      const fallbackText = "I understand. Let's move to the next topic.";
      const combinedText = `${fallbackText} ${nextQText}`;

      const aiTurn: ConversationTurn = {
        sender: "ai",
        text: combinedText,
        timestamp,
        turnId: this.conversationManager.generateId("turn"),
        interviewId: this.conversationManager.interviewId,
        questionId: nextQText,
        followUpId: null,
        transcriptId: "",
        analysisId: "",
        ttsId: this.conversationManager.generateId("tts"),
        recognitionId: ""
      };

      this.conversationManager.currentQuestionIndex = nextIdx;
      this.conversationManager.addTurn(aiTurn);
      this.notifyChatLogChange();

      this.transitionTo("AI_SPEAKING");
      this.speechManager.speak(combinedText, aiTurn.ttsId, nextQText);
    } else {
      const closingMsg = "Thank you. That completes our interview. I will now compile your detailed performance report.";
      const aiTurn: ConversationTurn = {
        sender: "ai",
        text: closingMsg,
        timestamp,
        turnId: this.conversationManager.generateId("turn"),
        interviewId: this.conversationManager.interviewId,
        questionId: "closing",
        followUpId: null,
        transcriptId: "",
        analysisId: "",
        ttsId: this.conversationManager.generateId("tts"),
        recognitionId: ""
      };

      this.conversationManager.addTurn(aiTurn);
      this.notifyChatLogChange();

      this.transitionTo("FINAL_FEEDBACK");
      this.speechManager.speak(closingMsg, aiTurn.ttsId, "closing");
    }
  }

  public startInterview(
    questions: any[],
    config: {
      role: string;
      round: string;
      difficulty: string;
      personality: string;
      stream: MediaStream | null;
    }
  ) {
    this.conversationManager.roleName = config.role;
    this.conversationManager.roundType = config.round;
    this.conversationManager.difficulty = config.difficulty;
    this.conversationManager.personality = config.personality;
    this.conversationManager.generatedQuestions = questions;
    this.conversationManager.questionsList = questions.map((q) => q.question);
    this.micStream = config.stream;

    this.notifyChatLogChange();

    if (this.conversationManager.chatLog.length > 0) {
      const lastMsg =
        this.conversationManager.chatLog[this.conversationManager.chatLog.length - 1];
      if (lastMsg && lastMsg.sender === "ai") {
        this.transitionTo("AI_SPEAKING");
        this.speechManager.speak(lastMsg.text, lastMsg.ttsId, lastMsg.questionId);
      } else {
        this.transitionTo("START_MIC");
      }
    } else {
      this.transitionTo("GREETING");
    }
  }

  private playWelcome() {
    const welcomeText = `Hello! I will be your interviewer today. I have reviewed your target profile for the ${this.conversationManager.roleName} position. Today, we will conduct a ${this.conversationManager.difficulty} level ${this.conversationManager.roundType} assessment in ${this.conversationManager.personality} style. Let's begin! Here is my first question: ${this.conversationManager.questionsList[0]}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const aiTurn: ConversationTurn = {
      sender: "ai",
      text: welcomeText,
      timestamp,
      turnId: this.conversationManager.generateId("turn"),
      interviewId: this.conversationManager.interviewId,
      questionId: this.conversationManager.questionsList[0],
      followUpId: null,
      transcriptId: "",
      analysisId: "",
      ttsId: this.conversationManager.generateId("tts"),
      recognitionId: ""
    };

    this.conversationManager.addTurn(aiTurn);
    this.notifyChatLogChange();

    this.speechManager.speak(
      welcomeText,
      aiTurn.ttsId,
      this.conversationManager.questionsList[0]
    );
  }

  private moveToNextQuestion() {
    this.transitionTo("AI_SPEAKING");
  }

  private async generateReport() {
    if (this.onFinishCallback) {
      this.onFinishCallback();
      this.transitionTo("SESSION_COMPLETE");
      return;
    }

    try {
      const data = await ReportEngine.compileReport(
        this.conversationManager.chatLog,
        this.conversationManager.generatedQuestions,
        this.conversationManager.roleName,
        this.conversationManager.roundType,
        this.conversationManager.difficulty
      );
      await this.conversationManager.saveState("completed", null, data.evaluation);
      this.transitionTo("SESSION_COMPLETE");
    } catch (e: any) {
      console.error("[InterviewOrchestrator] Final report generation failed:", e);
      await this.conversationManager.saveState("failed", e.message || "Report compilation failed");
      this.transitionTo("SESSION_COMPLETE");
    }
  }

  private startMicrophone() {
    if (this.micStream) {
      this.vadManager.start(this.micStream);
    }
    this.recognitionManager.start(this.micStream || undefined);
  }

  private stopMicrophone() {
    this.vadManager.stop();
    this.recognitionManager.stop();
    this.micVolume = 0;
    this.notifyVolumeChange(0);
  }

  private handleOnline = () => {
    console.log("[InterviewOrchestrator] Network connection restored.");
    this.isReconnecting = false;
    if (this.state === "ANALYZING") {
      this.processCandidateResponse(this.candidateText);
    }
  };

  private handleOffline = () => {
    console.warn("[InterviewOrchestrator] Network offline.");
    this.isReconnecting = true;
    this.logEvent(this.state, this.state, "Network offline. Standing by for reconnect...");
  };

  private logEvent(
    current: InterviewerState,
    next: InterviewerState,
    error: string | null
  ) {
    const timestamp = new Date().toISOString();
    const currentQIdx = this.conversationManager.currentQuestionIndex;
    const currentQText = this.conversationManager.questionsList[currentQIdx] || "intro";

    const log: OrchestratorLog = {
      timestamp,
      interviewId: this.conversationManager.interviewId,
      questionId: currentQText,
      currentState: current,
      nextState: next,
      micState: this.micState,
      ttsState: this.ttsState,
      transcript: this.candidateText,
      speechConfidence: this.recognitionConfidence,
      silenceDuration: this.vadManager ? this.vadManager.silenceDurationMs : 0,
      aiResponseTime: this.lastAudioLatency,
      errors: error
    };

    this.logs.push(log);
    this.notifyLogsChange();
  }

  private clearStateTimer() {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
  }
}
