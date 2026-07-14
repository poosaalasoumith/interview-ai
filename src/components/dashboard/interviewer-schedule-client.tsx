"use client";

import React, { useState, useTransition, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  User, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Play, 
  Search,
  Sparkles,
  AlertCircle,
  Video,
  Mail,
  Users,
  Layers,
  MapPin,
  ClipboardList,
  CheckCircle2,
  HelpCircle,
  Inbox,
  Eye,
  Copy,
  ChevronRight,
  Info,
  FileText,
  Loader2,
  UploadCloud,
  Edit3,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MultiEmailInput } from "@/components/ui/multi-email-input";
import { 
  scheduleMultiCandidateInterview, 
  cancelScheduledInterview, 
  getSimulatedEmails,
  getScheduledInterviews,
  getInterviews
} from "@/app/actions/interviews";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { isSessionFinalized, getSessionStatusLabel, getSessionStatusBadgeClasses } from "@/utils/interview-utils";
import { createClient } from "@/utils/supabase/client";

interface Candidate {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

interface StandardInterview {
  id: string;
  title: string;
  candidate_id: string;
  interviewer_id: string;
  status: string;
  session_status?: string;
  scheduled_at: string;
  problem_statement: any;
  candidate?: Candidate;
  interviewer?: any;
}

interface ScheduledInterview {
  id: string;
  title: string;
  role_position: string;
  interview_type: string;
  difficulty_level: string;
  interviewer_id: string;
  scheduled_at: string;
  timezone: string;
  duration_minutes: number;
  notes: string | null;
  room_id: string;
  status: string;
  problem_statement: any;
  interviewer?: any;
  candidate_assignments?: Array<{
    id: string;
    status: string;
    candidate: Candidate;
  }>;
  interview_invitations?: Array<{
    id: string;
    email: string;
    status: string;
    token: string;
    accepted_at: string | null;
  }>;
}

interface SimulatedEmail {
  id: string;
  to_email: string;
  subject: string;
  body_html: string;
  sent_at: string;
}

interface InterviewerScheduleClientProps {
  initialInterviews: StandardInterview[];
  candidates: Candidate[];
  initialScheduled: ScheduledInterview[];
}

const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "EST / EDT (New York)" },
  { value: "America/Chicago", label: "CST / CDT (Chicago)" },
  { value: "America/Denver", label: "MST / MDT (Denver)" },
  { value: "America/Los_Angeles", label: "PST / PDT (Los Angeles)" },
  { value: "Europe/London", label: "GMT / BST (London)" },
  { value: "Europe/Paris", label: "CET / CEST (Paris)" },
  { value: "Asia/Kolkata", label: "IST (India)" },
  { value: "Asia/Singapore", label: "SGT (Singapore)" },
  { value: "Asia/Tokyo", label: "JST (Tokyo)" },
];

