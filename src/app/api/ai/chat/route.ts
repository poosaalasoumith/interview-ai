import { AIService } from "@/lib/ai/AIService";

export async function POST(req: Request) {
  return await AIService.streamChat(req);
}

