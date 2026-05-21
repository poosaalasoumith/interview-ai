import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Clock, CheckCircle, XCircle, ChevronRight, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function SubmissionsHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's submissions
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("*, interviews(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex items-center gap-2">
          <Code2 className="w-8 h-8 text-primary" />
          Code Submissions History
        </h1>
        <p className="text-muted-foreground mt-1">
          Review all your compiled codes, sandboxed runs, and technical interview session executions.
        </p>
      </div>

      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Execution Logs</CardTitle>
          <CardDescription className="text-zinc-400">
            A comprehensive track record of your workspace submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submissions || submissions.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-850 flex items-center justify-center mx-auto border border-zinc-800">
                <Code2 className="w-6 h-6 text-zinc-550" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-300">No Submissions Recorded</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  You haven't run any compiler tasks yet. Head over to the Practice Code playground or participate in an interview to begin.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub: any) => {
                const date = new Date(sub.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });

                return (
                  <div
                    key={sub.id}
                    className="p-4.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="capitalize text-[10px] font-black tracking-wider bg-primary/10 text-primary border-primary/25">
                          {sub.language}
                        </Badge>
                        <span className="text-xs text-zinc-450 font-medium">
                          {date}
                        </span>
                        {sub.interviews?.title && (
                          <span className="text-xs text-zinc-550 flex items-center gap-1">
                            • Round: <span className="text-zinc-400 font-bold">{sub.interviews.title}</span>
                          </span>
                        )}
                      </div>

                      {/* Code Snippet Preview */}
                      <div className="font-mono text-xs text-zinc-350 bg-zinc-950/80 p-3 rounded border border-zinc-900 overflow-x-auto max-h-32 custom-scrollbar">
                        <pre>{sub.code}</pre>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-900">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {sub.status === "Success" || !sub.output?.includes("error") ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Success
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Run Error
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sub.execution_time ? `${(Number(sub.execution_time) * 1000).toFixed(0)}ms` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
