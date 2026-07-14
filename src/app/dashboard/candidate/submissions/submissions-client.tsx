"use client";

import React, { useState, useMemo } from "react";
import { SafeLink } from "@/components/ui/safe-link";
import { Routes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Code2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Play,
  Download,
  ExternalLink,
  ArrowUpRight,
  BarChart3,
  Star,
  Award,
  Zap,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export interface SubmissionsHistoryClientProps {
  initialSubmissions: any[];
  stats: {
    totalInterviews: number;
    averageScore: number;
    practiceSessions: number;
    codingAssessments: number;
    liveInterviews: number;
    successRate: number;
    currentStreak: number;
  };
}

export function SubmissionsHistoryClient({ initialSubmissions, stats }: SubmissionsHistoryClientProps) {
  const router = useRouter();
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [roundFilter, setRoundFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter & Search Logic
  const filteredSubmissions = useMemo(() => {
    return initialSubmissions.filter((item) => {
      // 1. Search Query
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.title?.toLowerCase().includes(query) ||
        item.role?.toLowerCase().includes(query) ||
        item.roundType?.toLowerCase().includes(query) ||
        item.languageUsed?.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;

      // 2. Type Filter
      if (typeFilter !== "All" && item.type !== typeFilter) return false;

      // 3. Round Filter
      if (roundFilter !== "All") {
        const roundLower = item.roundType?.toLowerCase() || "";
        const filterLower = roundFilter.toLowerCase();
        if (filterLower === "technical" && !roundLower.includes("technical") && !roundLower.includes("coding") && !roundLower.includes("design")) return false;
        if (filterLower === "behavioral" && !roundLower.includes("behavioral")) return false;
        if (filterLower === "hr" && !roundLower.includes("hr")) return false;
        if (filterLower === "coding" && !roundLower.includes("coding")) return false;
      }

      // 4. Status Filter
      if (statusFilter !== "All") {
        if (statusFilter === "Passed" && item.overallResult !== "Passed" && item.overallResult !== "Strong Fit") return false;
        if (statusFilter === "Failed" && item.overallResult === "Passed") return false;
      }

      // 5. Date Range Filter
      if (startDate) {
        const start = new Date(startDate);
        const itemDate = new Date(item.date);
        if (itemDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include full end day
        const itemDate = new Date(item.date);
        if (itemDate > end) return false;
      }

      return true;
    });
  }, [initialSubmissions, searchQuery, typeFilter, roundFilter, statusFilter, startDate, endDate]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, roundFilter, statusFilter, startDate, endDate]);

  // Pagination Logic
  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubmissions, currentPage]);

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage) || 1;

  // Custom formatted badge renderers
  const getStatusBadge = (status: string, result: string) => {
    const statusText = status?.toLowerCase();
    const resultText = result?.toLowerCase();

    if (statusText === "completed" || statusText === "success" || resultText === "passed" || resultText === "strong fit") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 gap-1 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Completed
        </Badge>
      );
    }
    if (statusText === "failed" || resultText === "failed" || resultText === "run error") {
      return (
        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15 gap-1 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Failed
        </Badge>
      );
    }
    if (statusText === "expired" || statusText === "missed") {
      return (
        <Badge className="bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 gap-1 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          Expired
        </Badge>
      );
    }
    if (statusText === "cancelled" || statusText === "canceled") {
      return (
        <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/15 gap-1 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          Cancelled
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 gap-1 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        {status || "Active"}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Practice":
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black">Practice</Badge>;
      case "Mock Interview":
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black">Mock Interview</Badge>;
      case "Real Interview":
        return <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-black">Live Interview</Badge>;
      case "Coding Assessment":
        return <Badge className="bg-violet-500/10 text-violet-400 border border-violet-500/20 font-black">Coding Assessment</Badge>;
      default:
        return <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-750 font-black">Sandbox Run</Badge>;
    }
  };

  // Export handlers
  const handleDownloadReport = (item: any, format: "md" | "json") => {
    let filename = `Report-${item.type.replace(/\s+/g, "-")}-${item.id}`;
    let content = "";
    
    if (format === "json") {
      content = JSON.stringify(item, null, 2);
      filename += ".json";
    } else {
      content = `# InterviewAI Assessment Report\n\n` +
                `**Type:** ${item.type}\n` +
                `**Title:** ${item.title}\n` +
                `**Role:** ${item.role}\n` +
                `**Date:** ${new Date(item.date).toLocaleDateString()}\n` +
                `**Score:** ${item.score !== null ? `${item.score}%` : "N/A"}\n` +
                `**Result:** ${item.overallResult}\n` +
                `**Duration/Time:** ${item.timeTaken}\n` +
                `**Language:** ${item.languageUsed}\n\n` +
                `## Overall Feedback Summary\n\n` +
                `${item.evaluation?.summary || item.feedback?.ai_feedback || "No summary feedback details recorded."}\n`;
      filename += ".md";
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex items-center gap-2">
          <Code2 className="w-8 h-8 text-primary" />
          Submission & Evaluation History
        </h1>
        <p className="text-muted-foreground mt-1">
          Review your unified chronological activity logs, including practice runs, AI mock sessions, coding challenges, and completed live assessments.
        </p>
      </div>

      {/* Analytics Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors">
          <p className="text-xs text-zinc-400 font-medium">Total Runs</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-white">{stats.totalInterviews}</span>
          </div>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors border-l-2 border-l-emerald-500">
          <p className="text-xs text-zinc-400 font-medium">Average Score</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-emerald-400">{stats.averageScore}%</span>
          </div>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors">
          <p className="text-xs text-zinc-400 font-medium">Practice</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-amber-400">{stats.practiceSessions}</span>
          </div>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors">
          <p className="text-xs text-zinc-400 font-medium">Coding Tests</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-violet-400">{stats.codingAssessments}</span>
          </div>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors">
          <p className="text-xs text-zinc-400 font-medium">Live Interviews</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-indigo-400">{stats.liveInterviews}</span>
          </div>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors border-l-2 border-l-blue-500">
          <p className="text-xs text-zinc-400 font-medium">Success Rate</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-blue-400">{stats.successRate}%</span>
          </div>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 flex flex-col justify-between hover:bg-zinc-900/60 transition-colors">
          <p className="text-xs text-zinc-400 font-medium">Daily Streak</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-primary flex items-center gap-1">
              <Zap className="w-4 h-4 fill-current text-primary" />
              {stats.currentStreak}d
            </span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Panel */}
      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/85 p-5">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 items-end">
          
          {/* Search Input */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-zinc-400">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search role, name, question..."
                className="pl-9 bg-zinc-950/80 border-zinc-800 text-white placeholder-zinc-500 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Type</label>
            <select
              className="w-full rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-white h-9 focus:ring-1 focus:ring-primary outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Practice">Practice Session</option>
              <option value="Mock Interview">Mock Interview</option>
              <option value="Real Interview">Real Interview</option>
              <option value="Coding Assessment">Coding Assessment</option>
              <option value="Compiler Sandbox">Compiler Sandbox</option>
            </select>
          </div>

          {/* Round Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Round</label>
            <select
              className="w-full rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-white h-9 focus:ring-1 focus:ring-primary outline-none"
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
            >
              <option value="All">All Rounds</option>
              <option value="Technical">Technical</option>
              <option value="Coding">Coding</option>
              <option value="Behavioral">Behavioral</option>
              <option value="HR">HR Round</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Result</label>
            <select
              className="w-full rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-white h-9 focus:ring-1 focus:ring-primary outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Outcomes</option>
              <option value="Passed">Passed / Strong Fit</option>
              <option value="Failed">Failed / Error</option>
            </select>
          </div>

          {/* Date Picker Button / Toggle */}
          <div className="space-y-1.5 flex gap-2 w-full">
            <div className="w-1/2 space-y-1">
              <label className="text-[10px] font-semibold text-zinc-550 uppercase">From</label>
              <Input
                type="date"
                className="bg-zinc-950/80 border-zinc-800 text-white text-[11px] h-9 p-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="w-1/2 space-y-1">
              <label className="text-[10px] font-semibold text-zinc-550 uppercase">To</label>
              <Input
                type="date"
                className="bg-zinc-950/80 border-zinc-800 text-white text-[11px] h-9 p-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

        </div>
      </Card>

      {/* Chronological Timeline */}
      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardHeader className="pb-3 border-b border-zinc-850/50">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Activity Timeline
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Showing {filteredSubmissions.length} active executions.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {paginatedSubmissions.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-850 flex items-center justify-center mx-auto border border-zinc-800">
                <Code2 className="w-6 h-6 text-zinc-550" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-300">No matching activities found</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Try adjusting your filters or search term to see other recorded technical submissions.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedSubmissions.map((item: any) => {
                const formattedDate = new Date(item.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                });

                const formattedTime = new Date(item.date).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit"
                });

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-4.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    
                    {/* Activity Info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTypeBadge(item.type)}
                        <span className="text-xs text-zinc-450 font-medium">
                          {formattedDate} at {formattedTime}
                        </span>
                        {item.languageUsed && item.languageUsed !== "N/A" && (
                          <Badge variant="outline" className="text-[10px] font-mono text-zinc-400 border-zinc-800 lowercase">
                            {item.languageUsed}
                          </Badge>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </h4>
                        <p className="text-xs text-zinc-450 mt-0.5 truncate">
                          Role target: <span className="text-zinc-300 font-medium">{item.role}</span>
                          {item.roundType && ` • Round: ${item.roundType}`}
                        </p>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3.5 md:pt-0 border-t md:border-t-0 border-zinc-900">
                      
                      {/* Score & Badges */}
                      <div className="flex items-center gap-3">
                        {item.score !== null && (
                          <div className="text-right shrink-0">
                            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider block">Score</span>
                            <span className="text-sm font-black text-emerald-400">{item.score}%</span>
                          </div>
                        )}
                        <div className="text-right">
                          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider block mb-0.5 text-left md:text-right">Status</span>
                          {getStatusBadge(item.status, item.overallResult)}
                        </div>
                      </div>

                      {/* Timeline Duration */}
                      <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {item.timeTaken}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        
                        {/* Replay Option for Practice only */}
                        {item.type === "Practice" && (
                          <SafeLink
                            href={`${Routes.candidatePractice}?role=${encodeURIComponent(item.role)}&round=${encodeURIComponent(item.roundType)}&difficulty=${encodeURIComponent(item.difficulty || "Medium")}&language=${encodeURIComponent(item.languageUsed || "javascript")}`}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-amber-400 text-zinc-400 transition cursor-pointer"
                            title="Replay Session"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </SafeLink>
                        )}

                        {/* Export Markdown / JSON options */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:bg-zinc-800 hover:text-white text-zinc-400 cursor-pointer"
                          title="Download Markdown Report"
                          onClick={() => handleDownloadReport(item, "md")}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        
                        {/* JSON Developer Export */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:bg-zinc-800 hover:text-white text-zinc-400 font-mono text-[10px] cursor-pointer"
                          title="Export Developer JSON"
                          onClick={() => handleDownloadReport(item, "json")}
                        >
                          {"{ }"}
                        </Button>

                        {/* Details URL routing */}
                        <SafeLink
                          href={`${Routes.candidateSubmission(item.type === "Compiler Sandbox" ? `sandbox-${item.id}` : item.id)}?type=${encodeURIComponent(item.type)}`}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary-foreground hover:bg-primary px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 transition font-bold"
                        >
                          View Details
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </SafeLink>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-zinc-850/50 mt-6 text-zinc-400">
              <span className="text-xs">
                Page <span className="text-white font-semibold">{currentPage}</span> of <span className="text-white font-semibold">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-800 hover:bg-zinc-800 text-xs h-8 cursor-pointer"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-800 hover:bg-zinc-800 text-xs h-8 cursor-pointer"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
