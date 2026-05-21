"use client";

import { useState, useTransition } from "react";
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
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { scheduleInterview, cancelInterview } from "@/app/actions/interviews";
import { toast } from "sonner";
import Link from "next/link";

interface Candidate {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

interface Interview {
  id: string;
  title: string;
  candidate_id: string;
  interviewer_id: string;
  status: string;
  scheduled_at: string;
  problem_statement: any;
  candidate?: Candidate;
  interviewer?: any;
}

interface InterviewerScheduleClientProps {
  initialInterviews: Interview[];
  candidates: Candidate[];
}

export function InterviewerScheduleClient({ initialInterviews, candidates }: InterviewerScheduleClientProps) {
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !candidateId || !scheduledDate || !scheduledTime) {
      toast.error("Please fill in all fields.");
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

    startTransition(async () => {
      const res = await scheduleInterview({
        title,
        candidateId,
        scheduledAt,
      });

      if (res.error) {
        toast.error(res.error);
      } else if (res.success && res.interview) {
        const candidateInfo = candidates.find(c => c.id === candidateId);
        const newInterview: Interview = {
          ...res.interview,
          candidate: candidateInfo
        };
        setInterviews(prev => [newInterview, ...prev].sort((a, b) => 
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        ));
        toast.success("Interview scheduled successfully!");
        setIsOpen(false);
        // Reset Form
        setTitle("");
        setCandidateId("");
        setScheduledDate("");
        setScheduledTime("");
      }
    });
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this interview?")) return;

    startTransition(async () => {
      const res = await cancelInterview(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        setInterviews(prev => prev.filter(item => item.id !== id));
        toast.success("Interview cancelled successfully.");
      }
    });
  };

  const filteredInterviews = interviews.filter(interview => 
    interview.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    interview.candidate?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    interview.candidate?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Schedule & Sessions
          </h1>
          <p className="text-muted-foreground mt-1">Schedule new live technical rounds and manage your existing timeline.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          } />
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-200 sm:max-w-[425px]">
            <form onSubmit={handleSchedule}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Schedule Interview
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Fill in the details below to provision a live peer-to-peer coding interview session.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-zinc-300">Interview Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Senior Frontend Round"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 focus:border-primary text-zinc-100 placeholder:text-zinc-600"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="candidate" className="text-zinc-300">Select Candidate</Label>
                  <select
                    id="candidate"
                    value={candidateId}
                    onChange={(e) => setCandidateId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-zinc-200"
                    required
                  >
                    <option value="">-- Choose a Candidate --</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.email} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date" className="text-zinc-300">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 focus:border-primary text-zinc-100"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time" className="text-zinc-300">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 focus:border-primary text-zinc-100"
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full sm:w-auto bg-primary text-primary-foreground"
                >
                  {isPending ? "Scheduling..." : "Schedule Interview"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center bg-zinc-900/40 border border-zinc-800/80 rounded-lg px-3 py-2 max-w-md">
        <Search className="w-4 h-4 text-zinc-500 mr-2" />
        <input
          type="text"
          placeholder="Search by candidate name, email, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none w-full"
        />
      </div>

      {filteredInterviews.length === 0 ? (
        <Card className="bg-zinc-900/30 border-zinc-800/50 py-12">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-zinc-800/40 p-4 rounded-full border border-zinc-800 text-zinc-500">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">No interviews found</h3>
              <p className="text-zinc-500 text-sm max-w-sm mt-1">
                {searchQuery ? "No scheduled sessions match your filter." : "Start by scheduling an interview round with an eligible candidate."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredInterviews.map((interview) => {
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
                className={`bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-300 relative overflow-hidden group ${
                  isToday ? "border-l-4 border-l-primary" : ""
                }`}
              >
                {/* Decorative glow on hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary/10 transition-colors" />

                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                        {interview.title}
                      </CardTitle>
                      <CardDescription className="text-zinc-500 mt-0.5">
                        ID: <span className="font-mono text-xs text-zinc-400">{interview.id.substring(0, 8)}...</span>
                      </CardDescription>
                    </div>
                    <Badge variant={interview.status === "completed" ? "default" : "outline"} className={
                      interview.status === "completed" 
                        ? "bg-green-500/10 text-green-400 border-green-500/20" 
                        : interview.status === "in_progress" 
                          ? "bg-primary/10 text-primary border-primary/20 animate-pulse" 
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }>
                      {interview.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 text-sm text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>{formattedTime}</span>
                    </div>
                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-zinc-800/50">
                      <Avatar className="h-9 w-9 border border-zinc-800 shrink-0">
                        <AvatarImage src={interview.candidate?.avatar || ""} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-300">
                          {interview.candidate?.name?.substring(0, 2).toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-300 truncate">Candidate</p>
                        <p className="text-sm text-white truncate">{interview.candidate?.name || "Guest Candidate"}</p>
                        <p className="text-xs text-zinc-500 truncate">{interview.candidate?.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(interview.id)}
                      disabled={isPending}
                      className="border-zinc-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                    
                    {interview.status !== "completed" ? (
                      <Link href={`/interview/${interview.id}`} className="inline-flex">
                        <Button 
                          size="sm"
                          className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-md shadow-primary/10 text-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                          Join Lobby
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/dashboard/interviewer/review/${interview.id}`} className="inline-flex">
                        <Button 
                          size="sm"
                          variant="secondary"
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 text-xs cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          View Review
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
