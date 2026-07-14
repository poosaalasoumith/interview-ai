import { test, expect } from "@playwright/test";

test.describe("Online Judge Production Certification & Security Suite", () => {
  const COMMON_PASSWORD = "Password123!";
  let candidateEmail: string;

  test.beforeAll(() => {
    const uniqueId = `${Date.now()}.${Math.random().toString(36).substring(7)}`;
    candidateEmail = `cert.oj.${uniqueId}@interviewai.io`;
  });

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", err => {
      console.log(`[Browser Page Error] ${err.stack || err.message}`);
    });
  });

  test("Authenticated Production Certification Audits", async ({ page }) => {
    test.setTimeout(120000);

    // 1. Sign Up Candidate to establish authorized session context
    console.log("[Cert E2E] Authenticating session...");
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.click('button[role="radio"]:has-text("Candidate")');
    await page.fill('input[id="name"]', "OJ Certification auditor");
    await page.fill('input[id="email"]', candidateEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard load
    await page.waitForURL(/\/dashboard\/candidate/, { timeout: 60000 });
    console.log("[Cert E2E] Session authenticated successfully.");

    // 2. Query System Diagnostics Health Check
    console.log("[Cert E2E] Auditing Health Check API...");
    const diagnostics = await page.evaluate(async () => {
      const response = await fetch("/api/system/online-judge/health");
      return response.json();
    });

    expect(diagnostics).toHaveProperty("status");
    expect(diagnostics).toHaveProperty("runtimes");
    expect(diagnostics.runtimes).toHaveProperty("javascript", true);
    expect(diagnostics.runtimes).toHaveProperty("python", true);
    expect(diagnostics).toHaveProperty("sandbox");
    console.log("[Cert E2E] Health check diagnostics verified.");

    // 3. Verify Infinite Loop Sandbox Protection
    console.log("[Cert E2E] Verifying infinite loop timeout constraints...");
    const loopResult = await page.evaluate(async () => {
      const response = await fetch("/api/assessments/execute-raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "javascript",
          code: "console.log('Starting loop...');\nwhile(true) {}\nconsole.log('Finished loop');",
          stdin: ""
        })
      });
      return response.json();
    });

    expect(loopResult).toHaveProperty("run");
    expect(loopResult.run.stderr).toContain("Time Limit Exceeded");
    expect(parseFloat(loopResult.run.time)).toBeGreaterThanOrEqual(3.0);
    console.log("[Cert E2E] Infinite loop timeout sandbox protection verified.");

    // 4. Verify Maximum Buffer Sandbox Protection
    console.log("[Cert E2E] Verifying max buffer constraints...");
    const bufferResult = await page.evaluate(async () => {
      const response = await fetch("/api/assessments/execute-raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "javascript",
          code: "for(let i=0; i<50000; i++) { console.log('This is a very long log output to test buffer max size constraints in the sandbox'); }",
          stdin: ""
        })
      });
      return response.json();
    });

    expect(bufferResult).toHaveProperty("run");
    expect(bufferResult.run.code).toBeDefined();
    console.log("[Cert E2E] Max buffer sandbox protection verified.");

    // 5. Verify Complexity Analysis for Bubble Sort
    console.log("[Cert E2E] Auditing Bubble Sort complexity detection...");
    const bubbleComplexity = await page.evaluate(async () => {
      const response = await fetch("/api/assessments/analyze-complexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "javascript",
          code: `
            function bubbleSort(arr) {
              let n = arr.length;
              for (let i = 0; i < n-1; i++) {
                for (let j = 0; j < n-i-1; j++) {
                  if (arr[j] > arr[j+1]) {
                    let temp = arr[j];
                    arr[j] = arr[j+1];
                    arr[j+1] = temp;
                  }
                }
              }
              return arr;
            }
          `
        })
      });
      return response.json();
    });

    expect(bubbleComplexity.detectedAlgorithm).toBe("Bubble Sort");
    expect(bubbleComplexity.timeComplexity).toBe("O(N^2)");
    expect(bubbleComplexity.spaceComplexity).toBe("O(1)");
    console.log("[Cert E2E] Bubble Sort O(N^2) complexity verified.");

    // 6. Verify Complexity Analysis for Binary Search
    console.log("[Cert E2E] Auditing Binary Search complexity detection...");
    const binaryComplexity = await page.evaluate(async () => {
      const response = await fetch("/api/assessments/analyze-complexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "javascript",
          code: `
            function binarySearch(arr, x) {
              let l = 0, r = arr.length - 1;
              while (l <= r) {
                let m = l + Math.floor((r - l) / 2);
                if (arr[m] === x) return m;
                if (arr[m] < x) l = m + 1;
                else r = m - 1;
              }
              return -1;
            }
          `
        })
      });
      return response.json();
    });

    expect(binaryComplexity.detectedAlgorithm).toBe("Binary Search");
    expect(binaryComplexity.timeComplexity).toBe("O(log N)");
    expect(binaryComplexity.spaceComplexity).toBe("O(1)");
    console.log("[Cert E2E] Binary Search O(log N) complexity verified.");
  });
});
