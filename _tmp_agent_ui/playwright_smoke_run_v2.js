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
  return p;
}

async function step(name, page, fn) {
  try {
    await fn();
    addStep(name, 'passed');
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    addStep(name, 'failed', { error: msg });
    addIssue('major', `Step failed: ${name}`, { error: String(err && err.stack ? err.stack : err) }, name);
    try {
      await screenshot(page, `${name}-FAILED`);
    } catch {}
  }
}

function attachDiagnostics(page, scopeRef) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push({
        step: scopeRef.current,
        text: msg.text(),
        location: msg.location(),
        ts: new Date().toISOString(),
      });
    }
  });
  page.on('pageerror', (err) => {
    report.consoleErrors.push({
      step: scopeRef.current,
      text: String(err && err.message ? err.message : err),
      pageerror: true,
      ts: new Date().toISOString(),
    });
  });
  page.on('requestfailed', (req) => {
    report.failedRequests.push({
      step: scopeRef.current,
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

async function detectHorizontalOverflow(page) {
  return await page.evaluate(() => {
    const body = document.body;
    const doc = document.documentElement;
    const sw = Math.max(body ? body.scrollWidth : 0, doc ? doc.scrollWidth : 0);
    return sw > window.innerWidth + 4;
  });
}

async function ensureAuthed(page) {
  const url = new URL(page.url());
  if (url.pathname === '/' || url.search.includes('auth=login')) {
    throw new Error(`Not authenticated; currently at ${page.url()}`);
  }
}

async function waitForAny(page, selectors, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      if (await page.locator(sel).count()) return sel;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Timeout waiting for selectors: ${selectors.join(', ')}`);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    // Desktop deep pass
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    const scopeDesktop = { current: 'desktop:init' };
    attachDiagnostics(desktopPage, scopeDesktop);

    await step('desktop:open-landing', desktopPage, async () => {
      scopeDesktop.current = 'desktop:open-landing';
      await desktopPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await desktopPage.waitForTimeout(1200);
      await screenshot(desktopPage, 'desktop-landing');
    });

    await step('desktop:landing-anchor-nav', desktopPage, async () => {
      scopeDesktop.current = 'desktop:landing-anchor-nav';
      for (const a of ['#features', '#how-it-works', '#pricing']) {
        const anchor = desktopPage.locator(`a[href="${a}"]`).first();
        if (await anchor.count()) {
          await anchor.click();
          await desktopPage.waitForTimeout(500);
        } else {
          addIssue('minor', `Landing anchor missing: ${a}`, {}, scopeDesktop.current);
        }
      }
      await screenshot(desktopPage, 'desktop-landing-anchors');
    });

    await step('desktop:open-auth-modal', desktopPage, async () => {
      scopeDesktop.current = 'desktop:open-auth-modal';
      const clicked = await clickByRoleNameAny(desktopPage, 'button', [/Sign In/i, /تسجيل الدخول/i]);
      if (!clicked) throw new Error('Login button not found on landing');
      await desktopPage.waitForTimeout(700);
      const form = desktopPage.locator('form').first();
      if (!(await form.count())) throw new Error('Auth modal form not found');
      await screenshot(desktopPage, 'desktop-auth-modal');
    });

    await step('desktop:login-admin', desktopPage, async () => {
      scopeDesktop.current = 'desktop:login-admin';
      const form = desktopPage.locator('form').first();
      const userField = form.locator('input[type="text"], input[type="email"]').first();
      const passField = form.locator('input[type="password"]').first();
      if (!(await userField.count()) || !(await passField.count())) {
        throw new Error('Auth fields not found in modal form');
      }
      await userField.fill('admin');
      await passField.fill('Admin@1234');

      const submit = form.locator('button[type="submit"]').first();
      if (!(await submit.count())) throw new Error('Submit button not found in auth modal');
      await submit.click();

      await desktopPage.waitForURL((url) => /\/dashboard|\/control-center/.test(url.pathname), { timeout: 40000 });
      await desktopPage.waitForTimeout(1200);
      await screenshot(desktopPage, 'desktop-after-login');
    });

    await step('desktop:control-center-sanity', desktopPage, async () => {
      scopeDesktop.current = 'desktop:control-center-sanity';
      const url = new URL(desktopPage.url());
      if (url.pathname.includes('/control-center')) {
        const controlHeader = desktopPage.locator('text=Admin Operations, text=Control Center').first();
        if (!(await controlHeader.count())) {
          addIssue('minor', 'Control-center text markers not found', {}, scopeDesktop.current);
        }
        await screenshot(desktopPage, 'desktop-control-center');
      }
      await desktopPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(desktopPage);
      await desktopPage.waitForTimeout(1000);
      await screenshot(desktopPage, 'desktop-dashboard');
    });

    await step('desktop:dashboard-deep-clicks', desktopPage, async () => {
      scopeDesktop.current = 'desktop:dashboard-deep-clicks';
      await ensureAuthed(desktopPage);

      const navs = [
        /Home|الرئيسية/i,
        /Simulations|المحاكاة/i,
        /Research|البحث/i,
        /Idea Court|محكمة/i,
        /Analytics/i,
        /Settings|الإعدادات/i,
      ];
      for (const nav of navs) {
        const clicked = await clickByRoleNameAny(desktopPage, 'button', [nav]);
        if (!clicked) {
          addIssue('minor', `Dashboard nav item not found: ${nav}`, {}, scopeDesktop.current);
        }
        await desktopPage.waitForTimeout(250);
      }

      const bellBtn = desktopPage.locator('button').filter({ has: desktopPage.locator('svg.lucide-bell') }).first();
      if (await bellBtn.count()) await bellBtn.click();
      await desktopPage.waitForTimeout(250);

      const themeBtn = desktopPage.locator('button').filter({ has: desktopPage.locator('svg.lucide-sun, svg.lucide-moon') }).first();
      if (await themeBtn.count()) await themeBtn.click();
      await desktopPage.waitForTimeout(250);

      const langBtn = desktopPage.locator('button').filter({ has: desktopPage.locator('svg.lucide-globe') }).first();
      if (await langBtn.count()) await langBtn.click();
      await desktopPage.waitForTimeout(400);

      await screenshot(desktopPage, 'desktop-dashboard-interactions');
    });

    await step('desktop:simulate-deep', desktopPage, async () => {
      scopeDesktop.current = 'desktop:simulate-deep';
      await desktopPage.goto(`${BASE_URL}/simulate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(desktopPage);
      await desktopPage.waitForSelector('[data-testid="chat-input"]', { timeout: 40000 });
      await desktopPage.fill('[data-testid="chat-input"]', 'AI legal assistant for SMEs in Egypt with document analysis and case prediction support.');
      await desktopPage.click('[data-testid="chat-send"]');
      await desktopPage.waitForTimeout(1800);

      await desktopPage.fill('[data-testid="chat-input"]', 'go');
      await desktopPage.click('[data-testid="chat-send"]');

      try {
        await waitForAny(desktopPage, ['[data-testid="chat-messages"]'], 45000);
      } catch {
        addIssue('major', 'Chat stream did not appear on simulation page', {}, scopeDesktop.current);
      }

      for (const metric of ['metric-total-agents', 'metric-acceptance-rate']) {
        if (!(await desktopPage.locator(`[data-testid="${metric}"]`).count())) {
          addIssue('major', `Metric missing: ${metric}`, {}, scopeDesktop.current);
        }
      }

      await screenshot(desktopPage, 'desktop-sim-chat');

      await clickByRoleNameAny(desktopPage, 'button', [/Reasoning|تفكير الوكلاء/i]);
      await desktopPage.waitForTimeout(600);
      if (!(await desktopPage.locator('[data-testid="reasoning-messages"]').count())) {
        addIssue('minor', 'Reasoning container not found after tab switch', {}, scopeDesktop.current);
      }
      await screenshot(desktopPage, 'desktop-sim-reasoning');

      await clickByRoleNameAny(desktopPage, 'button', [/Config|الإعدادات/i]);
      await desktopPage.waitForTimeout(600);
      await screenshot(desktopPage, 'desktop-sim-config');

      await clickByRoleNameAny(desktopPage, 'button', [/Chat|الدردشة/i]);
      await desktopPage.waitForTimeout(300);
    });

    await step('desktop:research-run', desktopPage, async () => {
      scopeDesktop.current = 'desktop:research-run';
      await desktopPage.goto(`${BASE_URL}/research`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(desktopPage);
      const qInput = desktopPage.locator('input').first();
      await qInput.fill('Coffee subscription marketplace with AI recommendations in GCC');
      const inputs = desktopPage.locator('input');
      if ((await inputs.count()) > 1) await inputs.nth(1).fill('Riyadh');
      if ((await inputs.count()) > 2) await inputs.nth(2).fill('ecommerce');

      const runBtn = desktopPage.locator('button').first();
      await runBtn.click();
      await waitForAny(desktopPage, ['pre', 'p.text-red-500'], 70000);
      await screenshot(desktopPage, 'desktop-research');
    });

    await step('desktop:court-run', desktopPage, async () => {
      scopeDesktop.current = 'desktop:court-run';
      await desktopPage.goto(`${BASE_URL}/court`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(desktopPage);
      const ta = desktopPage.locator('textarea').first();
      await ta.fill('Subscription AI coffee startup for GCC with dropshipping and local fulfillment hybrid model.');
      const runBtn = desktopPage.getByRole('button', { name: /Run Idea Court|Running/i }).first();
      if (!(await runBtn.count())) throw new Error('Run Idea Court button not found');
      await runBtn.click();
      await waitForAny(desktopPage, ['pre', 'p[style*="red"]'], 50000);
      await screenshot(desktopPage, 'desktop-court');
    });

    await step('desktop:settings-check', desktopPage, async () => {
      scopeDesktop.current = 'desktop:settings-check';
      await desktopPage.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(desktopPage);
      const inputs = desktopPage.locator('input');
      if ((await inputs.count()) < 2) throw new Error('Settings profile inputs not found');
      await inputs.nth(0).fill('Smoke Admin');
      await inputs.nth(1).fill('admin-smoke@example.com');

      // best-effort toggles
      await clickByRoleNameAny(desktopPage, 'button', [/English|العربية|ط§ظ„ط¹ط±ط¨ظٹط©/i]);
      await desktopPage.waitForTimeout(200);
      await clickByRoleNameAny(desktopPage, 'button', [/Dark|Light|داكن|فاتح|ط¯ط§ظƒظ†|ظپط§طھط­/i]);

      const saved = await clickByRoleNameAny(desktopPage, 'button', [/Save|حفظ|ط­ظپط¸/i]);
      if (!saved) addIssue('minor', 'Settings save button not found', {}, scopeDesktop.current);
      await desktopPage.waitForTimeout(400);
      await screenshot(desktopPage, 'desktop-settings');
    });

    await step('desktop:bonus-check', desktopPage, async () => {
      scopeDesktop.current = 'desktop:bonus-check';
      await desktopPage.goto(`${BASE_URL}/bonus`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(desktopPage);
      if (!(await desktopPage.locator('text=Bonus Credits').count())) {
        addIssue('minor', 'Bonus page title not found', {}, scopeDesktop.current);
      }
      const backBtn = desktopPage.getByRole('button', { name: /Back to dashboard/i }).first();
      if (await backBtn.count()) {
        await backBtn.click();
        await desktopPage.waitForTimeout(400);
      }
      await screenshot(desktopPage, 'desktop-bonus');
    });

    const storageState = await desktopContext.storageState();
    await desktopContext.close();

    // Mobile public
    const mobilePublicContext = await browser.newContext({ ...devices['iPhone 12'] });
    const mobilePublicPage = await mobilePublicContext.newPage();
    const scopeMobilePublic = { current: 'mobile-public:init' };
    attachDiagnostics(mobilePublicPage, scopeMobilePublic);

    await step('mobile:public-landing', mobilePublicPage, async () => {
      scopeMobilePublic.current = 'mobile:public-landing';
      await mobilePublicPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await mobilePublicPage.waitForTimeout(1000);
      await screenshot(mobilePublicPage, 'mobile-landing');

      const menuBtn = mobilePublicPage.locator('button').filter({ has: mobilePublicPage.locator('svg.lucide-menu, svg.lucide-x') }).first();
      if (await menuBtn.count()) {
        await menuBtn.click();
        await mobilePublicPage.waitForTimeout(400);
      } else {
        addIssue('minor', 'Mobile menu button missing', {}, scopeMobilePublic.current);
      }

      const loginClicked = await clickByRoleNameAny(mobilePublicPage, 'button', [/Sign In|تسجيل الدخول/i]);
      if (!loginClicked) addIssue('minor', 'Mobile Sign In action missing', {}, scopeMobilePublic.current);
      await mobilePublicPage.waitForTimeout(500);

      if (!(await mobilePublicPage.locator('form input[type="password"]').count())) {
        addIssue('major', 'Mobile auth modal did not open correctly', {}, scopeMobilePublic.current);
      }

      if (await detectHorizontalOverflow(mobilePublicPage)) {
        addIssue('minor', 'Horizontal overflow on mobile landing', {}, scopeMobilePublic.current);
      }
      await screenshot(mobilePublicPage, 'mobile-auth-modal');
    });

    await mobilePublicContext.close();

    // Mobile authenticated
    const mobileAuthContext = await browser.newContext({ ...devices['iPhone 12'], storageState });
    const mobileAuthPage = await mobileAuthContext.newPage();
    const scopeMobileAuth = { current: 'mobile-auth:init' };
    attachDiagnostics(mobileAuthPage, scopeMobileAuth);

    await step('mobile:dashboard-check', mobileAuthPage, async () => {
      scopeMobileAuth.current = 'mobile:dashboard-check';
      await mobileAuthPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(mobileAuthPage);
      if (await detectHorizontalOverflow(mobileAuthPage)) {
        addIssue('minor', 'Horizontal overflow on mobile dashboard', {}, scopeMobileAuth.current);
      }
      await screenshot(mobileAuthPage, 'mobile-dashboard');
    });

    await step('mobile:simulate-tabs', mobileAuthPage, async () => {
      scopeMobileAuth.current = 'mobile:simulate-tabs';
      await mobileAuthPage.goto(`${BASE_URL}/simulate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(mobileAuthPage);
      await mobileAuthPage.waitForSelector('[data-testid="chat-input"]', { timeout: 35000 });
      await clickByRoleNameAny(mobileAuthPage, 'button', [/Reasoning|تفكير الوكلاء/i]);
      await mobileAuthPage.waitForTimeout(500);
      await clickByRoleNameAny(mobileAuthPage, 'button', [/Config|الإعدادات/i]);
      await mobileAuthPage.waitForTimeout(500);
      await clickByRoleNameAny(mobileAuthPage, 'button', [/Chat|الدردشة/i]);
      await mobileAuthPage.waitForTimeout(500);
      if (await detectHorizontalOverflow(mobileAuthPage)) {
        addIssue('minor', 'Horizontal overflow on mobile simulate', {}, scopeMobileAuth.current);
      }
      await screenshot(mobileAuthPage, 'mobile-simulate-tabs');
    });

    await step('mobile:settings-check', mobileAuthPage, async () => {
      scopeMobileAuth.current = 'mobile:settings-check';
      await mobileAuthPage.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ensureAuthed(mobileAuthPage);
      if (await detectHorizontalOverflow(mobileAuthPage)) {
        addIssue('minor', 'Horizontal overflow on mobile settings', {}, scopeMobileAuth.current);
      }
      await screenshot(mobileAuthPage, 'mobile-settings');
    });

    await mobileAuthContext.close();

    for (const e of report.consoleErrors) {
      const t = (e.text || '').toLowerCase();
      if (t.includes('vite') || t.includes('uncaught') || t.includes('cannot read')) {
        addIssue('major', 'Potential runtime exception signal in console', { error: e }, e.step || null);
      }
    }

    report.pass = !report.issues.some((i) => i.severity === 'critical' || i.severity === 'major');
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
    if (browser) await browser.close();

    console.log(JSON.stringify({
      outDir: OUT_DIR,
      reportPath,
      pass: report.pass,
      summary: report.summary,
    }, null, 2));
  }
})();
