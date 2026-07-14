import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { RoutesConfig } from "@/lib/routes";

export async function GET() {
  const appDir = path.join(process.cwd(), "src", "app");
  
  if (!fs.existsSync(appDir)) {
    return NextResponse.json(
      { status: "unhealthy", error: "App folder structure not found on filesystem." },
      { status: 500 }
    );
  }

  const reports: Record<string, { exists: boolean; filePath: string }> = {};
  let overallHealthy = true;

  // Scan RoutesConfig and check if corresponding files exist
  for (const [key, routePath] of Object.entries(RoutesConfig)) {
    // Determine the expected filesystem page path
    // We need to account for possible route groups, e.g. (auth)
    const found = false;
    const checkedPaths: string[] = [];

    // Let's build candidate paths by checking standard directories
    // We'll walk src/app looking for page.tsx files that match this path when route groups are removed
    const targetSegments = routePath.split("/").filter(Boolean);

    function findMatchingPage(dir: string, currentSegments: string[]): string | null {
      // If we've matched all segments, check if page.tsx exists here
      if (currentSegments.length === 0) {
        const pagePath = path.join(dir, "page.tsx");
        if (fs.existsSync(pagePath)) {
          return pagePath;
        }
        return null;
      }

      const nextSegment = currentSegments[0];
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullItemPath = path.join(dir, item);
        if (fs.statSync(fullItemPath).isDirectory()) {
          // If it is a route group like (auth), traverse into it without consuming a segment
          if (item.startsWith("(") && item.endsWith(")")) {
            const matched = findMatchingPage(fullItemPath, currentSegments);
            if (matched) return matched;
          }
          // If the directory name matches the segment exactly (e.g. "dashboard")
          else if (item === nextSegment) {
            const matched = findMatchingPage(fullItemPath, currentSegments.slice(1));
            if (matched) return matched;
          }
        }
      }
      return null;
    }

    const matchedFile = findMatchingPage(appDir, targetSegments);
    if (matchedFile) {
      reports[routePath] = {
        exists: true,
        filePath: path.relative(process.cwd(), matchedFile).replace(/\\/g, "/"),
      };
    } else {
      overallHealthy = false;
      reports[routePath] = {
        exists: false,
        filePath: `Missing page file matching path ${routePath}`,
      };
    }
  }

  return NextResponse.json({
    status: overallHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    routesReport: reports,
  });
}
