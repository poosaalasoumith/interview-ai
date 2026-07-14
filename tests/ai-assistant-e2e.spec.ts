import { test, expect } from "@playwright/test";

test.describe("InterviewAI Reconstructed AI Assistant E2E Integration Suite", () => {
  const COMMON_PASSWORD = "Password123!";
  let candidateEmail: string;

  test.beforeAll(() => {
    const uniqueId = `${Date.now()}.${Math.random().toString(36).substring(7)}`;
    candidateEmail = `cand.ai.${uniqueId}@interviewai.io`;
  });

  test.beforeEach(async ({ page }) => {
    // Log browser errors and page issues
    page.on("pageerror", err => {
      console.log(`[Browser Page Error] ${err.stack || err.message}`);
    });
    page.on("console", message => {
      if (message.type() === "error") {
        console.log(`[Browser Console Error] ${message.text()}`);
      }
    });
  });

  test("Sign up candidate, start practice, toggle assistant and stream a query", async ({ page }) => {
    test.setTimeout(120000);

    // 1. Sign Up Candidate
    console.log("[AI E2E] Registering Candidate...");
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.click('button[role="radio"]:has-text("Candidate")');
    await page.fill('input[id="name"]', "AI Assistant E2E Test");
    await page.fill('input[id="email"]', candidateEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard load
    await page.waitForURL(/\/dashboard\/candidate/, { timeout: 60000 });
    console.log("[AI E2E] Candidate dashboard loaded.");

    // 2. Navigate to Practice Playground
    await page.goto("/dashboard/candidate/practice", { waitUntil: "domcontentloaded" });
    
    // Click Start Practice Interview to trigger the configuration wizard
    await page.waitForSelector("button:has-text('START PRACTICE INTERVIEW')");
    await page.click("button:has-text('START PRACTICE INTERVIEW')");

    await page.waitForSelector("h2:has-text('Choose your target Role')");
    
    // Select default role and proceed to Rounds Configuration
    await page.click("button:has-text('Configure Rounds')");
    await page.waitForSelector("label:has-text('Interview Round Type')");
    
    // Select Coding Round type exactly
    await page.locator('div:text-is("Coding")').click();

    // Click Calibrate Hardware
    await page.click("button:has-text('Calibrate Hardware')");
    await page.waitForSelector("h2:has-text('Hardware Calibration check')");

    // Click Simulate & Bypass Checks to launch coding workspace session
    await page.click("button:has-text('Simulate & Bypass Checks')");

    // Wait for the workspace route redirection
    await page.waitForURL(/\/practice\/interview\/practice-/, { timeout: 60000 });
    console.log("[AI E2E] Practice Coding workspace loaded. Bypassing proctor fullscreen modal...");

    // Click Immersive practice mode button to clear modal
    await page.waitForSelector("button:has-text('ENTER IMMERSIVE PRACTICE MODE')");
    await page.click("button:has-text('ENTER IMMERSIVE PRACTICE MODE')");

    // Close any fullscreen mode alerts or modal if present
    await page.waitForSelector("button:has-text('Ask Assistant')", { timeout: 25000 });

    // 3. Open the AI Assistant Sidebar
    console.log("[AI E2E] Opening AI Assistant sidebar...");
    await page.click("button:has-text('Ask Assistant')");

    // Verify AI Assistant Panel has rendered
    const assistantTitle = page.locator("span:has-text('AI Coding Assistant')");
    await expect(assistantTitle).toBeVisible();

    // Verify suggested prompts are displayed
    const suggestionBtn = page.locator("button:has-text('progressive hint')").first();
    await expect(suggestionBtn).toBeVisible();

    // 4. Send Message & verify stream output
    console.log("[AI E2E] Sending message to assistant...");
    await page.fill("textarea[placeholder*='Ask about the current coding problem']", "Give me a progressive hint on the current problem.");
    await page.click("button[title='Send Message']");

    // Check for thinking indicator
    const thinkingText = page.locator("span:has-text('Thinking...')");
    await expect(thinkingText).toBeVisible();

    // Wait for streamed response to finish loading
    await expect(thinkingText).not.toBeVisible({ timeout: 20000 });

    // Assert a message from the assistant is rendered in the chat viewport
    const assistantMsg = page.locator("div.bg-zinc-900\\/60 div.space-y-3").first();
    await expect(assistantMsg).toBeVisible();

    // 5. Verify diagnostics panel trigger
    console.log("[AI E2E] Toggling Developer Diagnostics...");
    await page.click("button:has-text('Diag')");

    // Verify diagnostics properties are visible
    const requestSpec = page.locator("span:has-text('Developer Diagnostics')");
    await expect(requestSpec).toBeVisible();

    console.log("[AI E2E] Reconstructed AI Assistant E2E verification complete!");
  });
});
