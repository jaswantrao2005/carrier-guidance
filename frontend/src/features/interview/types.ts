export interface Question {
  question: string;
  introduction?: string;
  acknowledgement?: string;
  turnKind?: 'opening' | 'follow_up' | 'topic_transition' | 'closing';
  category: string;
  difficulty: string;
  isFollowUp: boolean;
  topicId: string;
  topicIndex: number;
  totalTopics: number;
  codingProblem?: { id: string; title: string; statement: string; examples: { input: string; output: string }[] };
}
export interface Turn extends Question {
  seq: number;
  clientTurnId: string;
  answer: string;
  inputMode: 'text' | 'speech';
}
export interface InterviewSession {
  id: string;
  status: 'active' | 'evaluating' | 'completed' | 'abandoned';
  setup: { role: string; interviewType: string; durationPreset: string; companyName: string };
  consent: { storeTranscript: boolean; recordAudio: boolean; recordVideo: boolean; analyzeVideo: boolean };
  seq: number;
  question: Question | null;
  turns: Turn[];
  maxQuestions: number;
  readyToComplete: boolean;
  deadlineAt: string;
  startedAt: string;
  evaluationStatus: 'pending' | 'processing' | 'failed' | 'completed';
  evaluationError?: string;
  interviewId: string | null;
  recordingSegments: { segmentId: string; mimeType: string; bytes: number }[];
}
export interface ApiResult<T> { success: boolean; data: T; error?: string }
