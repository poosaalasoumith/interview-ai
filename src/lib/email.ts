import { createClient } from "@/utils/supabase/server";

// Dynamic import or check for Resend to prevent crashes
let ResendClass: any = null;
try {
  const resendPkg = require("resend");
  ResendClass = resendPkg.Resend;
} catch (e) {
  console.log("[Email Util] Resend package not fully loaded, fallback active.");
}

interface InvitationEmailPayload {
  toEmail: string;
  candidateName?: string;
  interviewTitle: string;
  rolePosition: string;
  interviewType: string;
  difficultyLevel: string;
  scheduledAtStr: string;
  timezone: string;
  durationMinutes: number;
  notes?: string;
  joinLink: string;
}

export async function sendInterviewInvitation(payload: InvitationEmailPayload) {
  const {
    toEmail,
    candidateName,
    interviewTitle,
    rolePosition,
    interviewType,
    difficultyLevel,
    scheduledAtStr,
    timezone,
    durationMinutes,
    notes,
    joinLink,
  } = payload;

  const candidateDisplayName = candidateName || toEmail.split("@")[0];
  const subject = `Invitation: Technical Coding Interview for ${rolePosition} - InterviewAI`;

  // Create highly polished HTML template matching InterviewAI dark theme
  const bodyHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Technical Interview Invitation</title>
      <style>
        body {
          background-color: #09090b;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #18181b;
          border: 1px solid #27272a;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
        }
        .header {
          background: linear-gradient(135deg, #09090b 0%, #1c1917 100%);
          padding: 32px;
          text-align: center;
          border-b: 1px solid #27272a;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.05em;
          color: #ffffff;
        }
        .logo span {
          color: #a855f7; /* Violet theme */
        }
        .content {
          padding: 32px;
        }
        h2 {
          font-size: 20px;
          font-weight: 700;
          margin-top: 0;
          color: #ffffff;
        }
        p {
          color: #a1a1aa;
          font-size: 15px;
          line-height: 1.6;
        }
        .details-box {
          background-color: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
        }
        .detail-row {
          display: flex;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .detail-row:last-child {
          margin-bottom: 0;
        }
        .detail-label {
          width: 120px;
          color: #71717a;
          font-weight: 600;
        }
        .detail-value {
          color: #e4e4e7;
          flex-1: 1;
        }
        .btn-container {
          text-align: center;
          margin: 32px 0 16px 0;
        }
        .btn {
          background-color: #a855f7;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 32px;
          font-size: 15px;
          font-weight: 600;
          border-radius: 6px;
          display: inline-block;
          box-shadow: 0 4px 6px -1px rgba(168, 85, 247, 0.2);
        }
        .btn:hover {
          background-color: #9333ea;
        }
        .footer {
          background-color: #09090b;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #27272a;
          font-size: 12px;
          color: #52525b;
        }
        .footer a {
          color: #71717a;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Interview<span>AI</span></div>
        </div>
        <div class="content">
          <h2>Technical Interview Scheduled</h2>
          <p>Hi ${candidateDisplayName},</p>
          <p>You have been invited to a live technical coding interview on <strong>InterviewAI</strong>. Below are your scheduling details and access information:</p>
          
          <div class="details-box">
            <div class="detail-row">
              <div class="detail-label">Interview Title:</div>
              <div class="detail-value">${interviewTitle}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Position / Role:</div>
              <div class="detail-value">${rolePosition}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Round Type:</div>
              <div class="detail-value">${interviewType} (${difficultyLevel})</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Scheduled Time:</div>
              <div class="detail-value">${scheduledAtStr} (${timezone})</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Duration:</div>
              <div class="detail-value">${durationMinutes} minutes</div>
            </div>
            ${notes ? `
            <div class="detail-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #27272a;">
              <div class="detail-label">Instructions:</div>
              <div class="detail-value" style="font-style: italic; color: #a1a1aa;">${notes}</div>
            </div>
            ` : ""}
          </div>
          
          <p>To join the live technical round (which features peer-to-peer coding, video/audio conferencing, and real-time AI summaries), click the link below to accept the invite and access your dashboard lobby:</p>
          
          <div class="btn-container">
            <a href="${joinLink}" class="btn" target="_blank">Accept & Join Lobby</a>
          </div>
          
          <p style="font-size: 13px; color: #71717a; margin-top: 24px;">
            Note: If you do not have an account registered on this platform, the button will guide you to our secure signup page to auto-link your interview. Please sign up using your email: <strong>${toEmail}</strong>.
          </p>
        </div>
        <div class="footer">
          &copy; 2026 InterviewAI Corp. All rights reserved.<br>
          <a href="#">Security Policy</a> &bull; <a href="#">Candidate Guide</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Always log to Supabase email_logs (so it can be reviewed in the Simulated Inbox)
  try {
    const supabase = await createClient();
    const { error: logError } = await supabase
      .from("email_logs")
      .insert([
        {
          to_email: toEmail,
          subject,
          body_html: bodyHtml,
        }
      ]);
    if (logError) {
      console.error("[Email Util] Error logging email to Supabase:", logError.message);
    }
  } catch (err) {
    console.error("[Email Util] Exception logging email to database:", err);
  }

  // Attempt real email sending if key is configured
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && ResendClass) {
    try {
      console.log(`[Email Util] Sending real email to ${toEmail} using Resend...`);
      const resend = new ResendClass(apiKey);
      const res = await resend.emails.send({
        from: "InterviewAI <onboarding@resend.dev>", // Resend sandbox fallback
        to: toEmail,
        subject,
        html: bodyHtml,
      });
      console.log("[Email Util] Resend API Response:", res);
      return { success: true, logged: true, resend: true };
    } catch (sendError: any) {
      console.error("[Email Util] Resend failed to send email:", sendError.message);
      return { success: true, logged: true, resend: false, error: sendError.message };
    }
  }

  console.log(`[Email Util] Simulated Email Sent to: ${toEmail}. Logged to Supabase email_logs.`);
  return { success: true, logged: true, resend: false };
}
