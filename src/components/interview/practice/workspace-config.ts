export type WorkspaceType = 
  | "coding" 
  | "conversational" 
  | "system-design" 
  | "sql" 
  | "aptitude" 
  | "cybersecurity" 
  | "machine-learning";

export interface WorkspaceFeatures {
  aiVoice: boolean;            // Whether AI speaks aloud via TTS
  aiAvatar: boolean;           // Whether AI avatar/animation is shown
  speechRecognition: boolean;  // Whether mic/dictation auto-starts after AI speaks
  fullscreenEnforced: boolean; // Whether fullscreen mode is required during session
  tabSwitchDetection: boolean; // Whether tab switches / window blurs are logged as violations
  copyPasteRestriction: boolean; // Whether copy/paste is restricted in the editor
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  workspaceType: WorkspaceType;
  description: string;
  defaultLanguage?: string;
  features: WorkspaceFeatures;
  avatar: {
    name: string;
    title: string;
    themeColor: string;
    themeBg: string;
    coreStyle: string;
  };
  aiBehavior: {
    greetingStyle: string;
    speakingPace: "slow" | "normal" | "fast";
    followUpStyle: "supportive" | "probing" | "challenging";
    interruptionBehaviour: "none" | "occasional" | "active";
    systemInstruction: string;
  };
  evaluationFocus: string;
}

/** Feature presets for DRY config */
const CONVERSATIONAL_FEATURES: WorkspaceFeatures = {
  aiVoice: true,
  aiAvatar: true,
  speechRecognition: true,
  fullscreenEnforced: false,
  tabSwitchDetection: false,
  copyPasteRestriction: false,
};

const CODING_FEATURES: WorkspaceFeatures = {
  aiVoice: false,
  aiAvatar: false,
  speechRecognition: false,
  fullscreenEnforced: true,
  tabSwitchDetection: true,
  copyPasteRestriction: false, // Disabled for practice mode
};

const SYSTEM_DESIGN_FEATURES: WorkspaceFeatures = {
  aiVoice: false,
  aiAvatar: false,
  speechRecognition: false,
  fullscreenEnforced: true,
  tabSwitchDetection: true,
  copyPasteRestriction: false,
};

