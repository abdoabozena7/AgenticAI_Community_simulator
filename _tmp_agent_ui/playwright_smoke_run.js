const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const OUT_ROOT = path.resolve('_tmp_agent_ui');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(OUT_ROOT, `playwright-smoke-${stamp}`);
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  steps: [],
  issues: [],
  consoleErrors: [],
  failedRequests: [],
  screenshots: [],
  pass: false,
};

function addIssue(severity, title, details = {}, step = null) {
  report.issues.push({ severity, title, details, step, ts: new Date().toISOString() });
}

function addStep(name, status, details = {}) {
  report.steps.push({ name, status, details, ts: new Date().toISOString() });
}

async function screenshot(page, name) {
  const safe = name.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const p = path.join(SHOTS_DIR, `${String(report.screenshots.length + 1).padStart(2, '0')}-${safe}.png`);
  await page.screenshot({ path: p, fullPage: true });
  report.screenshots.push(p);
}

async function step(name, fn) {
  try {
    await fn();
    addStep(name, 'passed');
  } catch (err) {
    addStep(name, 'failed', { error: String(err && err.message ? err.message : err) });
    addIssue('major', `Step failed: ${name}`, { error: String(err && err.stack ? err.stack : err) }, name);
  }
}

function attachDiagnostics(page, scopeLabelRef) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push({
        step: scopeLabelRef.current,
        text: msg.text(),
        location: msg.location(),
        ts: new Date().toISOString(),
      });
    }
  });
  page.on('pageerror', (err) => {
    report.consoleErrors.push({
      step: scopeLabelRef.current,
      text: String(err && err.message ? err.message : err),
      pageerror: true,
      ts: new Date().toISOString(),
    });
  });
  page.on('requestfailed', (req) => {
    report.failedRequests.push({
      step: scopeLabelRef.current,
      url: req.url(),
      method: req.method(),
      failure: req.failure(),
      ts: new Date().toISOString(),
    });
  });
}

async function clickByRoleNameAny(page, role, patterns, opts = {}) {
  for (const p of patterns) {
    const loc = page.getByRole(role, { name: p }).first();
    if (await loc.count()) {
      await loc.click(opts);
      return true;
    }
  }
  return false;
}

async function clickFirstIfExists(locator) {
  if (await locator.count()) {
    await locator.first().click();
    return true;
  }
  return false;
}

async function detectHorizontalOverflow(page) {
  return await page.evaluate(() => {
    const body = document.body;
    const doc = document.documentElement;
    const sw = Math.max(body ? body.scrollWidth : 0, doc ? doc.scrollWidth : 0);
    const iw = window.innerWidth;
    return sw > iw + 4;
  });
}

async function waitForAny(page, selectors, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const loc = page.locator(sel);
      if (await loc.count()) return sel;
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`Timeout waiting for any selector: ${selectors.join(', ')}`);
}

