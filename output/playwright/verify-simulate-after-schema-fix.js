const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const BASE = 'http://127.0.0.1:5173';
  const API = 'http://127.0.0.1:8000';
  const IDEA = 'A platform for local businesses to coordinate with neighborhood creators and reach a broader online audience';
  const CATEGORY = 'Marketplace';
  const TARGETS = ['SMBs', 'Professionals'];
  const GOALS = ['Market Validation', 'Growth Strategy'];
  const outPath = path.join(process.cwd(), 'output', 'playwright', 'verify-simulate-after-schema-fix-result.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const trace = [];
  const startedAt = Date.now();
  const interesting = [
    '/simulation/workflow/start',
    '/simulation/workflow/context',
    '/simulation/workflow/schema',
    '/simulation/workflow/clarification',
    '/simulation/workflow/approve',
    '/simulation/start',
    '/simulation/state',
    '/simulation/workflow/state',
    '/simulation/workflow/attach-simulation',
  ];

  page.on('response', async (response) => {
    const url = response.url();
    if (!interesting.some((p) => url.includes(p))) return;
    let body = null;
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    trace.push({
      ts: Date.now() - startedAt,
      method: response.request().method(),
      url,
      status: response.status(),
      body,
    });
  });

  const result = { trace };

  try {
    const login = await page.request.post(`${API}/auth/login`, {
      data: { username: 'user', password: 'User@1234' },
    });
    result.loginStatus = login.status();
    const tokens = await login.json();
    result.loginKeys = Object.keys(tokens || {});

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ access, refresh }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('agentic_access_token', access || '');
      localStorage.setItem('agentic_refresh_token', refresh || '');
      localStorage.removeItem('activeGuidedWorkflowId');
      localStorage.removeItem('pendingIdea');
      localStorage.removeItem('pendingAutoStart');
      localStorage.removeItem('dashboardIdea');
      localStorage.removeItem('postLoginRedirect');
      window.dispatchEvent(new Event('agentic-auth-changed'));
    }, { access: tokens.access_token, refresh: tokens.refresh_token });

    await page.goto(`${BASE}/simulate`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bodyText = async () => await page.locator('body').innerText();
    result.initialBody = (await bodyText()).slice(0, 3000);

    const maybeIdeaBox = page.locator('textarea').first();
    if (await maybeIdeaBox.isVisible().catch(() => false)) {
      const current = await bodyText();
      if (!/Choose the context scope first|Now in:\s*Context scope/i.test(current)) {
        await maybeIdeaBox.fill(IDEA);
        const startButton = page.getByRole('button', { name: /Start research and persona preparation|Run mandatory pipeline/i }).first();
        if (await startButton.isVisible().catch(() => false)) {
          await startButton.click();
          await page.waitForTimeout(1500);
        }
      }
    }

    await page.waitForFunction(() => /Choose the context scope first|Now in:\s*Context scope/i.test(document.body.innerText), null, { timeout: 20000 });
    result.afterStartBody = (await bodyText()).slice(0, 3000);

    let scopeButton = page.getByRole('button', { name: /Internet/i }).first();
    if (!(await scopeButton.isVisible().catch(() => false))) {
      scopeButton = page.locator('.guided-chat-choice-button').first();
    }
    await scopeButton.click();
    await page.waitForTimeout(1500);

    await page.waitForFunction(() => /Collect only missing fields|Now in:\s*Schema intake/i.test(document.body.innerText), null, { timeout: 20000 });
    result.afterScopeBody = (await bodyText()).slice(0, 3000);

    for (let i = 0; i < 8; i++) {
      const text = await bodyText();
      if (/What is the core idea\?/i.test(text)) {
        await page.locator('textarea').first().fill(IDEA);
        await page.waitForTimeout(300);
      } else if (/What category fits the idea\?/i.test(text)) {
        await page.locator('input').first().fill(CATEGORY);
        await page.waitForTimeout(300);
      } else if (/Who is the primary target audience\?/i.test(text)) {
        for (const label of TARGETS) {
          const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
          if (await btn.isVisible().catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(150);
          }
        }
      } else if (/What do you want from this simulation\?/i.test(text)) {
        for (const label of GOALS) {
          const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
          if (await btn.isVisible().catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(150);
          }
        }
      }

      const submit = page.getByRole('button', { name: /Submit fields|Continue/i }).first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
        break;
      }
      const next = page.getByRole('button', { name: /^Next$/i }).first();
      if (await next.isVisible().catch(() => false)) {
        await next.click();
        await page.waitForTimeout(500);
        continue;
      }
      break;
    }

    await page.waitForTimeout(2500);
    result.afterSchemaBody = (await bodyText()).slice(0, 3000);
    const workflowId = await page.evaluate(() => localStorage.getItem('activeGuidedWorkflowId'));
    result.workflowId = workflowId;

    let stateAfterSchema = null;
    if (workflowId) {
      const stateResp = await page.request.get(`${API}/simulation/workflow/state?workflow_id=${encodeURIComponent(workflowId)}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      result.stateAfterSchemaStatus = stateResp.status();
      stateAfterSchema = await stateResp.json();
    }
    result.stateAfterSchema = stateAfterSchema;

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const txt = await bodyText();
      const continueBtn = page.getByRole('button', { name: /Continue to simulation/i }).first();
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click().catch(() => {});
      }
      if (trace.some((item) => item.url.includes('/simulation/start'))) break;
      if (/Persona generation is blocked: Persona source is unresolved/i.test(txt)) break;
      if (/Now in:\s*Schema intake/i.test(txt) && i > 2) break;
    }

    let finalState = null;
    if (workflowId) {
      const stateResp = await page.request.get(`${API}/simulation/workflow/state?workflow_id=${encodeURIComponent(workflowId)}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      result.finalStateStatus = stateResp.status();
      finalState = await stateResp.json();
    }
    result.finalState = finalState;
    result.finalBody = (await bodyText()).slice(0, 4000);
    result.finalUrl = page.url();
  } catch (error) {
    result.error = String(error && error.stack || error);
    try {
      result.errorBody = await page.locator('body').innerText();
    } catch {}
  } finally {
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
  }
})();
