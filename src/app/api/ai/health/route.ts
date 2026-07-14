import { NextResponse } from "next/server";
import { AIService } from "@/lib/ai/AIService";

export async function GET() {
  try {
    const provider = AIService.getProvider();
    const health = await provider.checkHealth();

    return NextResponse.json({
      provider: provider.name,
      status: health.status,
      latency: `${health.latencyMs}ms`,
      quotaRemaining: "Unlimited / Dynamic",
      streaming: true,
      ...(health.error ? { error: health.error } : {})
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        provider: "Unknown",
        status: "unhealthy",
        error: err.message || "Failed to query provider health"
      },
      { status: 500 }
    );
  }
}