(async () => {
  let browser;
  let desktopContext;
  let desktopPage;
  let storageState;

  try {
    browser = await chromium.launch({ headless: true });

    // Desktop deep pass
    desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    desktopPage = await desktopContext.newPage();
    const scopeDesktop = { current: 'desktop:init' };
    attachDiagnostics(desktopPage, scopeDesktop);

    await step('desktop:open-landing', async () => {
      scopeDesktop.current = 'desktop:open-landing';
      await desktopPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await desktopPage.waitForTimeout(1500);
      await screenshot(desktopPage, 'desktop-landing');
      const title = await desktopPage.title();
      if (!title) addIssue('minor', 'Landing title is empty', {}, scopeDesktop.current);
    });

    await step('desktop:landing-anchor-nav', async () => {
      scopeDesktop.current = 'desktop:landing-anchor-nav';
      const anchors = ['#features', '#how-it-works', '#pricing'];
      for (const a of anchors) {
        const loc = desktopPage.locator(`a[href="${a}"]`).first();
        if (await loc.count()) {
          await loc.click();
          await desktopPage.waitForTimeout(600);
        } else {
          addIssue('minor', `Landing anchor missing: ${a}`, {}, scopeDesktop.current);
        }
      }
      await screenshot(desktopPage, 'desktop-landing-anchors');
    });

    await step('desktop:open-auth-modal', async () => {
      scopeDesktop.current = 'desktop:open-auth-modal';
      const clicked = await clickByRoleNameAny(desktopPage, 'button', [/Sign In/i, /تسجيل الدخول/i]);
      if (!clicked) throw new Error('Login button not found on landing');
      await desktopPage.waitForTimeout(800);
      await screenshot(desktopPage, 'desktop-auth-modal');
      const passwordInputs = desktopPage.locator('input[type="password"]');
      if (!(await passwordInputs.count())) throw new Error('Auth modal did not show password input');
    });

    await step('desktop:login-admin', async () => {
      scopeDesktop.current = 'desktop:login-admin';

      const signInSwitch = desktopPage.getByRole('button', { name: /Sign in|تسجيل الدخول/i }).nth(1);
      if (await signInSwitch.count()) {
        // in case modal opens in register mode
        try { await signInSwitch.click({ timeout: 1000 }); } catch {}
      }

      const userField = desktopPage.locator('form input[type="text"], form input[type="email"]').first();
      const passField = desktopPage.locator('form input[type="password"]').first();
      await userField.fill('admin');
      await passField.fill('Admin@1234');

      const submitBtn = desktopPage.getByRole('button', { name: /Sign In|تسجيل الدخول|Please wait|يرجى الانتظار/i }).first();
      if (!(await submitBtn.count())) throw new Error('Sign in submit button not found');
      await submitBtn.click();

      await desktopPage.waitForURL((url) => /\/dashboard|\/control-center/.test(url.pathname), { timeout: 30000 });
      await desktopPage.waitForTimeout(1200);
      await screenshot(desktopPage, 'desktop-after-login');
    });

    await step('desktop:control-center-sanity', async () => {
      scopeDesktop.current = 'desktop:control-center-sanity';
      const url = new URL(desktopPage.url());
      if (url.pathname.includes('/control-center')) {
        const hasHeader = await desktopPage.locator('text=Admin Operations, text=Control Center').first().count();
        if (!hasHeader) addIssue('minor', 'Control center opened but expected header text not found', {}, scopeDesktop.current);
        await screenshot(desktopPage, 'desktop-control-center');
      }
      await desktopPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await desktopPage.waitForTimeout(1200);
      await screenshot(desktopPage, 'desktop-dashboard');
    });

    await step('desktop:dashboard-deep-clicks', async () => {
      scopeDesktop.current = 'desktop:dashboard-deep-clicks';
      const tabs = [
        /Home|الرئيسية/i,
        /Simulations|المحاكاة/i,
        /Research|البحث/i,
        /Idea Court|محكمة/i,
        /Analytics/i,
        /Settings|الإعدادات/i,
      ];
      for (const t of tabs) {
        const clicked = await clickByRoleNameAny(desktopPage, 'button', [t]);
        if (!clicked) addIssue('minor', `Dashboard nav item not found for ${t}`, {}, scopeDesktop.current);
        await desktopPage.waitForTimeout(350);
      }

      await clickFirstIfExists(desktopPage.locator('button').filter({ has: desktopPage.locator('svg.lucide-bell') }));
      await desktopPage.waitForTimeout(300);
      await clickFirstIfExists(desktopPage.locator('button').filter({ has: desktopPage.locator('svg.lucide-sun, svg.lucide-moon') }));
      await desktopPage.waitForTimeout(300);
      await clickFirstIfExists(desktopPage.locator('button').filter({ has: desktopPage.locator('svg.lucide-globe') }));
      await desktopPage.waitForTimeout(500);

      const sessionMissing = await desktopPage.locator('text=Session not found').count();
      const loadingStuck = await desktopPage.locator('text=Loading dashboard').count();
      if (sessionMissing || loadingStuck) {
        throw new Error('Dashboard appears stuck or session missing');
      }

      await screenshot(desktopPage, 'desktop-dashboard-interactions');
    });

    await step('desktop:simulate-deep', async () => {
      scopeDesktop.current = 'desktop:simulate-deep';
      await desktopPage.goto(`${BASE_URL}/simulate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await desktopPage.waitForSelector('[data-testid="chat-input"]', { timeout: 30000 });
      await desktopPage.fill('[data-testid="chat-input"]', 'AI assistant for legal document summarization in Egypt for SMEs.');
      await desktopPage.click('[data-testid="chat-send"]');
      await desktopPage.waitForTimeout(2000);

      // Follow-up trigger
      await desktopPage.fill('[data-testid="chat-input"]', 'go');
      await desktopPage.click('[data-testid="chat-send"]');

      // Check progression signals
      try {
        await waitForAny(desktopPage, ['[data-testid="chat-messages"]', '[data-testid="reasoning-messages"]'], 45000);
      } catch (err) {
        addIssue('major', 'No chat/reasoning stream appeared after start triggers', {}, scopeDesktop.current);
      }

      for (const metric of ['metric-total-agents', 'metric-acceptance-rate']) {
        const visible = await desktopPage.locator(`[data-testid="${metric}"]`).count();
        if (!visible) {
          addIssue('major', `Metric missing: ${metric}`, {}, scopeDesktop.current);
        }
      }

      await screenshot(desktopPage, 'desktop-sim-chat');

      await clickByRoleNameAny(desktopPage, 'button', [/Reasoning|تفكير الوكلاء/i]);
      await desktopPage.waitForTimeout(700);
      if (!(await desktopPage.locator('[data-testid="reasoning-messages"]').count())) {
        addIssue('minor', 'Reasoning panel did not render message container', {}, scopeDesktop.current);
      }
      await screenshot(desktopPage, 'desktop-sim-reasoning');

      await clickByRoleNameAny(desktopPage, 'button', [/Config|الإعدادات/i]);
      await desktopPage.waitForTimeout(700);
      await screenshot(desktopPage, 'desktop-sim-config');

      await clickByRoleNameAny(desktopPage, 'button', [/Chat|الدردشة/i]);
      await desktopPage.waitForTimeout(500);
    });

    await step('desktop:research-run', async () => {
      scopeDesktop.current = 'desktop:research-run';
      await desktopPage.goto(`${BASE_URL}/research`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const inputs = desktopPage.locator('input');
      if ((await inputs.count()) < 1) throw new Error('Research inputs not found');
      await inputs.nth(0).fill('Coffee subscription marketplace with AI bean recommendations in GCC');
      if ((await inputs.count()) > 1) await inputs.nth(1).fill('Riyadh');
      if ((await inputs.count()) > 2) await inputs.nth(2).fill('ecommerce');
      const runBtn = desktopPage.locator('button').first();
      await runBtn.click();
      await waitForAny(desktopPage, ['pre', 'p.text-red-500', 'text=نتائج البحث', 'text=Research'], 60000);
      await screenshot(desktopPage, 'desktop-research');
    });

    await step('desktop:court-run', async () => {
      scopeDesktop.current = 'desktop:court-run';
      await desktopPage.goto(`${BASE_URL}/court`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const ta = desktopPage.locator('textarea').first();
      await ta.fill('Subscription-based AI-powered coffee marketplace across GCC markets');
      await clickByRoleNameAny(desktopPage, 'button', [/Run Idea Court|Running/i]);
      await waitForAny(desktopPage, ['pre', 'p[style*="red"]'], 45000);
      await screenshot(desktopPage, 'desktop-court');
    });

    await step('desktop:settings-check', async () => {
      scopeDesktop.current = 'desktop:settings-check';
      await desktopPage.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const profileInputs = desktopPage.locator('input');
      if ((await profileInputs.count()) >= 1) {
        await profileInputs.nth(0).fill('Smoke Admin');
      }
      if ((await profileInputs.count()) >= 2) {
        await profileInputs.nth(1).fill('admin-smoke@example.com');
      }

      // language/theme toggles (best effort)
      await clickByRoleNameAny(desktopPage, 'button', [/English|العربية|ط§ظ„ط¹ط±ط¨ظٹط©/i]);
      await desktopPage.waitForTimeout(200);
      await clickByRoleNameAny(desktopPage, 'button', [/Dark|Light|داكن|فاتح|ط¯ط§ظƒظ†|ظپط§طھط­/i]);
      await desktopPage.waitForTimeout(200);

      const saved = await clickByRoleNameAny(desktopPage, 'button', [/Save|حفظ|ط­ظپط¸/i]);
      if (!saved) addIssue('minor', 'Settings Save button not found', {}, scopeDesktop.current);
      await desktopPage.waitForTimeout(500);
      await screenshot(desktopPage, 'desktop-settings');
    });

    await step('desktop:bonus-check', async () => {
      scopeDesktop.current = 'desktop:bonus-check';
      await desktopPage.goto(`${BASE_URL}/bonus`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const bonusTitle = await desktopPage.locator('text=Bonus Credits').count();
      if (!bonusTitle) addIssue('minor', 'Bonus page title not found', {}, scopeDesktop.current);
      await screenshot(desktopPage, 'desktop-bonus');
      await clickByRoleNameAny(desktopPage, 'button', [/Back to dashboard/i]);
      await desktopPage.waitForTimeout(500);
    });

    storageState = await desktopContext.storageState();

    // Mobile public pass
    const mobilePublicContext = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const mobilePublicPage = await mobilePublicContext.newPage();
    const scopeMobilePublic = { current: 'mobile-public:init' };
    attachDiagnostics(mobilePublicPage, scopeMobilePublic);

    await step('mobile:public-landing', async () => {
      scopeMobilePublic.current = 'mobile:public-landing';
      await mobilePublicPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await mobilePublicPage.waitForTimeout(1200);
      await screenshot(mobilePublicPage, 'mobile-landing');

      // Open mobile menu and login modal
      const menuBtn = mobilePublicPage.locator('button').filter({ has: mobilePublicPage.locator('svg.lucide-menu, svg.lucide-x') }).first();
      if (await menuBtn.count()) {
        await menuBtn.click();
        await mobilePublicPage.waitForTimeout(500);
      } else {
        addIssue('minor', 'Mobile menu button not found on landing', {}, scopeMobilePublic.current);
      }

      const loginClicked = await clickByRoleNameAny(mobilePublicPage, 'button', [/Sign In|تسجيل الدخول/i]);
      if (!loginClicked) addIssue('minor', 'Mobile login button not found in menu', {}, scopeMobilePublic.current);
      await mobilePublicPage.waitForTimeout(700);

      const passVisible = await mobilePublicPage.locator('input[type="password"]').count();
      if (!passVisible) {
        addIssue('major', 'Auth modal did not open properly on mobile', {}, scopeMobilePublic.current);
      }
      const overflow = await detectHorizontalOverflow(mobilePublicPage);
      if (overflow) addIssue('minor', 'Horizontal overflow detected on mobile landing', {}, scopeMobilePublic.current);
      await screenshot(mobilePublicPage, 'mobile-auth-modal');
    });

    await mobilePublicContext.close();

    // Mobile authenticated pass
    const mobileAuthContext = await browser.newContext({
      ...devices['iPhone 12'],
      storageState,
    });
    const mobileAuthPage = await mobileAuthContext.newPage();
    const scopeMobileAuth = { current: 'mobile-auth:init' };
    attachDiagnostics(mobileAuthPage, scopeMobileAuth);

    await step('mobile:dashboard-check', async () => {
      scopeMobileAuth.current = 'mobile:dashboard-check';
      await mobileAuthPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mobileAuthPage.waitForTimeout(1200);
      const overflow = await detectHorizontalOverflow(mobileAuthPage);
      if (overflow) addIssue('minor', 'Horizontal overflow detected on mobile dashboard', {}, scopeMobileAuth.current);
      await screenshot(mobileAuthPage, 'mobile-dashboard');
    });

    await step('mobile:simulate-tabs', async () => {
      scopeMobileAuth.current = 'mobile:simulate-tabs';
      await mobileAuthPage.goto(`${BASE_URL}/simulate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mobileAuthPage.waitForSelector('[data-testid="chat-input"]', { timeout: 30000 });
      await clickByRoleNameAny(mobileAuthPage, 'button', [/Reasoning|تفكير الوكلاء/i]);
      await mobileAuthPage.waitForTimeout(500);
      await clickByRoleNameAny(mobileAuthPage, 'button', [/Config|الإعدادات/i]);
      await mobileAuthPage.waitForTimeout(500);
      await clickByRoleNameAny(mobileAuthPage, 'button', [/Chat|الدردشة/i]);
      await mobileAuthPage.waitForTimeout(500);
      const overflow = await detectHorizontalOverflow(mobileAuthPage);
      if (overflow) addIssue('minor', 'Horizontal overflow detected on mobile simulate', {}, scopeMobileAuth.current);
      await screenshot(mobileAuthPage, 'mobile-simulate-tabs');
    });

    await step('mobile:settings-check', async () => {
      scopeMobileAuth.current = 'mobile:settings-check';
      await mobileAuthPage.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mobileAuthPage.waitForTimeout(1000);
      const overflow = await detectHorizontalOverflow(mobileAuthPage);
      if (overflow) addIssue('minor', 'Horizontal overflow detected on mobile settings', {}, scopeMobileAuth.current);
      await screenshot(mobileAuthPage, 'mobile-settings');
    });

    await mobileAuthContext.close();

    // Overlay/runtime exception check (derived from console/pageerror)
    for (const e of report.consoleErrors) {
      if (/vite|overlay|uncaught|cannot read/i.test(e.text || '')) {
        addIssue('major', 'Potential runtime exception/overlay signal in console', { error: e }, e.step || null);
      }
    }

    // Classify pass/fail
    const hasCritical = report.issues.some((i) => i.severity === 'critical');
    const hasMajor = report.issues.some((i) => i.severity === 'major');
    report.pass = !(hasCritical || hasMajor);
  } catch (err) {
    addIssue('critical', 'Smoke runner crashed', { error: String(err && err.stack ? err.stack : err) }, 'runner');
    report.pass = false;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.summary = {
      totalSteps: report.steps.length,
      passedSteps: report.steps.filter((s) => s.status === 'passed').length,
      failedSteps: report.steps.filter((s) => s.status === 'failed').length,
      critical: report.issues.filter((i) => i.severity === 'critical').length,
      major: report.issues.filter((i) => i.severity === 'major').length,
      minor: report.issues.filter((i) => i.severity === 'minor').length,
      consoleErrors: report.consoleErrors.length,
      failedRequests: report.failedRequests.length,
      screenshots: report.screenshots.length,
    };

    const reportPath = path.join(OUT_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    if (browser) {
      await browser.close();
    }

    console.log(JSON.stringify({
      outDir: OUT_DIR,
      reportPath,
      pass: report.pass,
      summary: report.summary,
    }, null, 2));
  }
})();
