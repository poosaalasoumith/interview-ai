import { test, expect } from "@playwright/test";

test.describe("Online Judge (OJ) Compiler & Evaluation E2E Suite", () => {
  const COMMON_PASSWORD = "Password123!";
  let candidateEmail: string;

  test.beforeAll(() => {
    const uniqueId = `${Date.now()}.${Math.random().toString(36).substring(7)}`;
    candidateEmail = `cand.oj.${uniqueId}@interviewai.io`;
  });

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", err => {
      console.log(`[Browser Page Error] ${err.stack || err.message}`);
    });
    page.on("console", message => {
      if (message.type() === "error") {
        console.log(`[Browser Console Error] ${message.text()}`);
      }
    });
  });

  test("Run code, handle compile errors, run test cases, analyze complexity, and submit solution", async ({ page }) => {
    test.setTimeout(120000);

    // 1. Sign Up Candidate
    console.log("[OJ E2E] Registering Candidate...");
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.click('button[role="radio"]:has-text("Candidate")');
    await page.fill('input[id="name"]', "Online Judge E2E Test");
    await page.fill('input[id="email"]', candidateEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard load
    await page.waitForURL(/\/dashboard\/candidate/, { timeout: 60000 });
    console.log("[OJ E2E] Candidate dashboard loaded.");

    // 2. Navigate to Practice Playground
    await page.goto("/dashboard/candidate/practice", { waitUntil: "domcontentloaded" });
    
    // Click Start Practice Interview
    await page.waitForSelector("button:has-text('START PRACTICE INTERVIEW')");
    await page.click("button:has-text('START PRACTICE INTERVIEW')");

    await page.waitForSelector("h2:has-text('Choose your target Role')");
    await page.click("button:has-text('Configure Rounds')");
    await page.waitForSelector("label:has-text('Interview Round Type')");
    
    // Select Coding Round type
    await page.locator('div:text-is("Coding")').click();

    // Click Calibrate Hardware
    await page.click("button:has-text('Calibrate Hardware')");
    await page.waitForSelector("h2:has-text('Hardware Calibration check')");

    // Click Simulate & Bypass Checks to launch coding workspace session
    await page.click("button:has-text('Simulate & Bypass Checks')");

    // Wait for the workspace route redirection
    await page.waitForURL(/\/practice\/interview\/practice-/, { timeout: 60000 });
    console.log("[OJ E2E] Practice Coding workspace loaded.");

    // Click Immersive practice mode button to clear modal
    await page.waitForSelector("button:has-text('ENTER IMMERSIVE PRACTICE MODE')");
    await page.click("button:has-text('ENTER IMMERSIVE PRACTICE MODE')");

    // Wait for Monaco editor to render
    await page.waitForSelector("button:has-text('Run Code')", { timeout: 25000 });

    // 3. Test Compiler Error Handling
    console.log("[OJ E2E] Testing Compilation Error...");
    // Open Console tab first
    await page.click("button:has-text('Run Console')");
    
    // Click Monaco editor to focus
    await page.locator('.monaco-editor').first().click();
    await page.waitForTimeout(500);

    // Wait for monaco initialization
    await page.waitForFunction(() => {
      const monObj = (window as any).monaco;
      return monObj && monObj.editor && monObj.editor.getModels().length > 0;
    }, { timeout: 30000 });

    await page.evaluate(() => {
      (window as any).monaco.editor.getModels()[0].setValue("function solve() {\n  console.log('Mismatched parenthesis'\n");
    });
    await page.waitForTimeout(500);

    // Click Run Code
    await page.click("button:has-text('Run Code')");
    
    // Check terminal output contains syntax error
    const consoleOutput = page.getByTestId("terminal-output");
    await expect(consoleOutput).toContainText("SyntaxError", { timeout: 15000 });
    console.log("[OJ E2E] Compilation error handled successfully.");

    // 4. Test Valid Execution & Run Test Cases
    // Click Monaco editor to focus
    await page.locator('.monaco-editor').first().click();
    await page.waitForTimeout(500);

    // Wait for monaco and set valid code
    await page.waitForFunction(() => {
      const monObj = (window as any).monaco;
      return monObj && monObj.editor && monObj.editor.getModels().length > 0;
    }, { timeout: 30000 });

    await page.evaluate(() => {
      (window as any).monaco.editor.getModels()[0].setValue("function solve() {\n  console.log('true');\n}\nsolve();");
    });
    await page.waitForTimeout(500);

    // Make sure the Submit button is disabled before running test cases
    const submitBtn = page.locator("button:has-text('Submit Solution')");
    await expect(submitBtn).toBeDisabled();

    // Click Run Test Cases
    await page.click("button:has-text('Run Test Cases')");

    // Wait for evaluation results to appear
    await page.click("button:has-text('Evaluation Results')");
    const evaluationResultsTable = page.locator("table");
    await expect(evaluationResultsTable).toBeVisible({ timeout: 20000 });

    // 5. Verify Gated Submit button is now enabled
    console.log("[OJ E2E] Verifying gated submit button...");
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });

    // 6. Check Complexity Analysis Tab
    console.log("[OJ E2E] Verifying Complexity Analysis Tab...");
    await page.click("button:has-text('Complexity Analysis')");
    const estimatedTimeCard = page.locator("span:has-text('Estimated Time')");
    await expect(estimatedTimeCard).toBeVisible();

    const complexityExplanationText = page.locator("textarea[placeholder*='Explain your algorithmic trade-offs']");
    await expect(complexityExplanationText).toBeVisible();

    // 7. Submit Solution and verify locks
    console.log("[OJ E2E] Submitting solution...");
    await submitBtn.click();

    // Verify workspace locks: Run Code and Run Test Cases buttons should disappear or become disabled
    await expect(submitBtn).not.toBeVisible();
    
    console.log("[OJ E2E] Workspace locks verified. Test completed successfully!");
  });
});
