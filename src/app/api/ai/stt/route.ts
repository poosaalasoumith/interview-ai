import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const base64Audio = buffer.toString("base64");

    // Transcribe audio using Gemini multimodal input
    const { text } = await generateText({
      model: google("models/gemini-2.5-flash") as any,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please transcribe this audio recording exactly. Provide only the transcription, nothing else. If there is no speaking or only noise, return an empty string."
            },
            {
              type: "file",
              data: base64Audio,
              mimeType: audioFile.type || "audio/webm"
            }
          ]
        }
      ]
    } as any);

    return NextResponse.json({ transcript: text.trim() });
  } catch (e: any) {
    console.error("[STT Fallback API] Failed to transcribe:", e);
    return NextResponse.json({ error: e.message || "Failed to transcribe audio" }, { status: 500 });
  }
}
