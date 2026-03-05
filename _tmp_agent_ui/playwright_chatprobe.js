const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const OUT_ROOT = path.resolve('_tmp_agent_ui');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(OUT_ROOT, `playwright-chatprobe-${stamp}`);
const SHOTS = path.join(OUT_DIR, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const result = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  pass: false,
  steps: [],
  observations: [],
  issues: [],
  consoleErrors: [],
  failedRequests: [],
  badResponses: [],
  screenshots: [],
};

function logStep(name, status, details = {}) {
  result.steps.push({ name, status, details, ts: new Date().toISOString() });
}

function issue(severity, title, details = {}, step = null) {
  result.issues.push({ severity, title, details, step, ts: new Date().toISOString() });
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${String(result.screenshots.length + 1).padStart(2, '0')}-${name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`);
  await page.screenshot({ path: file, fullPage: true });
  result.screenshots.push(file);
}

async function runStep(name, page, fn) {
  try {
    await fn();
    logStep(name, 'passed');
  } catch (e) {
    logStep(name, 'failed', { error: String(e?.message || e) });
    issue('major', `Step failed: ${name}`, { error: String(e?.stack || e) }, name);
    try { await shot(page, `${name}-FAILED`); } catch {}
  }
}

function attachNetworkAndConsole(page, scopeRef) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      result.consoleErrors.push({ step: scopeRef.current, text: msg.text(), location: msg.location(), ts: new Date().toISOString() });
    }
  });
  page.on('requestfailed', (req) => {
    result.failedRequests.push({
      step: scopeRef.current,
      url: req.url(),
      method: req.method(),
      failure: req.failure(),
      ts: new Date().toISOString(),
    });
  });
  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    if (/\/simulation|\/research|\/court|\/auth/.test(url) && status >= 400) {
      let body = '';
      try {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('application/json')) {
          body = JSON.stringify(await res.json());
        } else {
          body = (await res.text()).slice(0, 400);
        }
      } catch {}
      result.badResponses.push({ step: scopeRef.current, url, status, body, ts: new Date().toISOString() });
    }
  });
}

async function clickByName(page, regexes) {
  for (const r of regexes) {
    const btn = page.getByRole('button', { name: r }).first();
    if (await btn.count()) {
      await btn.click();
      return true;
    }
  }
  return false;
}

async function getChatState(page, label) {
  const state = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => Array.from(document.querySelectorAll(s));

    const input = q('[data-testid="chat-input"]');
    const send = q('[data-testid="chat-send"]') || q('[data-testid="chat-retry-llm"]');
    const chatMessages = q('[data-testid="chat-messages"]');
    const reasoningMessages = q('[data-testid="reasoning-messages"]');

    const bodyText = document.body?.innerText || '';

    return {
      url: location.href,
      title: document.title,
      hasChatInput: Boolean(input),
      chatInputDisabled: input ? input.hasAttribute('disabled') : null,
      hasSend: Boolean(send),
      sendDisabled: send ? send.hasAttribute('disabled') : null,
      chatMessagesCount: chatMessages ? chatMessages.querySelectorAll('*').length : 0,
      reasoningMessagesCount: reasoningMessages ? reasoningMessages.querySelectorAll('*').length : 0,
      hasMetricsTotalAgents: Boolean(q('[data-testid="metric-total-agents"]')),
      hasMetricsAcceptance: Boolean(q('[data-testid="metric-acceptance-rate"]')),
      hasClarificationBanner: /clarification|توضيح/i.test(bodyText),
      hasResearchReviewBanner: /review|مراجعة|links|روابط/i.test(bodyText),
      hasRuntimeErrorWords: /cannot read|undefined|uncaught|error/i.test(bodyText),
      visibleTabs: qa('button').map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
      bodyTextSample: bodyText.slice(0, 800),
    };
  });
  result.observations.push({ label, ...state, ts: new Date().toISOString() });
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const scope = { current: 'init' };
    attachNetworkAndConsole(page, scope);

    await runStep('open-landing', page, async () => {
      scope.current = 'open-landing';
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      await shot(page, 'landing');
    });

    await runStep('login-admin', page, async () => {
      scope.current = 'login-admin';
      const clicked = await clickByName(page, [/Sign In/i, /تسجيل الدخول/i]);
      if (!clicked) throw new Error('Sign In button not found on landing');
      await page.waitForTimeout(600);

      const form = page.locator('form').first();
      const user = form.locator('input[type="text"], input[type="email"]').first();
      const pass = form.locator('input[type="password"]').first();
      await user.fill('admin');
      await pass.fill('Admin@1234');
      await form.locator('button[type="submit"]').first().click();

      await page.waitForURL((url) => /\/dashboard|\/control-center/.test(url.pathname), { timeout: 40000 });
      if (page.url().includes('/control-center')) {
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      await page.waitForTimeout(1200);
      await shot(page, 'dashboard-after-login');
    });

    await runStep('open-simulate', page, async () => {
      scope.current = 'open-simulate';
      await page.goto(`${BASE_URL}/simulate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('[data-testid="chat-input"]', { timeout: 45000 });
      await page.waitForTimeout(1000);
      await getChatState(page, 'before-idea');
      await shot(page, 'simulate-before-idea');
    });

    await runStep('insert-idea-send', page, async () => {
      scope.current = 'insert-idea-send';
      await page.fill('[data-testid="chat-input"]', 'متجر اشتراكات قهوة مختصة مدعوم بالذكاء الاصطناعي مع شحن هجين داخل الخليج');
      await page.click('[data-testid="chat-send"]');
      await page.waitForTimeout(2500);
      await getChatState(page, 'after-first-send-2_5s');
      await shot(page, 'simulate-after-first-send');
    });

    await runStep('followup-go', page, async () => {
      scope.current = 'followup-go';
      await page.fill('[data-testid="chat-input"]', 'go');
      await page.click('[data-testid="chat-send"]');
      await page.waitForTimeout(4000);
      await getChatState(page, 'after-go-4s');
      await shot(page, 'simulate-after-go');
    });

    await runStep('wait-progress-45s', page, async () => {
      scope.current = 'wait-progress-45s';
      for (let i = 0; i < 9; i++) {
        await page.waitForTimeout(5000);
        await getChatState(page, `poll-${(i + 1) * 5}s`);
      }
      await shot(page, 'simulate-after-45s');
    });

    await runStep('tab-switch-check', page, async () => {
      scope.current = 'tab-switch-check';
      await clickByName(page, [/Reasoning|تفكير الوكلاء/i]);
      await page.waitForTimeout(700);
      await getChatState(page, 'tab-reasoning');
      await shot(page, 'simulate-tab-reasoning');

      await clickByName(page, [/Config|الإعدادات/i]);
      await page.waitForTimeout(700);
      await getChatState(page, 'tab-config');
      await shot(page, 'simulate-tab-config');

      await clickByName(page, [/Chat|الدردشة/i]);
      await page.waitForTimeout(700);
      await getChatState(page, 'tab-chat-return');
      await shot(page, 'simulate-tab-chat-return');
    });

    // Evaluate logic issues from observations
    const before = result.observations.find((o) => o.label === 'before-idea');
    const after45 = result.observations.find((o) => o.label === 'poll-45s');
    const afterGo = result.observations.find((o) => o.label === 'after-go-4s');

    if (!before?.hasChatInput) {
      issue('critical', 'Chat input missing on /simulate', { observation: before }, 'open-simulate');
    }

    if (afterGo && afterGo.chatMessagesCount <= before.chatMessagesCount) {
      issue('major', 'No visible chat progression after idea + go', { before, afterGo }, 'followup-go');
    }

    if (after45 && !after45.hasMetricsTotalAgents) {
      issue('major', 'Metrics panel not visible during simulation', { after45 }, 'wait-progress-45s');
    }

    if (after45 && after45.hasChatInput && after45.chatInputDisabled === true) {
      issue('minor', 'Chat input stayed disabled after waiting', { after45 }, 'wait-progress-45s');
    }

    if (result.consoleErrors.length > 0) {
      issue('major', 'Console errors detected during chat-panel flow', { count: result.consoleErrors.length }, 'global');
    }

    if (result.badResponses.some((r) => /\/simulation/.test(r.url) && r.status >= 400)) {
      issue('major', 'Simulation API returned >=400 during flow', { badResponses: result.badResponses.filter((r) => /\/simulation/.test(r.url)) }, 'global');
    }

    result.pass = !result.issues.some((i) => i.severity === 'critical' || i.severity === 'major');

    await context.close();
  } catch (err) {
    issue('critical', 'Chat probe crashed', { error: String(err?.stack || err) }, 'runner');
    result.pass = false;
  } finally {
    result.finishedAt = new Date().toISOString();
    result.summary = {
      steps: result.steps.length,
      failedSteps: result.steps.filter((s) => s.status === 'failed').length,
      critical: result.issues.filter((i) => i.severity === 'critical').length,
      major: result.issues.filter((i) => i.severity === 'major').length,
      minor: result.issues.filter((i) => i.severity === 'minor').length,
      consoleErrors: result.consoleErrors.length,
      failedRequests: result.failedRequests.length,
      badResponses: result.badResponses.length,
      screenshots: result.screenshots.length,
    };

    const reportPath = path.join(OUT_DIR, 'chatprobe-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');

    if (browser) await browser.close();

    console.log(JSON.stringify({ outDir: OUT_DIR, reportPath, pass: result.pass, summary: result.summary }, null, 2));
  }
})();
