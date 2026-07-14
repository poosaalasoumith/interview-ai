import fs from "fs";
import path from "path";
import { RoutesConfig } from "./routes";

let hasRun = false;

export function runStartupValidation() {
  if (hasRun || process.env.NODE_ENV === "production") return;
  hasRun = true;

  console.log("\x1b[36m[Startup Validator] Checking routing architecture...\x1b[0m");

  const appDir = path.join(process.cwd(), "src", "app");
  if (!fs.existsSync(appDir)) return;

  // 1. Scan for page files and map them to actual routes
  const registeredPaths = new Set(Object.values(RoutesConfig));
  
  function walk(dir: string, filelist: string[] = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        if (file !== "node_modules" && file !== ".next" && file !== "api" && file !== "auth") {
          walk(filepath, filelist);
        }
      } else if (file === "page.tsx") {
        filelist.push(filepath);
      }
    }
    return filelist;
  }

  const pageFiles = walk(appDir);
  const actualRoutes = pageFiles.map((filepath) => {
    let relative = path.relative(appDir, filepath);
    relative = relative.replace(/\\/g, "/");
    const routePath = relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
    const segments = routePath.split("/").filter(Boolean);
    const cleanedSegments = segments.filter(seg => !seg.startsWith("(") || !seg.endsWith(")"));
    return "/" + cleanedSegments.join("/");
  });

  // Verify unregistered
  for (const route of actualRoutes) {
    if (!registeredPaths.has(route as any)) {
      console.warn(`\x1b[33m[Startup Warning] Missing Route Registration: Expected page at '${route}' to be registered in RoutesConfig, but it was missing.\x1b[0m`);
    }
  }

  // 2. Scan codebase for hardcoded routes to warn about
  const srcDir = path.join(process.cwd(), "src");
  const hardcodedPatterns = [
    /href=["']\/dashboard\/candidate\b[^"']*["']/g,
    /href=["']\/dashboard\/interviewer\b[^"']*["']/g,
    /href=["']\/dashboard\/admin\b[^"']*["']/g,
    /router\.push\(["']\/dashboard\b[^"']*["']\)/g,
    /redirect\(["']\/dashboard\b[^"']*["']\)/g,
  ];

  function scanFiles(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        if (file !== "node_modules" && file !== ".next") {
          scanFiles(filepath);
        }
      } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        // Skip routes.ts, startup-validator.ts, navigation.ts, and validate-routes.js
        if (file === "routes.ts" || file === "startup-validator.ts" || file === "navigation.ts" || file === "validate-routes.js") continue;
        const content = fs.readFileSync(filepath, "utf8");
        for (const pattern of hardcodedPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            for (const match of matches) {
              console.warn(
                `\x1b[33m[Startup Warning] Hardcoded Route String: Found '${match}' in ${path.relative(
                  process.cwd(),
                  filepath
                )}. Please use the centralized 'Routes' object instead.\x1b[0m`
              );
            }
          }
        }
      }
    }
  }

  try {
    scanFiles(srcDir);
  } catch (err) {
    console.error("[Startup Validator] Error scanning files:", err);
  }

  console.log("\x1b[32m[Startup Validator] Validation complete.\x1b[0m");
}
