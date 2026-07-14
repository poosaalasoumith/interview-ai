'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { sendInterviewInvitation } from "@/lib/email";
import { isSessionFinalized } from "@/utils/interview-utils";
import crypto from "crypto";

export async function getCandidates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, avatar")
    .eq("role", "candidate");

  if (error) {
    console.error("[Interviews Action] Error fetching candidates:", error.message);
    return [];
  }
  return data || [];
}

export async function deriveInterviewState(interview: any, durationMinutes: number = 60): Promise<string> {
  const now = new Date();

  // ──────────────────────────────────────────────────────────────────────────
  // PRIORITY 0: Permanently finalized session_status values.
  // Once the DB session_status is any terminal state, honour it unconditionally
  // regardless of actual_started_at or any other field.  This is the single
  // authoritative gate that prevents any re-entry / state reset.
  // ──────────────────────────────────────────────────────────────────────────
  if (isSessionFinalized(interview.session_status)) {
    // Normalise cancelled/canceled to a single canonical value
    if (interview.session_status === "cancelled" || interview.session_status === "canceled") {
      return "cancelled";
    }
    return interview.session_status;
  }

  // 1. Legacy status field fallback
  if (interview.status === "cancelled") {
    return "cancelled";
  }

  // 2. If actual_started_at is set (candidate joined the room)
  if (interview.actual_started_at) {
    const startedAt = new Date(interview.actual_started_at);
    const timeExtended = interview.time_extended_minutes || 0;
    const totalDuration = durationMinutes + timeExtended;
    const expiresAt = interview.expires_at 
      ? new Date(interview.expires_at) 
      : new Date(startedAt.getTime() + totalDuration * 60 * 1000);
    
    // Check if expired
    if (now.getTime() > expiresAt.getTime()) {
      return "expired";
    }

    // Check if completed via terminal fields
    if (interview.status === "completed" || interview.ended_at || interview.actual_ended_at) {
      return interview.session_status === "submitted" ? "submitted" : "completed";
    }

    return "active";
  }

  // 3. If actual_started_at is NOT set (candidate never joined)
  const scheduledTime = new Date(interview.scheduled_at).getTime();
  const joinDeadline = scheduledTime + 15 * 60 * 1000; // 15 mins window

  if (now.getTime() > joinDeadline) {
    return "missed";
  }

  // Waiting window: 15 minutes before scheduled time until 15 minutes after (or until join deadline)
  const waitingStart = scheduledTime - 15 * 60 * 1000;
  if (now.getTime() >= waitingStart && now.getTime() <= joinDeadline) {
    return "waiting";
  }

  return "scheduled";
}

