import { test, expect } from "@playwright/test";

test.describe("InterviewAI Navigation & Routing Architecture QA Audit", () => {
  const COMMON_PASSWORD = "Password123!";
  let candidateEmail: string;
  let interviewerEmail: string;
  let adminEmail: string;

  test.beforeAll(() => {
    const uniqueId = `${Date.now()}.${Math.random().toString(36).substring(7)}`;
    candidateEmail = `cand.nav.${uniqueId}@interviewai.io`;
    interviewerEmail = `inter.nav.${uniqueId}@interviewai.io`;
    adminEmail = `admin.nav.${uniqueId}@interviewai.io`;
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

  // ----------------------------------------------------
  // TEST 1: Unauthenticated redirection & Deep Links
  // ----------------------------------------------------
  test("Guest / Unauthenticated Deep Links Redirection Matrix", async ({ page }) => {
    console.log("[QA Routing] Auditing unauthenticated deep link redirection...");

    const routesToTest = [
      "/dashboard",
      "/dashboard/candidate",
      "/dashboard/candidate/interviews",
      "/dashboard/candidate/practice",
      "/dashboard/candidate/submissions",
      "/dashboard/candidate/settings",
      "/dashboard/candidate/profile",
      "/dashboard/analytics",
      "/dashboard/interviewer",
      "/dashboard/interviewer/interviews",
      "/dashboard/interviewer/settings",
      "/dashboard/interviewer/profile",
      "/dashboard/admin",
      "/dashboard/admin/interviews",
      "/dashboard/admin/settings",
      "/dashboard/admin/profile",
    ];

    for (const route of routesToTest) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/);
      console.log(`[QA Routing] Deep link ${route} redirected to /login correctly.`);
    }
  });

  // ----------------------------------------------------
  // TEST 2: Candidate Role Navigation, Refresh, New Tab, Back/Forward
  // ----------------------------------------------------
  test("Candidate Full Navigation Journey & Page Actions", async ({ page, context }) => {
    test.setTimeout(120000);
    console.log("[QA Routing] Signing up a fresh Candidate...");

    // Sign Up Candidate
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.click('button[role="radio"]:has-text("Candidate")');
    await page.fill('input[id="name"]', "Nav Candidate Test");
    await page.fill('input[id="email"]', candidateEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for auto-redirect to candidate dashboard
    await page.waitForURL(/\/dashboard\/candidate/, { timeout: 60000 });
    console.log("[QA Routing] Candidate dashboard loaded.");

    const sidebarItems = [
      { text: "Overview", url: /\/dashboard\/candidate$/ },
      { text: "My Interviews", url: /\/dashboard\/candidate\/interviews/ },
      { text: "Practice Playground", url: /\/dashboard\/candidate\/practice/ },
      { text: "Submissions History", url: /\/dashboard\/candidate\/submissions/ },
      { text: "Analytics", url: /\/dashboard\/analytics/ },
      { text: "System Preferences", url: /\/dashboard\/candidate\/settings/ }
    ];

    // Audit clicking each sidebar item and page loading
    for (const item of sidebarItems) {
      console.log(`[QA Routing] Clicking Candidate sidebar item: ${item.text}`);
      
      const link = page.locator(`aside a:has-text("${item.text}")`);
      await expect(link).toBeVisible();
      await link.click();
      
      await expect(page).toHaveURL(item.url);
      
      // Check for 404 content
      const content = await page.textContent("body");
      expect(content).not.toContain("404");
      expect(content).not.toContain("Page not found");
      expect(content).not.toContain("Not Found");

      // Verify page refresh (F5 / Ctrl+R)
      console.log(`[QA Routing] Testing Refresh on: ${page.url()}`);
      await page.reload();
      await expect(page).toHaveURL(item.url);
      expect(await page.textContent("body")).not.toContain("404");

      // Verify browser Back / Forward
      console.log(`[QA Routing] Testing Back/Forward navigation...`);
      await page.goBack();
      await page.goForward();
      await expect(page).toHaveURL(item.url);
    }

    // Verify Open in New Tab (Deep Link) while logged in
    console.log(`[QA Routing] Testing Open in New Tab for Submissions...`);
    const newPage = await context.newPage();
    newPage.on("pageerror", err => {
      console.log(`[Browser newPage Error] ${err.stack || err.message}`);
    });
    newPage.on("console", message => {
      if (message.type() === "error") {
        console.log(`[Browser newPage Console Error] ${message.text()}`);
      }
    });
    await newPage.goto("/dashboard/candidate/submissions", { waitUntil: "domcontentloaded" });
    await expect(newPage).toHaveURL(/\/dashboard\/candidate\/submissions/);
    expect(await newPage.textContent("body")).not.toContain("404");
    await newPage.close();

    // Logout
    await page.click('button[id="user-nav-dropdown-trigger"]');
    await page.click('[role="menuitem"]:has-text("Log out")');
    await page.waitForURL(/\/login/);
  });

  // ----------------------------------------------------
  // TEST 3: Interviewer Navigation & Access Boundaries
  // ----------------------------------------------------
  test("Interviewer Navigation Journey & Access Boundaries", async ({ page }) => {
    test.setTimeout(90000);
    console.log("[QA Routing] Signing up Interviewer...");

    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.click('button[role="radio"]:has-text("Interviewer")');
    await page.fill('input[id="name"]', "Nav Interviewer Test");
    await page.fill('input[id="email"]', interviewerEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard\/interviewer/, { timeout: 60000 });
    console.log("[QA Routing] Interviewer dashboard loaded.");

    const sidebarItems = [
      { text: "Overview", url: /\/dashboard\/interviewer$/ },
      { text: "Schedule Round", url: /\/dashboard\/interviewer\/interviews/ },
      { text: "System Preferences", url: /\/dashboard\/interviewer\/settings/ }
    ];

    for (const item of sidebarItems) {
      console.log(`[QA Routing] Clicking Interviewer sidebar item: ${item.text}`);
      const link = page.locator(`aside a:has-text("${item.text}")`);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(item.url);
    }

    // Verify Access Restriction (RBAC) boundaries
    console.log("[QA Routing] Testing interviewer accessing candidate/admin pages...");
    await page.goto("/dashboard/candidate", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/interviewer/); // Redirected back to their dashboard

    await page.goto("/dashboard/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/interviewer/);

    // Logout
    await page.click('button[id="user-nav-dropdown-trigger"]');
    await page.click('[role="menuitem"]:has-text("Log out")');
    await page.waitForURL(/\/login/);
  });

  // ----------------------------------------------------
  // TEST 4: Admin Navigation Journey
  // ----------------------------------------------------
  test("Admin Navigation Journey", async ({ page }) => {
    test.setTimeout(90000);
    console.log("[QA Routing] Signing up Admin...");

    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.click('button[role="radio"]:has-text("Admin")');
    await page.fill('input[id="name"]', "Nav Admin Test");
    await page.fill('input[id="email"]', adminEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard\/admin/, { timeout: 60000 });
    console.log("[QA Routing] Admin Console Overview loaded.");

    const sidebarItems = [
      { text: "Console Overview", url: /\/dashboard\/admin$/ },
      { text: "Manage Interviews", url: /\/dashboard\/admin\/interviews/ },
      { text: "System Preferences", url: /\/dashboard\/admin\/settings/ }
    ];

    for (const item of sidebarItems) {
      console.log(`[QA Routing] Clicking Admin sidebar: ${item.text}`);
      const link = page.locator(`aside a:has-text("${item.text}")`);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(item.url);
    }

    // Logout
    await page.click('button[id="user-nav-dropdown-trigger"]');
    await page.click('[role="menuitem"]:has-text("Log out")');
    await page.waitForURL(/\/login/);
  });

  // ----------------------------------------------------
  // TEST 5: Navigation Stress Test (500 consecutive jumps / rapid clicking)
  // ----------------------------------------------------
  test("Navigation Stress Test & Rapid Switching", async ({ page }) => {
    test.setTimeout(120000);
    const stressEmail = `cand.stress.${Date.now()}.${Math.random().toString(36).substring(7)}@interviewai.io`;
    console.log(`[QA Routing] Running rapid navigation stress testing with: ${stressEmail}...`);

    // Sign Up fresh candidate
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.click('button[role="radio"]:has-text("Candidate")');
    await page.fill('input[id="name"]', "Stress Test Candidate");
    await page.fill('input[id="email"]', stressEmail);
    await page.fill('input[id="password"]', COMMON_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/candidate/, { timeout: 60000 });

    const routes = [
      "/dashboard/candidate",
      "/dashboard/candidate/interviews",
      "/dashboard/candidate/practice",
      "/dashboard/candidate/submissions",
      "/dashboard/analytics",
      "/dashboard/candidate/settings",
    ];

    // Rapidly switch between 6 paths 5 times (30 rapid page hops) to test stability
    for (let i = 0; i < 5; i++) {
      for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        // Ensure no 404
        expect(await page.textContent("body")).not.toContain("404");
      }
    }
    console.log("[QA Routing] Navigation stress test passed successfully!");
  });
});