export function InterviewerScheduleClient({ 
  initialInterviews, 
  candidates, 
  initialScheduled 
}: InterviewerScheduleClientProps) {
  const [scheduledList, setScheduledList] = useState<ScheduledInterview[]>(initialScheduled);
  const [standardList, setStandardList] = useState<StandardInterview[]>(initialInterviews);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Custom Assessment Source States
  const [assessmentSource, setAssessmentSource] = useState<"ai_generated" | "uploaded">("ai_generated");
  const [parsingStatus, setParsingStatus] = useState<"idle" | "uploading" | "parsing" | "success" | "failed">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedTemplate, setParsedTemplate] = useState<any>(null);
  const [assessmentTemplateId, setAssessmentTemplateId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [parsingError, setParsingError] = useState("");

  // Temp editing question states
  const [editQTitle, setEditQTitle] = useState("");
  const [editQDesc, setEditQDesc] = useState("");
  const [editQDiff, setEditQDiff] = useState("Medium");
  const [editQMarks, setEditQMarks] = useState(10);
  const [editQTags, setEditQTags] = useState("");
  const [editQCodeJS, setEditQCodeJS] = useState("");
  const [editQCodePy, setEditQCodePy] = useState("");
  const [editQCodeJava, setEditQCodeJava] = useState("");
  const [editQCodeCpp, setEditQCodeCpp] = useState("");
  const [editQTestcases, setEditQTestcases] = useState<any[]>([]);
  const [editQDeletedTcIds, setEditQDeletedTcIds] = useState<string[]>([]);

  // Simulated Email Logs State
  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SimulatedEmail | null>(null);

  // Form Fields State
  const [title, setTitle] = useState("");
  const [rolePosition, setRolePosition] = useState("");
  const [interviewType, setInterviewType] = useState("Coding Round");
  const [difficultyLevel, setDifficultyLevel] = useState("Easy");
  const [candidateEmails, setCandidateEmails] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState("");

  // Handler for custom document upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds maximum 10MB size limit.");
      return;
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = ["pdf", "docx", "md", "txt"];
    if (!validExtensions.includes(fileExtension || "")) {
      toast.error("Unsupported file format. Please upload PDF, DOCX, Markdown (.md), or plain text (.txt).");
      return;
    }

    setParsingStatus("uploading");
    setUploadProgress(20);
    setParsingError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(50);
      setParsingStatus("parsing");

      const response = await fetch("/api/assessments/parse", {
        method: "POST",
        body: formData
      });

      setUploadProgress(90);

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Parsing failed");
      }

      setUploadProgress(100);
      setParsingStatus("success");
      setAssessmentTemplateId(data.templateId);
      
      const supabase = createClient();
      const { data: questions, error: qError } = await supabase
        .from("assessment_questions")
        .select(`
          *,
          question_testcases(*)
        `)
        .eq("template_id", data.templateId)
        .order("order_index", { ascending: true });

      if (qError) {
        throw new Error("Failed to load extracted questions: " + qError.message);
      }

      setParsedTemplate({
        id: data.templateId,
        title: data.title,
        questionsCount: data.questionsCount,
        questions: questions || []
      });

      toast.success("Document parsed and questions extracted successfully!");
    } catch (err: any) {
      console.error(err);
      setParsingStatus("failed");
      setParsingError(err.message || "An unexpected error occurred.");
      toast.error(err.message || "Failed to parse document.");
    }
  };

  // Open the Manual Testcase Editor Dialog for a specific question
  const openManualEditor = (qIdx: number) => {
    if (!parsedTemplate || !parsedTemplate.questions[qIdx]) return;
    setActiveQuestionIdx(qIdx);
    const q = parsedTemplate.questions[qIdx];
    
    setEditQTitle(q.title);
    setEditQDesc(q.description);
    setEditQDiff(q.difficulty);
    setEditQMarks(q.marks || 10);
    setEditQTags(Array.isArray(q.tags) ? q.tags.join(", ") : "");
    setEditQCodeJS(q.starter_code?.javascript || "");
    setEditQCodePy(q.starter_code?.python || "");
    setEditQCodeJava(q.starter_code?.java || "");
    setEditQCodeCpp(q.starter_code?.cpp || "");
    setEditQTestcases(q.question_testcases || []);
    setEditQDeletedTcIds([]);
    setIsEditorOpen(true);
  };

  // Save current question edits in local state & database
  const handleSaveQuestion = async () => {
    if (!parsedTemplate) return;
    const activeQ = parsedTemplate.questions[activeQuestionIdx];
    
    const updatedQ = {
      ...activeQ,
      title: editQTitle,
      description: editQDesc,
      difficulty: editQDiff,
      marks: editQMarks,
      tags: editQTags.split(",").map(t => t.trim()).filter(Boolean),
      starter_code: {
        javascript: editQCodeJS,
        python: editQCodePy,
        java: editQCodeJava,
        cpp: editQCodeCpp
      },
      question_testcases: editQTestcases,
      deleted_testcase_ids: editQDeletedTcIds
    };

    setParsingStatus("parsing");
    try {
      const supabase = createClient();
      
      const { error: qError } = await supabase
        .from("assessment_questions")
        .update({
          title: updatedQ.title,
          description: updatedQ.description,
          difficulty: updatedQ.difficulty,
          marks: updatedQ.marks,
          tags: updatedQ.tags,
          starter_code: updatedQ.starter_code
        })
        .eq("id", updatedQ.id);

      if (qError) throw qError;

      for (const tc of updatedQ.question_testcases) {
        if (tc.id.startsWith("temp-")) {
          await supabase
            .from("question_testcases")
            .insert({
              question_id: updatedQ.id,
              input: tc.input,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden,
              explanation: tc.explanation || null
            });
        } else {
          await supabase
            .from("question_testcases")
            .update({
              input: tc.input,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden,
              explanation: tc.explanation || null
            })
            .eq("id", tc.id);
        }
      }

      if (updatedQ.deleted_testcase_ids.length > 0) {
        await supabase
          .from("question_testcases")
          .delete()
          .in("id", updatedQ.deleted_testcase_ids);
      }

      const { data: refreshedQuestions, error: refreshError } = await supabase
        .from("assessment_questions")
        .select(`
          *,
          question_testcases(*)
        `)
        .eq("template_id", parsedTemplate.id)
        .order("order_index", { ascending: true });

      if (refreshError) throw refreshError;

      setParsedTemplate((prev: any) => ({
        ...prev,
        questions: refreshedQuestions || []
      }));

      setIsEditorOpen(false);
      setParsingStatus("success");
      toast.success("Question modifications successfully saved!");
    } catch (err: any) {
      console.error(err);
      setParsingStatus("success");
      toast.error("Failed to save changes: " + err.message);
    }
  };

  const handleAddTestcase = () => {
    setEditQTestcases(prev => [
      ...prev,
      {
        id: `temp-${Math.random().toString(36).substring(2, 9)}`,
        input: "",
        expected_output: "",
        is_hidden: false,
        explanation: ""
      }
    ]);
  };

  const handleDeleteTestcase = (tcId: string) => {
    setEditQTestcases(prev => prev.filter(tc => tc.id !== tcId));
    if (!tcId.startsWith("temp-")) {
      setEditQDeletedTcIds(prev => [...prev, tcId]);
    }
  };

  // Load email logs when Simulated Inbox opens
  const loadEmails = async () => {
    try {
      const logs = await getSimulatedEmails();
      setSimulatedEmails(logs);
      if (logs.length > 0 && !selectedEmail) {
        setSelectedEmail(logs[0]);
      }
    } catch (err) {
      console.error("Failed to load email logs", err);
    }
  };

  useEffect(() => {
    if (isInboxOpen) {
      loadEmails();
    }
  }, [isInboxOpen]);

  // Handle Multi-Candidate Scheduling
  const handleScheduleMulti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !rolePosition || !scheduledDate || !scheduledTime || candidateEmails.length === 0) {
      toast.error("Please fill in all required fields and add at least one candidate email.");
      return;
    }

    if (assessmentSource === "uploaded" && !assessmentTemplateId) {
      toast.error("Please upload and parse an assessment paper first.");
      return;
    }

    // Combine date and time
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

    startTransition(async () => {
      const res = await scheduleMultiCandidateInterview({
        title,
        rolePosition,
        interviewType,
        difficultyLevel,
        scheduledAt,
        timezone,
        durationMinutes,
        notes: notes || undefined,
        candidateEmails,
        assessmentSource,
        assessmentTemplateId: assessmentTemplateId || undefined
      });

      if (res.error) {
        toast.error(res.error);
      } else if (res.success && res.schedule) {
        const updatedSchedules = await getScheduledInterviews();
        setScheduledList(updatedSchedules);

        const updatedInterviews = await getInterviews();
        setStandardList(updatedInterviews);

        toast.success(`Batched scheduled interview created for ${candidateEmails.length} candidates!`);
        setIsScheduleOpen(false);

        // Reset fields
        setTitle("");
        setRolePosition("");
        setInterviewType("Coding Round");
        setDifficultyLevel("Easy");
        setCandidateEmails([]);
        setScheduledDate("");
        setScheduledTime("");
        setTimezone("UTC");
        setDurationMinutes(60);
        setNotes("");
        setAssessmentSource("ai_generated");
        setAssessmentTemplateId(null);
        setParsedTemplate(null);
        setParsingStatus("idle");
      }
    });
  };

  // Handle Cancel Schedule
  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled interview? This will also cancel all isolated rooms generated for assigned candidates.")) return;

    startTransition(async () => {
      const res = await cancelScheduledInterview(scheduleId);
      if (res.error) {
        toast.error(res.error);
      } else {
        setScheduledList(prev => prev.filter(item => item.id !== scheduleId));
        // Refresh standard rooms to sync cancellations
        const updatedInterviews = await getInterviews();
        setStandardList(updatedInterviews);
        toast.success("Scheduled interview and all linked rooms cancelled successfully.");
      }
    });
  };

  // Helper to copy links
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Match standard interviews to individual assigned candidates to grab the live room ID
  const getLiveRoomLink = (candidateEmail: string, scheduledAt: string) => {
    const matched = standardList.find(i => 
      i.candidate?.email.toLowerCase() === candidateEmail.toLowerCase() &&
      new Date(i.scheduled_at).getTime() === new Date(scheduledAt).getTime()
    );
    return matched ? `/interview/${matched.id}` : null;
  };

  // Filter schedules and standard interviews
  const filteredSchedules = scheduledList.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.role_position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.candidate_assignments?.some(a => a.candidate.name?.toLowerCase().includes(searchQuery.toLowerCase()) || a.candidate.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.interview_invitations?.some(i => i.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header section with modern title and primary controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex items-center gap-2">
            <Layers className="w-8 h-8 text-violet-500" />
            Interview Schedule Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Create multi-candidate interview templates, isolate private coding rooms, and monitor email delivery.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Simulated developer Inbox trigger */}
          <Button 
            variant="outline" 
            onClick={() => setIsInboxOpen(true)}
            className="border-stone-800 hover:bg-stone-900 bg-stone-950 text-zinc-300 font-semibold cursor-pointer shrink-0"
          >
            <Inbox className="w-4 h-4 mr-2 text-violet-400" />
            Simulated Inbox
          </Button>

          <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <DialogTrigger render={
              <Button className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 font-semibold cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Batched Interview
              </Button>
            } />
            <DialogContent className="bg-stone-950 border-stone-900 text-zinc-200 sm:max-w-[550px] overflow-y-auto max-h-[90vh] custom-scrollbar">
              <form onSubmit={handleScheduleMulti}>
                <DialogHeader className="border-b border-stone-900 pb-4 mb-4">
                  <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                    Schedule Batched Interview
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter details to provision a high-grade master schedule. Each candidate will be sent a private invitation link to their own isolated coding room.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="title" className="text-zinc-300 text-xs font-semibold">Interview Title</Label>
                      <Input
                        id="title"
                        placeholder="e.g. Senior Backend Architect"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-stone-900/60 border-stone-800 focus:border-violet-500 text-zinc-100 placeholder:text-zinc-600 h-9"
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="role" className="text-zinc-300 text-xs font-semibold">Target Position / Role</Label>
                      <Input
                        id="role"
                        placeholder="e.g. Staff React Engineer"
                        value={rolePosition}
                        onChange={(e) => setRolePosition(e.target.value)}
                        className="bg-stone-900/60 border-stone-800 focus:border-violet-500 text-zinc-100 placeholder:text-zinc-600 h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="type" className="text-zinc-300 text-xs font-semibold">Interview Type</Label>
                      <select
                        id="type"
                        value={interviewType}
                        onChange={(e) => setInterviewType(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-stone-800 bg-stone-900/60 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 text-zinc-200"
                      >
                        <option value="Coding Round">Coding Round (Algorithms)</option>
                        <option value="System Design">System Design</option>
                        <option value="Frontend Coding">Frontend Coding</option>
                        <option value="Behavioral Screen">Behavioral Screen</option>
                      </select>
                    </div>
                    {assessmentSource === "ai_generated" && (
                      <div className="grid gap-1.5 animate-fade-in">
                        <Label htmlFor="difficulty" className="text-zinc-300 text-xs font-semibold">Difficulty Level</Label>
                        <select
                          id="difficulty"
                          value={difficultyLevel}
                          onChange={(e) => setDifficultyLevel(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-stone-800 bg-stone-900/60 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 text-zinc-200"
                        >
                          <option value="Easy">Easy (Auto-allocates: Two Sum)</option>
                          <option value="Medium">Medium (Auto-allocates: Longest Substring)</option>
                          <option value="Hard">Hard (Auto-allocates: Merge k Sorted Lists)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 border-t border-stone-900 pt-3">
                    <Label className="text-zinc-300 text-xs font-semibold">Assessment Source</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-zinc-350 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="assessmentSource"
                          value="ai_generated"
                          checked={assessmentSource === "ai_generated"}
                          onChange={() => setAssessmentSource("ai_generated")}
                          className="accent-violet-500"
                        />
                        AI Generated Questions
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-350 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="assessmentSource"
                          value="uploaded"
                          checked={assessmentSource === "uploaded"}
                          onChange={() => setAssessmentSource("uploaded")}
                          className="accent-violet-500"
                        />
                        Upload Question Paper
                      </label>
                    </div>
                  </div>

                  {assessmentSource === "uploaded" && (
                    <div className="grid gap-2 border border-stone-900 bg-stone-950/40 p-4 rounded-lg animate-in fade-in slide-in-from-top-2 duration-350">
                      <Label className="text-zinc-300 text-xs font-semibold">Upload Question Bank Document</Label>
                      
                      {parsingStatus === "idle" && (
                        <div className="border border-dashed border-stone-800 hover:border-violet-500/50 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition relative group bg-stone-900/10">
                          <UploadCloud className="w-8 h-8 text-zinc-500 group-hover:text-violet-400 transition mb-2" />
                          <p className="text-xs text-zinc-400 font-medium">Drag & drop or click to select files</p>
                          <p className="text-[10px] text-zinc-650 mt-1">PDF, DOCX, Markdown (.md), Text (.txt) up to 10MB</p>
                          <input
                            type="file"
                            accept=".pdf,.docx,.md,.txt"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      )}

                      {(parsingStatus === "uploading" || parsingStatus === "parsing") && (
                        <div className="border border-stone-900 bg-stone-900/20 rounded-lg p-6 flex flex-col items-center justify-center space-y-3">
                          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                          <div className="w-full max-w-[200px] bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-violet-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 font-medium font-mono">
                            {parsingStatus === "uploading" ? `Uploading file (${uploadProgress}%)...` : "AI Extracting & Structuring Questions..."}
                          </span>
                        </div>
                      )}

                      {parsingStatus === "failed" && (
                        <div className="border border-red-950/20 bg-red-950/5 rounded-lg p-4 flex flex-col items-center justify-center space-y-2 border-red-900/30">
                          <AlertCircle className="w-6 h-6 text-red-500" />
                          <p className="text-xs text-red-400 font-medium">{parsingError || "Failed to parse document"}</p>
                          <button
                            type="button"
                            onClick={() => setParsingStatus("idle")}
                            className="text-[10px] text-zinc-400 hover:text-white underline mt-1"
                          >
                            Try Another Upload
                          </button>
                        </div>
                      )}

                      {parsingStatus === "success" && parsedTemplate && (
                        <div className="border border-emerald-900/30 bg-emerald-950/5 rounded-lg p-4 flex items-center justify-between border-emerald-800/20 animate-fade-in">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                              <FileText className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white max-w-[200px] truncate">{parsedTemplate.title}</p>
                              <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{parsedTemplate.questionsCount} Coding Questions Parsed</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setParsingStatus("idle")}
                              className="px-2.5 py-1 text-[10px] font-semibold text-zinc-450 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md transition"
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => openManualEditor(0)}
                              className="px-2.5 py-1 text-[10px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-md transition flex items-center gap-1 shadow-md shadow-violet-500/10"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit Questions
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Multi-Email tag input component! */}
                  <div className="grid gap-1.5 border-t border-stone-900 pt-3">
                    <Label className="text-zinc-300 text-xs font-semibold flex items-center justify-between">
                      <span>Candidate Email Addresses</span>
                      <Badge variant="outline" className="text-[10px] text-violet-400 bg-violet-500/5 border-violet-500/10">
                        Batched Multi-Scheduling
                      </Badge>
                    </Label>
                    <MultiEmailInput 
                      emails={candidateEmails} 
                      onChange={setCandidateEmails}
                      placeholder="Type email and press Enter or Comma..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-stone-900 pt-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="date" className="text-zinc-300 text-xs font-semibold">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="bg-stone-900/60 border-stone-800 focus:border-violet-500 text-zinc-100 h-9"
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="time" className="text-zinc-300 text-xs font-semibold">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="bg-stone-900/60 border-stone-800 focus:border-violet-500 text-zinc-100 h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="timezone" className="text-zinc-300 text-xs font-semibold">Timezone</Label>
                      <select
                        id="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-stone-800 bg-stone-900/60 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 text-zinc-200"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="duration" className="text-zinc-300 text-xs font-semibold">Duration</Label>
                      <select
                        id="duration"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="flex h-9 w-full rounded-md border border-stone-800 bg-stone-900/60 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 text-zinc-200"
                      >
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                        <option value={90}>90 minutes</option>
                        <option value={120}>120 minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="notes" className="text-zinc-300 text-xs font-semibold">Candidate Instructions (Optional)</Label>
                    <textarea
                      id="notes"
                      placeholder="e.g. Please join 5 mins early. You are permitted to use JavaScript or Python for this session."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="flex min-h-[60px] w-full rounded-md border border-stone-800 bg-stone-900/60 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-650 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 text-zinc-200 resize-y"
                    />
                  </div>
                </div>

                <DialogFooter className="border-t border-stone-900 pt-4 mt-4">
                  <Button 
                    type="submit" 
                    disabled={isPending}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md cursor-pointer"
                  >
                    {isPending ? "Scheduling Batch & Provisioning Rooms..." : `Schedule Interview for ${candidateEmails.length} Candidates`}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search filtration input */}
      <div className="flex items-center bg-stone-900/50 border border-stone-800/80 rounded-lg px-3 py-2 max-w-md backdrop-blur-sm">
        <Search className="w-4 h-4 text-zinc-500 mr-2" />
        <input
          type="text"
          placeholder="Search schedules by role, email, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none w-full"
        />
      </div>

      {/* Main Tab content */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-stone-900/40 border border-stone-800/60 p-1.5 mb-6 rounded-lg gap-1.5 w-fit">
          <TabsTrigger value="timeline" className="rounded-md font-semibold px-4 py-1.5 text-zinc-400 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <Calendar className="w-4 h-4 mr-2 text-violet-400" />
            Schedules Timeline
          </TabsTrigger>
          <TabsTrigger value="rooms" className="rounded-md font-semibold px-4 py-1.5 text-zinc-400 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
            <Video className="w-4 h-4 mr-2 text-violet-400" />
            Legacy Rooms ({standardList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-6">
          {filteredSchedules.length === 0 ? (
            <Card className="bg-stone-900/20 border-stone-900 py-16">
              <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-stone-900/40 p-4 rounded-full border border-stone-800 text-zinc-500">
                  <Calendar className="w-8 h-8 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-200">No scheduled sessions found</h3>
                  <p className="text-zinc-500 text-sm max-w-sm mt-1">
                    {searchQuery ? "No batched scheduled interviews match your search criteria." : "Create your first batched multi-candidate scheduled interview using the button above."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredSchedules.map((schedule) => {
                const date = new Date(schedule.scheduled_at);
                const isToday = new Date().toDateString() === date.toDateString();
                
                const formattedDate = date.toLocaleDateString("en-US", { 
                  weekday: "short",
                  month: "short", 
                  day: "numeric", 
                  year: "numeric" 
                });
                const formattedTime = date.toLocaleTimeString("en-US", { 
                  hour: "2-digit", 
                  minute: "2-digit" 
                });

                const totalCandidatesCount = (schedule.candidate_assignments?.length || 0) + (schedule.interview_invitations?.length || 0);

                return (
                  <Card 
                    key={schedule.id}
                    className={cn(
                      "bg-stone-950/40 border-stone-900 hover:border-stone-800/80 transition-all duration-300 relative overflow-hidden group shadow-lg backdrop-blur-md",
                      isToday && "border-l-4 border-l-violet-500"
                    )}
                  >
                    {/* Glow highlighting */}
                    <div className="absolute top-0 right-0 w-44 h-44 bg-violet-600/5 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-600/10 transition-colors duration-300" />

                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-stone-900">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">
                              {schedule.title}
                            </h3>
                            <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-[10px] uppercase font-bold tracking-wider px-2">
                              {schedule.difficulty_level}
                            </Badge>
                          </div>
                          <p className="text-zinc-400 text-sm mt-0.5 font-medium flex items-center gap-1.5">
                            <span>Role: <strong className="text-zinc-200">{schedule.role_position}</strong></span>
                            <span className="text-stone-700">•</span>
                            <span>Type: <strong className="text-zinc-200">{schedule.interview_type}</strong></span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-stone-900/60 border border-stone-850 text-xs text-zinc-300 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                            <span>{formattedDate} at {formattedTime} ({schedule.timezone})</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-stone-900/60 border border-stone-850 text-xs text-zinc-300 font-semibold">
                            <Users className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                            <span>{totalCandidatesCount} Candidates</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelSchedule(schedule.id)}
                            disabled={isPending}
                            className="border-stone-850 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all cursor-pointer text-xs h-7 font-bold"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Cancel Series
                          </Button>
                        </div>
                      </div>

                      {/* Display candidate sub-list */}
                      <div className="mt-5 space-y-3.5">
                        <p className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Individual Isolated Candidate Rooms</p>

                        <div className="grid gap-3 md:grid-cols-2">
                          {/* 1. Accepted Candidates (Linked standard accounts) */}
                          {schedule.candidate_assignments?.map((assignment) => {
                            const matchedInterview = standardList.find(i => 
                              i.candidate?.email.toLowerCase() === assignment.candidate.email.toLowerCase() &&
                              new Date(i.scheduled_at).getTime() === new Date(schedule.scheduled_at).getTime()
                            );
                            const isFinalized = matchedInterview ? isSessionFinalized(matchedInterview.session_status) : false;
                            const liveRoomLink = matchedInterview ? `/interview/${matchedInterview.id}` : null;

                            return (
                              <div 
                                key={assignment.id}
                                className={cn(
                                  "flex items-center justify-between p-3.5 rounded-xl border border-stone-900/60 transition-colors",
                                  isFinalized 
                                    ? "bg-stone-900/5 border-stone-950 opacity-60 saturate-50 contrast-90"
                                    : "bg-stone-900/20 hover:border-stone-800"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar className="h-10 w-10 border border-stone-800 shrink-0">
                                    <AvatarImage src={assignment.candidate.avatar || ""} />
                                    <AvatarFallback className="bg-stone-900 text-violet-400 font-bold">
                                      {assignment.candidate.name?.substring(0, 2).toUpperCase() || "C"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-zinc-300 truncate">{assignment.candidate.name || "Accepted Candidate"}</p>
                                    <p className="text-[11px] text-zinc-500 truncate">{assignment.candidate.email}</p>
                                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[9px] mt-1 px-1.5 h-4.5 font-bold">
                                      <CheckCircle2 className="w-2.5 h-2.5 mr-1 inline shrink-0" />
                                      Account Active
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {isFinalized && matchedInterview ? (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                        getSessionStatusBadgeClasses(matchedInterview.session_status)
                                      )}
                                    >
                                      {getSessionStatusLabel(matchedInterview.session_status)}
                                    </span>
                                  ) : liveRoomLink ? (
                                    <Link href={liveRoomLink} className="inline-flex">
                                      <Button 
                                        size="sm"
                                        className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] h-7 px-3.5 font-bold shadow-md shadow-violet-500/10 cursor-pointer"
                                      >
                                        <Play className="w-3 h-3 mr-1 fill-current" />
                                        Launch Room
                                      </Button>
                                    </Link>
                                  ) : (
                                    <Badge variant="outline" className="border-stone-850 text-zinc-500 text-[10px] h-7 px-2 bg-stone-900/40">
                                      <Info className="w-3 h-3 mr-1 shrink-0" />
                                      Lobby Pending
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* 2. Pending Invitations (Emails queued, accounts not created yet) */}
                          {schedule.interview_invitations?.map((invite) => {
                            const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                            const inviteLink = `${origin}/signup?token=${invite.token}&email=${encodeURIComponent(invite.email)}`;

                            return (
                              <div 
                                key={invite.id}
                                className="flex items-center justify-between p-3.5 rounded-xl border border-stone-900/60 bg-stone-900/10 hover:border-stone-800 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-10 w-10 border border-stone-850 rounded-full flex items-center justify-center bg-stone-950 text-zinc-500 shrink-0">
                                    <Mail className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-zinc-400 truncate">{invite.email.split("@")[0]}</p>
                                    <p className="text-[11px] text-zinc-500 truncate">{invite.email}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] px-1.5 h-4.5 font-bold animate-pulse">
                                        Pending Invite
                                      </Badge>
                                      {invite.status === "accepted" && (
                                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[9px] px-1.5 h-4.5 font-bold">
                                          Accepted
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(inviteLink, "Invitation link")}
                                    className="border-stone-850 bg-stone-950/60 hover:bg-stone-900 text-zinc-400 hover:text-zinc-200 text-[11px] h-7 px-2.5 font-semibold cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    Link
                                  </Button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Fallback if somehow there are no assignments or invites */}
                          {(!schedule.candidate_assignments || schedule.candidate_assignments.length === 0) &&
                           (!schedule.interview_invitations || schedule.interview_invitations.length === 0) && (
                            <div className="col-span-2 p-4 text-center text-xs text-zinc-600 bg-stone-900/10 rounded-lg border border-dashed border-stone-850">
                              No candidates assigned to this schedule template.
                            </div>
                           )}
                        </div>
                      </div>

                      {/* Display notes if they exist */}
                      {schedule.notes && (
                        <div className="mt-4 p-3 rounded-lg border border-stone-900/50 bg-stone-950/40 text-xs flex items-start gap-2.5">
                          <Info className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
                          <div className="text-zinc-400 italic">
                            <span className="font-bold text-zinc-500 not-italic mr-1">Instructions:</span>
                            "{schedule.notes}"
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {standardList.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-zinc-500 bg-stone-900/10 rounded-xl border border-dashed border-stone-900">
                No active legacy rooms provisioned.
              </div>
            ) : (
              standardList.map((interview) => {
                const date = new Date(interview.scheduled_at);
                const isToday = new Date().toDateString() === date.toDateString();
                const formattedDate = date.toLocaleDateString(undefined, { 
                  month: "short", 
                  day: "numeric", 
                  year: "numeric" 
                });
                const formattedTime = date.toLocaleTimeString(undefined, { 
                  hour: "2-digit", 
                  minute: "2-digit" 
                });

                return (
                  <Card 
                    key={interview.id} 
                    className={cn(
                      "transition-all duration-300 relative overflow-hidden group",
                      isSessionFinalized(interview.session_status)
                        ? "bg-stone-950/15 border-stone-950 opacity-65 saturate-50 contrast-95 pointer-events-auto shadow-inner"
                        : "bg-stone-950/40 border-stone-900 hover:border-stone-800/80",
                      isToday && !isSessionFinalized(interview.session_status) && "border-l-4 border-l-violet-500"
                    )}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-violet-500/10 transition-colors" />

                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <CardTitle className="text-md font-bold text-white group-hover:text-violet-400 transition-colors">
                            {interview.title}
                          </CardTitle>
                          <CardDescription className="text-zinc-500 mt-0.5">
                            ID: <span className="font-mono text-xs text-zinc-400">{interview.id.substring(0, 8)}...</span>
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-1.5 h-4.5 font-bold shrink-0",
                          isSessionFinalized(interview.session_status)
                            ? getSessionStatusBadgeClasses(interview.session_status)
                            : interview.status === "in_progress" 
                              ? "bg-violet-500/10 text-violet-300 border-violet-500/20 animate-pulse" 
                              : "bg-stone-900 text-zinc-400 border-stone-800"
                        )}>
                          {isSessionFinalized(interview.session_status)
                            ? getSessionStatusLabel(interview.session_status)
                            : interview.status
                          }
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-2 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>{formattedTime}</span>
                        </div>
                        <div className="flex items-center gap-3 pt-2 mt-2 border-t border-stone-900/60">
                          <Avatar className="h-8 w-8 border border-stone-900 shrink-0">
                            <AvatarImage src={interview.candidate?.avatar || ""} />
                            <AvatarFallback className="bg-stone-900 text-zinc-400 font-semibold text-xs">
                              {interview.candidate?.name?.substring(0, 2).toUpperCase() || "C"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-zinc-300 truncate">Candidate</p>
                            <p className="text-xs text-white truncate font-medium">{interview.candidate?.name || "Guest Candidate"}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{interview.candidate?.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1.5 justify-end">
                        {isSessionFinalized(interview.session_status) ? (
                          /* Finalized — show status badge and review link */
                          <>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                getSessionStatusBadgeClasses(interview.session_status)
                              )}
                            >
                              {getSessionStatusLabel(interview.session_status)}
                            </span>
                            <Link href={`/dashboard/interviewer/review/${interview.id}`} className="inline-flex">
                              <Button 
                                size="sm"
                                variant="secondary"
                                className="bg-stone-900 hover:bg-stone-850 text-zinc-300 border border-stone-800 text-[11px] h-7 px-3 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Review
                              </Button>
                            </Link>
                          </>
                        ) : interview.status !== "completed" ? (
                          <Link href={`/interview/${interview.id}`} className="inline-flex">
                            <Button 
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-[11px] h-7 px-3.5 shadow-md shadow-violet-500/10 cursor-pointer"
                            >
                              <Play className="w-3 h-3 mr-1 fill-current" />
                              Join Lobby
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/dashboard/interviewer/review/${interview.id}`} className="inline-flex">
                            <Button 
                              size="sm"
                              variant="secondary"
                              className="bg-stone-900 hover:bg-stone-850 text-zinc-300 border border-stone-800 text-[11px] h-7 px-3 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View Review
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Simulated Developer Email Inbox Drawer/Sheet */}
      <Sheet open={isInboxOpen} onOpenChange={setIsInboxOpen}>
        <SheetContent className="bg-stone-950 border-stone-900 text-zinc-100 sm:max-w-[700px] overflow-hidden flex flex-col h-full">
          <SheetHeader className="border-b border-stone-900 pb-4 shrink-0">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-violet-400 animate-bounce" />
              Simulated Developer Inbox
            </SheetTitle>
            <SheetDescription className="text-zinc-400 text-xs">
              Review sent invitations, inspect generated HTML email payloads, and click direct access invitation tokens to test registration workflows locally.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 overflow-hidden mt-4 gap-4 h-full">
            {/* List side */}
            <div className="w-1/3 border-r border-stone-900 pr-3 overflow-y-auto flex flex-col gap-2 shrink-0 custom-scrollbar">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Outbox ({simulatedEmails.length})</span>
                <Button variant="ghost" onClick={loadEmails} className="h-5 text-[10px] text-violet-400 p-0 hover:bg-transparent font-semibold">
                  Refresh
                </Button>
              </div>

              {simulatedEmails.length === 0 ? (
                <div className="text-center p-6 text-xs text-zinc-600 italic">
                  No emails logged yet.
                </div>
              ) : (
                simulatedEmails.map((email) => {
                  const isActive = selectedEmail?.id === email.id;
                  return (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col gap-1 cursor-pointer",
                        isActive 
                          ? "bg-violet-500/10 border-violet-500/30 text-white font-semibold" 
                          : "bg-stone-900/40 border-stone-900 hover:bg-stone-900 text-zinc-400"
                      )}
                    >
                      <div className="flex justify-between items-center w-full min-w-0">
                        <span className="font-semibold text-zinc-200 truncate shrink-0 max-w-[80px]">To: {email.to_email.split("@")[0]}</span>
                        <span className="text-[9px] text-zinc-650 shrink-0 font-normal">{new Date(email.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 truncate w-full">{email.subject}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Viewer side */}
            <div className="flex-1 overflow-hidden flex flex-col h-full bg-stone-900/20 rounded-xl border border-stone-900">
              {selectedEmail ? (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b border-stone-900 bg-stone-950/60 shrink-0 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs">
                        <p className="text-zinc-500"><span className="font-bold text-zinc-400 mr-1">To:</span>{selectedEmail.to_email}</p>
                        <p className="text-zinc-500"><span className="font-bold text-zinc-400 mr-1">Subject:</span>{selectedEmail.subject}</p>
                      </div>
                      <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-[9px] font-bold">
                        Simulated Outbox
                      </Badge>
                    </div>
                  </div>

                  {/* HTML email sandboxed render */}
                  <div className="flex-1 overflow-y-auto p-4 bg-stone-950 custom-scrollbar">
                    <div 
                      className="border border-stone-900 rounded-lg p-2 bg-transparent scale-95 origin-top"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center p-8 space-y-3">
                  <Mail className="h-8 w-8 text-zinc-600 animate-pulse" />
                  <p className="text-sm text-zinc-500 font-medium">Select an outbox email log from the left sidebar to preview the invitation workflow.</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Test Case Editor (Section 10) */}
      {parsedTemplate && (
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="bg-stone-950 border-stone-900 text-zinc-250 sm:max-w-[850px] overflow-y-auto max-h-[90vh] custom-scrollbar">
            <DialogHeader className="border-b border-stone-900 pb-4 mb-4">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-violet-400 animate-spin-once" />
                Manual Assessment Editor
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Review and customize the extracted questions, test cases, and starter templates. Changes will update the parsed template records dynamically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[500px] overflow-hidden">
              <div className="md:col-span-1 border-r border-stone-900 pr-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar h-full">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase select-none mb-1">Questions ({parsedTemplate.questions.length})</span>
                {parsedTemplate.questions.map((q: any, idx: number) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => openManualEditor(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg text-xs font-semibold border transition-all flex items-start gap-2",
                      idx === activeQuestionIdx
                        ? "bg-violet-650/10 border-violet-500 text-violet-400"
                        : "bg-stone-900/40 border-stone-900 text-zinc-400 hover:bg-stone-900/60 hover:text-white"
                    )}
                  >
                    <span className="bg-zinc-800 text-[10px] w-4 h-4 rounded-full flex items-center justify-center text-zinc-400 shrink-0 mt-0.5 font-bold">{idx + 1}</span>
                    <span className="truncate">{q.title}</span>
                  </button>
                ))}
              </div>

              <div className="md:col-span-3 overflow-y-auto pr-1 h-full flex flex-col gap-4 custom-scrollbar text-left">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-zinc-400 text-[11px] font-bold">Question Title</Label>
                    <Input
                      value={editQTitle}
                      onChange={(e) => setEditQTitle(e.target.value)}
                      className="bg-stone-900 border-stone-850 text-zinc-100 text-xs h-8 focus:border-violet-500"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-zinc-400 text-[11px] font-bold">Difficulty</Label>
                    <select
                      value={editQDiff}
                      onChange={(e) => setEditQDiff(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-stone-850 bg-stone-900 px-2 py-1 text-xs text-zinc-200"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-zinc-400 text-[11px] font-bold">Allocated Marks</Label>
                    <Input
                      type="number"
                      value={editQMarks}
                      onChange={(e) => setEditQMarks(Number(e.target.value))}
                      className="bg-stone-900 border-stone-850 text-zinc-100 text-xs h-8 focus:border-violet-500"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-zinc-400 text-[11px] font-bold">Tags (comma separated)</Label>
                    <Input
                      value={editQTags}
                      onChange={(e) => setEditQTags(e.target.value)}
                      className="bg-stone-900 border-stone-850 text-zinc-100 text-xs h-8 focus:border-violet-500"
                      placeholder="Array, Hash Map"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-zinc-400 text-[11px] font-bold">Description (Markdown)</Label>
                  <textarea
                    value={editQDesc}
                    onChange={(e) => setEditQDesc(e.target.value)}
                    className="flex min-h-[100px] w-full rounded-md border border-stone-850 bg-stone-900 px-3 py-2 text-xs text-zinc-200 resize-y font-sans leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
                  />
                </div>

                <div className="grid gap-1.5 border-t border-stone-900 pt-3">
                  <Label className="text-zinc-400 text-[11px] font-bold">Starter Code Templates</Label>
                  <Tabs defaultValue="javascript" className="w-full">
                    <TabsList className="bg-stone-900/60 border border-stone-850/60 p-0.5 rounded-md gap-1 w-full justify-start h-8">
                      <TabsTrigger value="javascript" className="text-[10px] px-3 py-1 font-bold">JavaScript</TabsTrigger>
                      <TabsTrigger value="python" className="text-[10px] px-3 py-1 font-bold">Python</TabsTrigger>
                      <TabsTrigger value="java" className="text-[10px] px-3 py-1 font-bold">Java</TabsTrigger>
                      <TabsTrigger value="cpp" className="text-[10px] px-3 py-1 font-bold">C++</TabsTrigger>
                    </TabsList>
                    <TabsContent value="javascript" className="mt-2">
                      <textarea
                        value={editQCodeJS}
                        onChange={(e) => setEditQCodeJS(e.target.value)}
                        className="w-full h-24 bg-stone-900 text-green-400 p-2 rounded-lg border border-stone-850 font-mono text-xs leading-5"
                      />
                    </TabsContent>
                    <TabsContent value="python" className="mt-2">
                      <textarea
                        value={editQCodePy}
                        onChange={(e) => setEditQCodePy(e.target.value)}
                        className="w-full h-24 bg-stone-900 text-green-400 p-2 rounded-lg border border-stone-850 font-mono text-xs leading-5"
                      />
                    </TabsContent>
                    <TabsContent value="java" className="mt-2">
                      <textarea
                        value={editQCodeJava}
                        onChange={(e) => setEditQCodeJava(e.target.value)}
                        className="w-full h-24 bg-stone-900 text-green-400 p-2 rounded-lg border border-stone-850 font-mono text-xs leading-5"
                      />
                    </TabsContent>
                    <TabsContent value="cpp" className="mt-2">
                      <textarea
                        value={editQCodeCpp}
                        onChange={(e) => setEditQCodeCpp(e.target.value)}
                        className="w-full h-24 bg-stone-900 text-green-400 p-2 rounded-lg border border-stone-850 font-mono text-xs leading-5"
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="grid gap-3 border-t border-stone-900 pt-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-zinc-400 text-[11px] font-bold">Test Cases ({editQTestcases.length})</Label>
                    <button
                      type="button"
                      onClick={handleAddTestcase}
                      className="px-2.5 py-1 bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 text-[10px] font-bold rounded border border-violet-500/20 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Test Case
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editQTestcases.map((tc: any, tcIdx: number) => (
                      <div key={tc.id} className="bg-stone-900/40 border border-stone-900 rounded-lg p-3 space-y-2.5 relative">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-bold uppercase shrink-0 px-2 py-0.5",
                            tc.is_hidden 
                              ? "bg-amber-500/5 text-amber-400 border-amber-500/10" 
                              : "bg-indigo-500/5 text-indigo-400 border-indigo-500/10"
                          )}>
                            {tc.is_hidden ? "Hidden Case" : "Visible Case"}
                          </Badge>
                          
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[10px] text-zinc-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={tc.is_hidden}
                                onChange={(e) => {
                                  const updated = [...editQTestcases];
                                  updated[tcIdx] = { ...updated[tcIdx], is_hidden: e.target.checked };
                                  setEditQTestcases(updated);
                                }}
                                className="accent-violet-500 w-3 h-3"
                              />
                              Is Hidden
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteTestcase(tc.id)}
                              className="p-1 hover:text-red-400 text-zinc-500 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1">
                            <span className="text-[10px] text-zinc-500 font-bold font-mono">Input</span>
                            <textarea
                              value={tc.input}
                              onChange={(e) => {
                                const updated = [...editQTestcases];
                                updated[tcIdx] = { ...updated[tcIdx], input: e.target.value };
                                setEditQTestcases(updated);
                              }}
                              className="w-full bg-stone-950 text-zinc-300 border border-stone-850 p-2 rounded text-[11px] font-mono h-14 focus:outline-none focus:border-violet-500"
                              placeholder="e.g. nums = [2,7], target = 9"
                            />
                          </div>
                          <div className="grid gap-1">
                            <span className="text-[10px] text-zinc-500 font-bold font-mono">Expected Output</span>
                            <textarea
                              value={tc.expected_output}
                              onChange={(e) => {
                                const updated = [...editQTestcases];
                                updated[tcIdx] = { ...updated[tcIdx], expected_output: e.target.value };
                                setEditQTestcases(updated);
                              }}
                              className="w-full bg-stone-950 text-zinc-300 border border-stone-850 p-2 rounded text-[11px] font-mono h-14 focus:outline-none focus:border-violet-500"
                              placeholder="e.g. [0,1]"
                            />
                          </div>
                        </div>
                        
                        {!tc.is_hidden && (
                          <div className="grid gap-1 animate-fade-in">
                            <span className="text-[10px] text-zinc-500 font-bold">Explanation (Optional)</span>
                            <Input
                              value={tc.explanation || ""}
                              onChange={(e) => {
                                const updated = [...editQTestcases];
                                updated[tcIdx] = { ...updated[tcIdx], explanation: e.target.value };
                                setEditQTestcases(updated);
                              }}
                              className="bg-stone-950 border-stone-850 text-zinc-300 text-[11px] h-7 focus:border-violet-500"
                              placeholder="Describe the logic..."
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-stone-900 pt-4 mt-4">
              <Button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs py-1 cursor-pointer"
              >
                Close Editor
              </Button>
              <Button
                type="button"
                onClick={handleSaveQuestion}
                className="bg-violet-650 hover:bg-violet-500 text-white font-semibold text-xs py-1 cursor-pointer"
              >
                Save Question Customizations
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