export const WORKSPACE_CONFIGS: Record<string, WorkspaceConfig> = {
  "Warm Up": {
    id: "warm-up",
    name: "Warm Up",
    workspaceType: "conversational",
    description: "Initial greetings, career background, and lightweight introduction.",
    features: CONVERSATIONAL_FEATURES,
    avatar: {
      name: "Ava",
      title: "Friendly Mentor",
      themeColor: "rgb(16, 185, 129)", // Emerald
      themeBg: "rgba(16, 185, 129, 0.1)",
      coreStyle: "card-glow-subtle"
    },
    aiBehavior: {
      greetingStyle: "Welcome! I'm here to help you get comfortable. Let's do a quick warm up.",
      speakingPace: "normal",
      followUpStyle: "supportive",
      interruptionBehaviour: "none",
      systemInstruction: "You are a friendly mentor warming up a candidate. Ask short, encouraging questions. Focus on establishing candidate comfort."
    },
    evaluationFocus: "Fluency, clarity, confidence"
  },
  "Behavioral": {
    id: "behavioral",
    name: "Behavioral",
    workspaceType: "conversational",
    description: "STAR method interview assessing communication and conflict resolution.",
    features: CONVERSATIONAL_FEATURES,
    avatar: {
      name: "Ava",
      title: "HR Conversational Specialist",
      themeColor: "rgb(16, 185, 129)", // Emerald
      themeBg: "rgba(16, 185, 129, 0.1)",
      coreStyle: "card-glow-subtle"
    },
    aiBehavior: {
      greetingStyle: "Hello! Today we'll explore situations from your past work. Please structure your answers using the STAR method (Situation, Task, Action, Result).",
      speakingPace: "normal",
      followUpStyle: "probing",
      interruptionBehaviour: "occasional",
      systemInstruction: "You are an HR Conversational Specialist. Probe deeper into their past experiences. Ask 'Why?' and 'What were the consequences?' using the STAR methodology."
    },
    evaluationFocus: "STAR framework, leadership, ownership"
  },
  "HR Round": {
    id: "hr-round",
    name: "HR Round",
    workspaceType: "conversational",
    description: "Company alignment, salary expectation, and behavioral fit.",
    features: CONVERSATIONAL_FEATURES,
    avatar: {
      name: "Sophia",
      title: "Professional HR Lead",
      themeColor: "rgb(99, 102, 241)", // Indigo
      themeBg: "rgba(99, 102, 241, 0.1)",
      coreStyle: "card-glow-indigo"
    },
    aiBehavior: {
      greetingStyle: "Hello, I am Sophia. We will discuss your career goals, alignment with our culture, and logistical fit.",
      speakingPace: "normal",
      followUpStyle: "probing",
      interruptionBehaviour: "none",
      systemInstruction: "You are a professional HR Lead. Maintain a structured, professional discussion about career alignment, expectations, and culture fit."
    },
    evaluationFocus: "Communication, professionalism, confidence"
  },
  "Technical (Theory)": {
    id: "technical-theory",
    name: "Technical Theory",
    workspaceType: "conversational",
    description: "Conceptual technical deep dive (OOP, DBMS, OS, Computer Networks).",
    features: CONVERSATIONAL_FEATURES,
    avatar: {
      name: "Marcus",
      title: "Senior Software Engineer",
      themeColor: "rgb(239, 68, 68)", // Crimson
      themeBg: "rgba(239, 68, 68, 0.1)",
      coreStyle: "card-glow-primary"
    },
    aiBehavior: {
      greetingStyle: "Hi there. I'm Marcus. Today we'll do a technical theory drill. I'll test your deep conceptual knowledge of system design, networks, databases, and core CS theory.",
      speakingPace: "normal",
      followUpStyle: "challenging",
      interruptionBehaviour: "active",
      systemInstruction: "You are a strict Senior Software Engineer. Ask deep conceptual CS questions (OOP, databases, networks). Actively challenge assumptions, request examples, and verify accuracy."
    },
    evaluationFocus: "Technical accuracy, depth, reasoning"
  },
  "Technical (Coding)": {
    id: "technical-coding",
    name: "Technical Coding",
    workspaceType: "coding",
    description: "Write, run, and optimize algorithms or application code.",
    defaultLanguage: "javascript",
    features: CODING_FEATURES,
    avatar: {
      name: "Marcus",
      title: "Senior Software Engineer",
      themeColor: "rgb(239, 68, 68)", // Crimson
      themeBg: "rgba(239, 68, 68, 0.1)",
      coreStyle: "card-glow-primary"
    },
    aiBehavior: {
      greetingStyle: "Hi, I'm Marcus. Here is a coding challenge for you. Write your solution in the editor, compile it, and run test cases. I'll keep talking to a minimum so you can focus.",
      speakingPace: "normal",
      followUpStyle: "supportive",
      interruptionBehaviour: "none",
      systemInstruction: "You are a Senior Software Engineer guiding a coding session. Speak very little. Let the candidate code, run test cases, and explain their complexity."
    },
    evaluationFocus: "Test cases, complexity, code quality, optimization"
  },
  "Coding": {
    id: "coding",
    name: "Coding Assessment",
    workspaceType: "coding",
    description: "HackerRank style algorithmic coding round.",
    defaultLanguage: "javascript",
    features: CODING_FEATURES,
    avatar: {
      name: "Marcus",
      title: "Senior Software Engineer",
      themeColor: "rgb(239, 68, 68)", // Crimson
      themeBg: "rgba(239, 68, 68, 0.1)",
      coreStyle: "card-glow-primary"
    },
    aiBehavior: {
      greetingStyle: "Hi, I'm Marcus. Let's begin the coding round. Focus on writing clean code, optimization, and time/space complexity.",
      speakingPace: "normal",
      followUpStyle: "supportive",
      interruptionBehaviour: "none",
      systemInstruction: "You are a coding interviewer. Maintain a quiet, HackerRank-like coding focus. Provide short, concise question transitions and coding hints only when requested."
    },
    evaluationFocus: "Test cases, complexity, code quality, optimization"
  },
  "System Design": {
    id: "system-design",
    name: "System Design",
    workspaceType: "system-design",
    description: "Architecting scalable systems and trade-off analysis.",
    defaultLanguage: "typescript",
    features: SYSTEM_DESIGN_FEATURES,
    avatar: {
      name: "Zara",
      title: "Principal Architect",
      themeColor: "rgb(168, 85, 247)", // Purple
      themeBg: "rgba(168, 85, 247, 0.1)",
      coreStyle: "card-glow-indigo"
    },
    aiBehavior: {
      greetingStyle: "Hello, I am Zara, Principal Architect. Today we'll design a high-scale system. Focus on database choices, queues, scaling, caching, and CAP theorem trade-offs.",
      speakingPace: "normal",
      followUpStyle: "challenging",
      interruptionBehaviour: "occasional",
      systemInstruction: "You are a Principal Architect. Probe the candidate on system trade-offs: SQL vs NoSQL, caching layers, write path bottlenecks, load balancing, and single points of failure."
    },
    evaluationFocus: "Scalability, trade-off analysis, architecture completeness"
  }
};