export async function syncAllStaleInterviews() {
  const supabase = await createClient();
  
  // Fetch all interviews to check if their state needs syncing
  const { data: interviews, error } = await supabase
    .from("interviews")
    .select(`
      *,
      interview_sessions(duration_minutes)
    `)
    .not("session_status", "in", '("completed","submitted","expired","terminated","cancelled","canceled")');

  if (error || !interviews) {
    return;
  }

  const nowStr = new Date().toISOString();

  for (const interview of interviews) {
    const session = Array.isArray(interview.interview_sessions)
      ? interview.interview_sessions[0]
      : interview.interview_sessions;
    const duration = session?.duration_minutes || 60;
    
    const derived = await deriveInterviewState(interview, duration);

    // If derived status is different from DB's session_status, update it!
    if (derived !== interview.session_status) {
      console.log(`[Lifecycle Sync] Auto-transitioning interview ${interview.id} from ${interview.session_status} to ${derived}`);
      
      const updatePayload: any = {
        session_status: derived
      };

      // Ensure status is aligned
      if (derived === "missed") {
        updatePayload.status = "completed";
        updatePayload.ended_at = new Date(new Date(interview.scheduled_at).getTime() + 15 * 60 * 1000).toISOString();
        updatePayload.expiration_reason = "Candidate failed to join";
        updatePayload.status_message = "Candidate missed the 15-minute scheduled join window.";
      } else if (derived === "expired") {
        updatePayload.status = "completed";
        const startedAt = new Date(interview.actual_started_at || interview.created_at).getTime();
        const totalDuration = duration + (interview.time_extended_minutes || 0);
        const expiresAtStr = interview.expires_at || new Date(startedAt + totalDuration * 60 * 1000).toISOString();
        updatePayload.ended_at = expiresAtStr;
        updatePayload.actual_ended_at = expiresAtStr;
        updatePayload.expires_at = expiresAtStr;
        updatePayload.expiration_reason = "Session duration elapsed";
        updatePayload.status_message = "Assessment session auto-expired.";
      } else if (derived === "completed" || derived === "submitted" || derived === "terminated") {
        updatePayload.status = "completed";
        if (!interview.ended_at && !interview.actual_ended_at) {
          updatePayload.ended_at = nowStr;
          updatePayload.actual_ended_at = nowStr;
        }
        if (derived === "terminated") {
          updatePayload.expiration_reason = "Admin terminated session";
          updatePayload.status_message = "Proctor forcefully terminated the session.";
        } else if (derived === "completed" && !interview.expiration_reason) {
          updatePayload.expiration_reason = "Interview completed successfully";
          updatePayload.status_message = "Interview completed successfully.";
        } else if (derived === "submitted" && !interview.expiration_reason) {
          updatePayload.expiration_reason = "Interview completed successfully";
          updatePayload.status_message = "Assessment auto-submitted on session expiration";
        }
      } else if (derived === "cancelled") {
        updatePayload.status = "cancelled";
        updatePayload.session_status = "cancelled";
        if (!interview.ended_at) {
          updatePayload.ended_at = nowStr;
        }
        updatePayload.expiration_reason = "Interviewer canceled interview";
      } else if (derived === "active") {
        updatePayload.status = "in_progress";
      } else if (derived === "scheduled" || derived === "waiting") {
        updatePayload.status = "scheduled";
      }

      await supabase
        .from("interviews")
        .update(updatePayload)
        .eq("id", interview.id);
    }
  }
}

export async function getInterviews() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Automatically sync stale/expired interviews before retrieving
  try {
    await syncAllStaleInterviews();
  } catch (e) {
    console.error("[Interviews Action] Stale lifecycle sync exception:", e);
  }

  // Get user role
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile) return [];

  let query = supabase.from("interviews").select(`
    *,
    candidate:candidate_id(id, name, email, avatar),
    interviewer:interviewer_id(id, name, email, avatar)
  `);

  if (userProfile.role === "candidate") {
    query = query.eq("candidate_id", user.id);
  } else if (userProfile.role === "interviewer") {
    query = query.eq("interviewer_id", user.id);
  }

  const { data, error } = await query.order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[Interviews Action] Error fetching interviews:", error.message);
    return [];
  }
  return data || [];
}

export async function scheduleInterview(payload: {
  title: string;
  candidateId: string;
  scheduledAt: string;
  problemStatement?: any;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // Ensure user is an interviewer or admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile || (userProfile.role !== "interviewer" && userProfile.role !== "admin")) {
    return { error: "Unauthorized: Only interviewers can schedule sessions." };
  }

  // Insert interview
  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .insert([
      {
        title: payload.title,
        interviewer_id: user.id,
        candidate_id: payload.candidateId,
        status: "scheduled",
        scheduled_at: payload.scheduledAt,
        problem_statement: payload.problemStatement || {
          title: "Two Sum",
          difficulty: "Easy",
          description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
          examples: [
            {
              input: "nums = [2,7,11,15], target = 9",
              output: "[0,1]",
              explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
            }
          ],
          constraints: [
            "2 <= nums.length <= 104",
            "-109 <= nums[i] <= 109",
            "-109 <= target <= 109",
            "Only one valid answer exists."
          ]
        }
      }
    ])
    .select()
    .single();

  if (interviewError || !interview) {
    console.error("[Interviews Action] Error scheduling interview:", interviewError);
    return { error: interviewError?.message || "Failed to create interview." };
  }

  // Insert corresponding interview_sessions record
  const { error: sessionError } = await supabase
    .from("interview_sessions")
    .insert([
      {
        interview_id: interview.id,
        room_id: interview.id // Use the interview UUID as the LiveKit room ID
      }
    ]);

  if (sessionError) {
    console.error("[Interviews Action] Warning: Failed to create interview session:", sessionError.message);
    // Do not fail the whole transaction as we can fallback or auto-create it, but it's good to keep in sync.
  }

  revalidatePath("/dashboard", "layout");
  return { success: true, interview };
}

