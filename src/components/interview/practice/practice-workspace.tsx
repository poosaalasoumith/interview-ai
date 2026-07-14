"use client";

import { WorkspaceConfig, WORKSPACE_CONFIGS } from "./workspace-config";
import { ConversationalWorkspace } from "./conversational-workspace";
import { CodingWorkspace } from "./coding-workspace";
import { SystemDesignWorkspace } from "./system-design-workspace";
import { DraggablePipWebcam } from "./draggable-pip-webcam";
import { VoiceDiagnostics } from "@/services/voice-interview/InterviewOrchestrator";

interface PracticeWorkspaceProps {
  selectedRound: string;
  technicalMode: "theory" | "coding";
  currentQuestionText: string;
  currentQuestionIndex: number;
  currentQuestionObj: any;
  chatLog: { sender: "ai" | "user"; text: string; timestamp: string }[];
  candidateResponseText: string;
  setCandidateResponseText: (text: string) => void;
  isDictating: boolean;
  toggleDictation: () => void;
  silenceCountdown: number | null;
  aiSpeechState: "speaking" | "listening" | "transcribing" | "evaluating" | "idle" | "thinking";
  handleCandidateAnswerSubmit: () => void;
  submitCandidateAnswer: (answer: string) => void;
  isUserSpeaking: boolean;
  interimSubtitleText: string;
  micVolume: number;
  diagnostics: VoiceDiagnostics | null;
  
  // Forwarded shared properties
  proctorSandboxLogs: string[];
  hasCameraStream: boolean;
  roomVideoRef: (node: HTMLVideoElement | null) => void;
  aiSpeechVisualizerHeight: number[];
  selectedPersonality: string;

  onNextQuestion?: () => void;
  onFinishSession?: () => void;
}

export function PracticeWorkspace({
  selectedRound,
  technicalMode,
  currentQuestionText,
  currentQuestionIndex,
  currentQuestionObj,
  chatLog,
  candidateResponseText,
  setCandidateResponseText,
  isDictating,
  toggleDictation,
  silenceCountdown,
  aiSpeechState,
  handleCandidateAnswerSubmit,
  submitCandidateAnswer,
  isUserSpeaking,
  interimSubtitleText,
  micVolume,
  diagnostics,
  proctorSandboxLogs,
  hasCameraStream,
  roomVideoRef,
  aiSpeechVisualizerHeight,
  selectedPersonality,
  onNextQuestion,
  onFinishSession,
}: PracticeWorkspaceProps) {
  // Resolve key for Technical modes
  let lookupKey = selectedRound;
  if (selectedRound === "Technical") {
    lookupKey = technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)";
  }

  const config = WORKSPACE_CONFIGS[lookupKey] || WORKSPACE_CONFIGS["Warm Up"];

  if (config.workspaceType === "coding") {
    return (
      <div className="h-full w-full relative">
        <CodingWorkspace
          currentQuestionText={currentQuestionText}
          currentQuestionIndex={currentQuestionIndex}
          currentQuestionObj={currentQuestionObj}
          candidateResponseText={candidateResponseText}
          setCandidateResponseText={setCandidateResponseText}
          isDictating={isDictating}
          toggleDictation={toggleDictation}
          silenceCountdown={silenceCountdown}
          aiSpeechState={aiSpeechState}
          submitCandidateAnswer={submitCandidateAnswer}
          roundName={config.name}
          diagnostics={diagnostics}
          
          // Forward states
          hasCameraStream={hasCameraStream}
          roomVideoRef={roomVideoRef}
          proctorSandboxLogs={proctorSandboxLogs}
          onNextQuestion={onNextQuestion}
          onFinishSession={onFinishSession}
        />
        {hasCameraStream && (
          <DraggablePipWebcam 
            hasCameraStream={hasCameraStream}
            roomVideoRef={roomVideoRef}
          />
        )}
      </div>
    );
  }

  if (config.workspaceType === "system-design") {
    return (
      <div className="h-full w-full relative">
        <SystemDesignWorkspace
          currentQuestionText={currentQuestionText}
          currentQuestionIndex={currentQuestionIndex}
          currentQuestionObj={currentQuestionObj}
          chatLog={chatLog}
          candidateResponseText={candidateResponseText}
          setCandidateResponseText={setCandidateResponseText}
          isDictating={isDictating}
          toggleDictation={toggleDictation}
          silenceCountdown={silenceCountdown}
          aiSpeechState={aiSpeechState}
          submitCandidateAnswer={submitCandidateAnswer}
          roundName={config.name}
          diagnostics={diagnostics}
          
          // Forward states
          hasCameraStream={hasCameraStream}
          roomVideoRef={roomVideoRef}
          onNextQuestion={onNextQuestion}
          onFinishSession={onFinishSession}
        />
        {hasCameraStream && (
          <DraggablePipWebcam 
            hasCameraStream={hasCameraStream}
            roomVideoRef={roomVideoRef}
          />
        )}
      </div>
    );
  }

  // Fallback to conversational workspace (HR, Behavioral, Warm Up, Technical Theory)
  return (
    <ConversationalWorkspace
      chatLog={chatLog}
      candidateResponseText={candidateResponseText}
      setCandidateResponseText={setCandidateResponseText}
      isDictating={isDictating}
      toggleDictation={toggleDictation}
      silenceCountdown={silenceCountdown}
      aiSpeechState={aiSpeechState}
      currentQuestionText={currentQuestionText}
      currentQuestionIndex={currentQuestionIndex}
      totalQuestions={3}
      handleCandidateAnswerSubmit={handleCandidateAnswerSubmit}
      isUserSpeaking={isUserSpeaking}
      interimSubtitleText={interimSubtitleText}
      micVolume={micVolume}
      roundName={config.name}
      diagnostics={diagnostics}
      
      // Forward states for the left avatar column
      proctorSandboxLogs={proctorSandboxLogs}
      hasCameraStream={hasCameraStream}
      roomVideoRef={roomVideoRef}
      aiSpeechVisualizerHeight={aiSpeechVisualizerHeight}
      selectedPersonality={selectedPersonality}
      technicalMode={technicalMode}
    />
  );
}
