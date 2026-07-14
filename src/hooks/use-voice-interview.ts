import { useEffect, useRef, useState } from "react";
import {
  InterviewOrchestrator,
  InterviewerState,
  OrchestratorLog,
  VoiceDiagnostics
} from "@/services/voice-interview/InterviewOrchestrator";
import { ConversationTurn } from "@/services/voice-interview/ConversationManager";

export function useVoiceInterview(sessionId: string, onFinish?: () => void) {
  const orchestratorRef = useRef<InterviewOrchestrator | null>(null);

  const [orchestratorState, setOrchestratorState] = useState<InterviewerState>("INITIALIZING");
  const [logs, setLogs] = useState<OrchestratorLog[]>([]);
  const [chatLog, setChatLog] = useState<ConversationTurn[]>([]);
  const [micVolume, setMicVolume] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics | null>(null);

  if (!orchestratorRef.current && sessionId) {
    orchestratorRef.current = new InterviewOrchestrator(sessionId);
    if (typeof window !== "undefined") {
      (window as any).useVoiceInterviewOrchestratorInstance = orchestratorRef.current;
    }
  }

  // Update finish callback ref if changed
  if (orchestratorRef.current) {
    orchestratorRef.current.onFinishCallback = onFinish;
  }

  useEffect(() => {
    const orchestrator = orchestratorRef.current;
    if (!orchestrator) return;

    orchestrator.onStateChange(setOrchestratorState);
    orchestrator.onLogsChange(setLogs);
    orchestrator.onChatLogChange((log) => {
      setChatLog(log);
      setCurrentQuestionIndex(orchestrator.conversationManager.currentQuestionIndex);
    });
    orchestrator.onVolumeChange(setMicVolume);
    orchestrator.onInterimTextChange(setInterimText);
    orchestrator.onCandidateTextChange(setCandidateText);
    orchestrator.onDiagnostics(setDiagnostics);

    // Sync current values if resumed
    setCandidateText(orchestrator.candidateText);
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.destroy();
        orchestratorRef.current = null;
      }
    };
  }, [sessionId]);

  // Derived legacy aiSpeechState mapping for backwards compatibility with UI styling
  let aiSpeechState: "speaking" | "listening" | "transcribing" | "evaluating" | "idle" | "thinking" = "idle";
  switch (orchestratorState) {
    case "INITIALIZING":
    case "SESSION_COMPLETE":
      aiSpeechState = "idle";
      break;
    case "GREETING":
    case "AI_SPEAKING":
    case "WAITING_FOR_TTS_FINISH":
    case "FINAL_FEEDBACK":
      aiSpeechState = "speaking";
      break;
    case "QUESTION_GENERATION":
    case "FOLLOW_UP_REQUIRED":
    case "NEXT_QUESTION":
    case "GENERATING_RESPONSE":
      aiSpeechState = "thinking";
      break;
    case "START_MIC":
    case "LISTENING":
    case "SPEECH_DETECTED":
      aiSpeechState = "listening";
      break;
    case "TRANSCRIBING":
    case "FINAL_TRANSCRIPT":
      aiSpeechState = "transcribing";
      break;
    case "ANALYZING":
    case "REPORT_GENERATION":
      aiSpeechState = "evaluating";
      break;
  }

  const startInterview = (
    questions: any[],
    config: {
      role: string;
      round: string;
      difficulty: string;
      personality: string;
      stream: MediaStream | null;
    }
  ) => {
    orchestratorRef.current?.startInterview(questions, config);
  };

  const submitCandidateAnswer = (text: string) => {
    if (orchestratorRef.current) {
      orchestratorRef.current.candidateText = text;
      orchestratorRef.current.transitionTo("TRANSCRIBING");
    }
  };

  const handleCandidateAnswerSubmit = () => {
    const text = orchestratorRef.current?.candidateText || "";
    submitCandidateAnswer(text);
  };

  return {
    orchestratorState,
    aiSpeechState,
    logs,
    chatLog,
    micVolume,
    interimText,
    candidateText,
    currentQuestionIndex,
    diagnostics,
    setCandidateText: (text: string) => {
      if (orchestratorRef.current) {
        orchestratorRef.current.candidateText = text;
        setCandidateText(text);
      }
    },
    startInterview,
    submitCandidateAnswer,
    handleCandidateAnswerSubmit,
    orchestrator: orchestratorRef.current
  };
}