export async function cancelInterview(interviewId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized." };
  }

  // Perform logical cancellation instead of hard delete to preserve audit history
  const { error } = await supabase
    .from("interviews")
    .update({
      status: "cancelled",
      session_status: "cancelled",
      ended_at: new Date().toISOString(),
      completed_by: user.id,
      expiration_reason: "Interviewer canceled interview",
      status_message: "Technical assessment was cancelled by the proctor"
    })
    .eq("id", interviewId);

  if (error) {
    console.error("[Interviews Action] Error cancelling interview:", error.message);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function endInterviewAndGenerateReport(interviewId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // 1. Fetch the interview details
  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("*, candidate:candidate_id(name, email)")
    .eq("id", interviewId)
    .single();

  if (interviewError || !interview) {
    return { error: "Interview not found." };
  }

  // 2. Fetch all code submissions for this interview
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  // 3. Make a request to the local AI summary endpoint to generate evaluation
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let aiReport = null;

  try {
    const aiResponse = await fetch(`${origin}/api/ai/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemStatement: interview.problem_statement,
        submissions: submissions || [],
        chatHistory: [] // chat history is local to component
      })
    });

    if (aiResponse.ok) {
      aiReport = await aiResponse.json();
    } else {
      console.error("[Interviews Action] AI Summary generation HTTP error:", aiResponse.statusText);
    }
  } catch (err) {
    console.error("[Interviews Action] AI Summary generation network error:", err);
  }

  // 3.5. Fetch existing feedback to preserve comments and prior AI feedback if new evaluation fails
  const { data: existingFeedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("interview_id", interviewId)
    .maybeSingle();

  // Determine the report to save, preserving prior successful AI analysis if present
  let report = aiReport;
  if (!report) {
    if (existingFeedback?.ai_feedback) {
      try {
        const parsed = JSON.parse(existingFeedback.ai_feedback);
        report = {
          technicalScore: parsed.technicalScore ?? parsed.technical_score ?? existingFeedback.technical_score ?? 75,
          communicationScore: parsed.communicationScore ?? parsed.communication_score ?? existingFeedback.communication_score ?? 80,
          overallScore: parsed.overallScore ?? parsed.overall_score ?? existingFeedback.overall_score ?? 78,
          summary: parsed.summary ?? existingFeedback.ai_feedback,
          strengths: parsed.strengths ?? ["Completed the exercise"],
          weaknesses: parsed.weaknesses ?? ["Needs improvement in time complexity optimizations"],
          recommendation: parsed.recommendation ?? "Hire"
        };
        console.log("[Interviews Action] Preserved and reused existing AI feedback.");
      } catch (e) {
        report = {
          technicalScore: existingFeedback.technical_score ?? 75,
          communicationScore: existingFeedback.communication_score ?? 80,
          overall_score: existingFeedback.overall_score ?? 78,
          summary: existingFeedback.ai_feedback,
          strengths: ["Completed the exercise"],
          weaknesses: ["Needs improvement in time complexity optimizations"],
          recommendation: "Hire"
        };
      }
    } else {
      // Standard fallback
      report = {
        technicalScore: 75,
        communicationScore: 80,
        overallScore: 78,
        summary: "The candidate completed the coding exercise. See their code submissions for technical details.",
        strengths: ["Completed the exercise", "Demonstrated basic problem-solving"],
        weaknesses: ["Needs improvement in time complexity optimizations"],
        recommendation: "Hire"
      };
    }
  }

  // 4. Save to feedback table using upsert to prevent unique key constraint violations
  const { error: feedbackError } = await supabase
    .from("feedback")
    .upsert({
      interview_id: interviewId,
      candidate_id: interview.candidate_id,
      interviewer_id: interview.interviewer_id,
      technical_score: report.technicalScore,
      communication_score: report.communicationScore,
      overall_score: report.overallScore,
      ai_feedback: typeof report === "string" ? report : JSON.stringify(report),
      interviewer_comments: existingFeedback?.interviewer_comments || null
    }, {
      onConflict: "interview_id"
    });

  if (feedbackError) {
    console.error("[Interviews Action] Error saving feedback:", feedbackError.message);
    return { error: `Failed to save feedback: ${feedbackError.message}` };
  }

  // 5. Update interview status AND session_status to completed to trigger real-time UI transitions smoothly
  const { error: updateError } = await supabase
    .from("interviews")
    .update({ 
      status: "completed",
      session_status: "completed",
      actual_ended_at: new Date().toISOString()
    })
    .eq("id", interviewId);

  if (updateError) {
    console.error("[Interviews Action] Error updating status:", updateError.message);
  }

  revalidatePath("/dashboard", "layout");
  return { success: true, report };
}

export async function scheduleMultiCandidateInterview(payload: {
  title: string;
  rolePosition: string;
  interviewType: string;
  difficultyLevel: string;
  scheduledAt: string;
  timezone: string;
  durationMinutes: number;
  notes?: string;
  candidateEmails: string[];
  assessmentSource?: string;
  assessmentTemplateId?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // Ensure user is an interviewer or admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile || (userProfile.role !== "interviewer" && userProfile.role !== "admin")) {
    return { error: "Unauthorized: Only interviewers can schedule sessions." };
  }

  const {
    title,
    rolePosition,
    interviewType,
    difficultyLevel,
    scheduledAt,
    timezone,
    durationMinutes,
    notes,
    candidateEmails,
    assessmentSource,
    assessmentTemplateId,
  } = payload;

  if (!candidateEmails || candidateEmails.length === 0) {
    return { error: "At least one candidate email is required." };
  }

  // Select appropriate problem statement based on difficulty
  let problemStatement = {
    title: "Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ]
  };

  if (difficultyLevel === "Medium") {
    problemStatement = {
      title: "Longest Substring Without Repeating Characters",
      difficulty: "Medium",
      description: "Given a string `s`, find the length of the longest substring without repeating characters.",
      examples: [
        {
          input: 's = "abcabcbb"',
          output: "3",
          explanation: 'The answer is "abc", with the length of 3.'
        }
      ],
      constraints: [
        "0 <= s.length <= 5 * 10^4",
        "s consists of English letters, digits, symbols and spaces."
      ]
    };
  } else if (difficultyLevel === "Hard") {
    problemStatement = {
      title: "Merge k Sorted Lists",
      difficulty: "Hard",
      description: "You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.",
      examples: [
        {
          input: "lists = [[1,4,5],[1,3,4],[2,6]]",
          output: "[1,1,2,3,4,4,5,6]",
          explanation: "The linked-lists are:\n[\n  1->4->5,\n  1->3->4,\n  2->6\n]\nmerging them into one sorted list:\n1->1->2->3->4->4->5->6"
        }
      ],
      constraints: [
        "k == lists.length",
        "0 <= k <= 10^4",
        "0 <= lists[i].length <= 500",
        "-10^4 <= lists[i][j] <= 10^4",
        "lists[i] is sorted in ascending order.",
        "The sum of lists[i].length will not exceed 10^4."
      ]
    };
  }

  // Use a master room ID reference
  const masterRoomId = `room-${Math.random().toString(36).substring(2, 10)}`;

  // 1. Insert into public.scheduled_interviews
  const { data: schedule, error: scheduleError } = await supabase
    .from("scheduled_interviews")
    .insert([
      {
        title,
        role_position: rolePosition,
        interview_type: interviewType,
        difficulty_level: difficultyLevel,
        interviewer_id: user.id,
        scheduled_at: scheduledAt,
        timezone,
        duration_minutes: durationMinutes,
        notes,
        room_id: masterRoomId,
        status: "scheduled",
        problem_statement: assessmentSource === "uploaded" ? null : problemStatement,
        assessment_source: assessmentSource || 'ai_generated',
        assessment_template_id: assessmentTemplateId || null,
      }
    ])
    .select()
    .single();

  if (scheduleError || !schedule) {
    console.error("[Interviews Action] Error creating schedule:", scheduleError);
    return { error: scheduleError?.message || "Failed to create scheduled interview." };
  }

  // 2. Loop through each candidate email
  const results = [];
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const email of candidateEmails) {
    const lowerEmail = email.toLowerCase().trim();
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, name")
      .eq("email", lowerEmail)
      .eq("role", "candidate")
      .maybeSingle();

    if (existingUser) {
      // Create Candidate Assignment
      const { error: assignError } = await supabase
        .from("candidate_assignments")
        .insert([
          {
            scheduled_interview_id: schedule.id,
            candidate_id: existingUser.id,
            status: "accepted"
          }
        ]);

      if (assignError) {
        console.error(`[Interviews Action] Error assigning existing candidate ${email}:`, assignError.message);
      }

      // Create isolated interview room for this candidate
      const newInterviewId = crypto.randomUUID();
      const { error: intError } = await supabase
        .from("interviews")
        .insert([
          {
            id: newInterviewId,
            title,
            interviewer_id: user.id,
            candidate_id: existingUser.id,
            status: "scheduled",
            problem_statement: assessmentSource === "uploaded" ? null : problemStatement,
            scheduled_at: scheduledAt,
            assessment_source: assessmentSource || 'ai_generated',
            assessment_template_id: assessmentTemplateId || null,
          }
        ]);

      if (intError) {
        console.error(`[Interviews Action] Error creating interview room for ${email}:`, intError.message);
      } else {
        // Create session
        await supabase
          .from("interview_sessions")
          .insert([
            {
              interview_id: newInterviewId,
              room_id: newInterviewId,
              duration_minutes: durationMinutes
            }
          ]);
      }

      // Send email inviting them to log in
      const joinLink = `${origin}/dashboard/candidate`;
      await sendInterviewInvitation({
        toEmail: lowerEmail,
        candidateName: existingUser.name || undefined,
        interviewTitle: title,
        rolePosition,
        interviewType,
        difficultyLevel,
        scheduledAtStr: new Date(scheduledAt).toLocaleString("en-US", { timeZone: timezone }),
        timezone,
        durationMinutes,
        notes,
        joinLink,
      });

      results.push({ email, type: "existing", status: "assigned" });
    } else {
      // Invite new user
      const inviteToken = crypto.randomUUID();
      const { error: inviteError } = await supabase
        .from("interview_invitations")
        .insert([
          {
            scheduled_interview_id: schedule.id,
            email: lowerEmail,
            token: inviteToken,
            status: "pending"
          }
        ]);

      if (inviteError) {
        console.error(`[Interviews Action] Error creating invitation for ${email}:`, inviteError.message);
      }

      // Send email containing the registration link prefilled with email & token
      const joinLink = `${origin}/signup?token=${inviteToken}&email=${encodeURIComponent(lowerEmail)}`;
      await sendInterviewInvitation({
        toEmail: lowerEmail,
        interviewTitle: title,
        rolePosition,
        interviewType,
        difficultyLevel,
        scheduledAtStr: new Date(scheduledAt).toLocaleString("en-US", { timeZone: timezone }),
        timezone,
        durationMinutes,
        notes,
        joinLink,
      });

      results.push({ email, type: "new", status: "invited" });
    }
  }

  // 3. Track Status
  await supabase
    .from("interview_status_tracking")
    .insert([
      {
        scheduled_interview_id: schedule.id,
        status: "scheduled",
        changed_by: user.id,
        notes: `Created multi-candidate scheduled interview with ${candidateEmails.length} candidates.`,
      }
    ]);

  revalidatePath("/dashboard", "layout");
  return { success: true, schedule, results };
}

export async function getScheduledInterviews() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Automatically sync stale/expired interviews before retrieving
  try {
    await syncAllStaleInterviews();
  } catch (e) {
    console.error("[Interviews Action] Stale lifecycle sync exception in scheduled:", e);
  }

  // Get user role
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile) return [];

  let query = supabase.from("scheduled_interviews").select(`
    *,
    interviewer:interviewer_id(id, name, email, avatar),
    candidate_assignments:candidate_assignments(
      id,
      status,
      candidate:candidate_id(id, name, email, avatar)
    ),
    interview_invitations:interview_invitations(
      id,
      email,
      status,
      token,
      accepted_at
    )
  `);

  if (userProfile.role === "interviewer") {
    query = query.eq("interviewer_id", user.id);
  } else if (userProfile.role !== "admin") {
    // Candidates should not read this table directly
    return [];
  }

  const { data, error } = await query.order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[Interviews Action] Error fetching scheduled interviews:", error.message);
    return [];
  }

  return data || [];
}

export async function cancelScheduledInterview(scheduleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // Get schedule details first to find the scheduled time & interviewer
  const { data: schedule, error: fetchError } = await supabase
    .from("scheduled_interviews")
    .select("interviewer_id, scheduled_at, title")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    return { error: "Scheduled interview not found." };
  }

  // Ensure user is authorized (interviewer or admin)
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile || (user.id !== schedule.interviewer_id && userProfile.role !== "admin")) {
    return { error: "Unauthorized: Only the scheduling interviewer or an admin can cancel this session." };
  }

  // Get candidate_assignments to find candidate IDs
  const { data: assignments } = await supabase
    .from("candidate_assignments")
    .select("candidate_id")
    .eq("scheduled_interview_id", scheduleId);

  const candidateIds = assignments?.map((a) => a.candidate_id) || [];

  // Log status change before deletion
  await supabase
    .from("interview_status_tracking")
    .insert([
      {
        scheduled_interview_id: scheduleId,
        status: "cancelled",
        changed_by: user.id,
        notes: "Interviewer cancelled the scheduled interview session.",
      }
    ]);

  // Clean up standard interviews rooms logically instead of hard delete
  if (candidateIds.length > 0) {
    const { error: deleteRoomsError } = await supabase
      .from("interviews")
      .update({
        status: "cancelled",
        session_status: "cancelled",
        ended_at: new Date().toISOString(),
        completed_by: user.id,
        expiration_reason: "Interviewer canceled interview",
        status_message: "Interviewer cancelled the scheduled interview session."
      })
      .eq("interviewer_id", schedule.interviewer_id)
      .eq("status", "scheduled")
      .eq("scheduled_at", schedule.scheduled_at)
      .in("candidate_id", candidateIds);

    if (deleteRoomsError) {
      console.error("[Interviews Action] Warning: Error logically cancelling active interview rooms:", deleteRoomsError.message);
    }
  }

  // Delete the master schedule (cascade deletes assignments/invites)
  const { error: deleteScheduleError } = await supabase
    .from("scheduled_interviews")
    .delete()
    .eq("id", scheduleId);

  if (deleteScheduleError) {
    console.error("[Interviews Action] Error deleting schedule:", deleteScheduleError.message);
    return { error: deleteScheduleError.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function getSimulatedEmails() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Ensure user is interviewer or admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile || (userProfile.role !== "interviewer" && userProfile.role !== "admin")) {
    return [];
  }

  const { data, error } = await supabase
    .from("email_logs")
    .select("*")
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[Interviews Action] Error fetching simulated emails:", error.message);
    return [];
  }

  return data || [];
}

export async function initializeInterviewSession(roomId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // Fetch current interview details
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError || !interview) {
    return { error: "Interview not found." };
  }

  // FINALIZATION GUARD: Permanently block re-initialization of finalized sessions
  if (isSessionFinalized(interview.session_status)) {
    return { error: "This interview session has been permanently finalized and cannot be restarted." };
  }

  // Fetch the user's role to determine if they are the candidate
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isUserCandidate = profile?.role === "candidate";

  // Only allow candidate to initialize the countdown for the first time
  if (!interview.actual_started_at && !isUserCandidate) {
    return { error: "Moderators are not authorized to initialize the assessment countdown timer." };
  }

  // If actual_started_at is already set, do not override
  if (interview.actual_started_at) {
    return { success: true, interview };
  }

  const nowStr = new Date().toISOString();
  
  // Calculate if joined late (after scheduled_at)
  const scheduledTime = new Date(interview.scheduled_at).getTime();
  const nowTime = Date.now();
  const isLate = nowTime > scheduledTime;
  const sessionStatus = isLate ? "late_joined" : "active";

  // Fetch session duration to persist expires_at
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("duration_minutes")
    .eq("interview_id", roomId)
    .maybeSingle();

  const duration = session?.duration_minutes || 60;
  const expiresAtStr = new Date(Date.now() + duration * 60 * 1000).toISOString();

  const { data: updatedInterview, error: updateError } = await supabase
    .from("interviews")
    .update({
      actual_started_at: nowStr,
      candidate_joined_at: nowStr,
      session_status: sessionStatus,
      status: "in_progress", // Set status to in_progress instantly
      expires_at: expiresAtStr,
      remaining_seconds: duration * 60,
      join_deadline_at: new Date(scheduledTime + 15 * 60 * 1000).toISOString()
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("[Interviews Action] Error initializing session:", updateError.message);
    return { error: updateError.message };
  }

  // Insert a telemetry event
  await supabase
    .from("interview_telemetry")
    .insert([
      {
        interview_id: roomId,
        event_type: "session_initialized",
        details: {
          timestamp: nowStr,
          status: sessionStatus,
          joined_at: nowStr
        }
      }
    ]);

  revalidatePath(`/interview/${roomId}`, "layout");
  return { success: true, interview: updatedInterview };
}

export async function extendInterviewSessionTime(roomId: string, minutes: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // 1. Fetch the interview details
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("*, interviewer_id")
    .eq("id", roomId)
    .single();

  if (fetchError || !interview) {
    return { error: "Interview not found." };
  }

  // Ensure user is authorized (interviewer or admin)
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile || (user.id !== interview.interviewer_id && userProfile.role !== "admin")) {
    return { error: "Unauthorized: Only the proctor or an admin can extend time." };
  }

  const newExtendedMinutes = (interview.time_extended_minutes || 0) + minutes;

  // Calculate new actual_ended_at if actual_started_at exists
  const updatePayload: any = {
    time_extended_minutes: newExtendedMinutes
  };

  if (interview.actual_started_at) {
    // Read the duration_minutes from interview_sessions or fallback to a standard duration e.g. 60 min
    const { data: session } = await supabase
      .from("interview_sessions")
      .select("duration_minutes")
      .eq("interview_id", roomId)
      .maybeSingle();

    const duration = session?.duration_minutes || 60;
    const start = new Date(interview.actual_started_at).getTime();
    const newEnd = new Date(start + (duration + newExtendedMinutes) * 60 * 1000).toISOString();
    updatePayload.actual_ended_at = newEnd;
    updatePayload.expires_at = newEnd; // Sync database expires_at with extended time bounds!
  }

  const { data: updatedInterview, error: updateError } = await supabase
    .from("interviews")
    .update(updatePayload)
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("[Interviews Action] Error extending session time:", updateError.message);
    return { error: updateError.message };
  }

  // Insert a telemetry warning / event
  await supabase
    .from("interview_telemetry")
    .insert([
      {
        interview_id: roomId,
        event_type: "warning_issued",
        details: {
          timestamp: new Date().toISOString(),
          type: "time_extended",
          extended_by: user.id,
          added_minutes: minutes,
          total_extended_minutes: newExtendedMinutes,
          message: `Proctor has extended the interview duration by ${minutes} minutes.`
        }
      }
    ]);

  revalidatePath(`/interview/${roomId}`, "layout");
  return { success: true, interview: updatedInterview };
}

export async function terminateInterviewSessionAction(roomId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // 1. Fetch the interview details
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("*, interviewer_id")
    .eq("id", roomId)
    .single();

  if (fetchError || !interview) {
    return { error: "Interview not found." };
  }

  // Ensure user is authorized (interviewer or admin)
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userProfile || (user.id !== interview.interviewer_id && userProfile.role !== "admin")) {
    return { error: "Unauthorized: Only the proctor or an admin can terminate this session." };
  }

  const nowStr = new Date().toISOString();

  const { data: updatedInterview, error: updateError } = await supabase
    .from("interviews")
    .update({
      status: "completed", // Transition to completed
      session_status: "terminated",
      actual_ended_at: nowStr,
      ended_at: nowStr,
      completed_by: user.id,
      expiration_reason: "Admin terminated session",
      status_message: "Proctor forcefully terminated the session."
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("[Interviews Action] Error terminating session:", updateError.message);
    return { error: updateError.message };
  }

  // Insert a telemetry warning / event
  await supabase
    .from("interview_telemetry")
    .insert([
      {
        interview_id: roomId,
        event_type: "warning_issued",
        details: {
          timestamp: nowStr,
          type: "session_terminated",
          terminated_by: user.id,
          message: "Proctor has forcefully terminated the session."
        }
      }
    ]);

  revalidatePath(`/interview/${roomId}`, "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true, interview: updatedInterview };
}

export async function toggleLockSessionAction(roomId: string, isLock: boolean, reason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  // 1. Fetch the interview details
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("*, interviewer_id")
    .eq("id", roomId)
    .single();

  if (fetchError || !interview) {
    return { error: "Interview not found." };
  }

  // 2. Ensure user is authorized (interviewer or admin)
  const { data: userProfile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!userProfile || (user.id !== interview.interviewer_id && userProfile.role !== "admin")) {
    return { error: "Unauthorized: Only the proctor or an admin can modify lock status." };
  }

  const nowStr = new Date().toISOString();
  const moderatorName = userProfile.name || "System Moderator";

  // 3. Update the interviews table with the lock state
  const updateData: any = {
    is_locked: isLock,
    locked_by: isLock ? user.id : null,
    locked_at: isLock ? nowStr : null,
    unlock_at: isLock ? null : nowStr,
    lock_reason: isLock ? (reason || "Locked by moderator") : null
  };

  const { data: updatedInterview, error: updateError } = await supabase
    .from("interviews")
    .update(updateData)
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("[Interviews Action] Error updating lock status:", updateError.message);
    return { error: updateError.message };
  }

  // 4. Log the audit event in interview_telemetry
  const eventType = isLock ? "SESSION_LOCKED" : "SESSION_UNLOCKED";
  await supabase
    .from("interview_telemetry")
    .insert([
      {
        interview_id: roomId,
        event_type: eventType,
        details: {
          timestamp: nowStr,
          moderatorId: user.id,
          moderatorName: moderatorName,
          reason: reason || (isLock ? "Locked by moderator" : "Unlocked by moderator")
        }
      }
    ]);

  revalidatePath(`/interview/${roomId}`, "layout");
  revalidatePath("/dashboard", "layout");
  
  return { success: true, interview: updatedInterview };
}

export async function autoSubmitInterviewAction(roomId: string, code: string, language: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized: Please log in." };
  }

  const nowStr = new Date().toISOString();

  // Save the code to submissions
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert([
      {
        interview_id: roomId,
        user_id: user.id,
        code: code,
        language: language,
        output: "Auto-submitted on session expiration",
        status: "auto-submitted",
        execution_time: 0,
      }
    ])
    .select()
    .single();

  if (submissionError) {
    console.error("[Interviews Action] Error in autoSubmitInterviewAction (submission insert):", submissionError.message);
  }

  // Update interview status with enterprise audit reasons
  const { data: updatedInterview, error: updateError } = await supabase
    .from("interviews")
    .update({
      status: "completed", // Transition to completed history bounds
      session_status: "submitted",
      actual_ended_at: nowStr,
      ended_at: nowStr,
      completed_by: user.id,
      expiration_reason: "Session auto-expired",
      status_message: "Assessment auto-submitted on session expiration"
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("[Interviews Action] Error updating status in autoSubmitInterviewAction:", updateError.message);
    return { error: updateError.message };
  }

  // Trigger feedback report generation automatically in the background
  try {
    await endInterviewAndGenerateReport(roomId);
    console.log("[AutoSubmit] Feedback generated successfully in background on expiration.");
  } catch (e) {
    console.error("[AutoSubmit] Error generating feedback report in background on expiration:", e);
  }


  // Insert a telemetry event
  await supabase
    .from("interview_telemetry")
    .insert([
      {
        interview_id: roomId,
        event_type: "submission",
        details: {
          timestamp: nowStr,
          triggered_by: "auto_submit",
          submission_id: submission?.id
        }
      }
    ]);

  revalidatePath(`/interview/${roomId}`, "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true, interview: updatedInterview };
}
