const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8000';
const creds = { username: 'user', password: 'User@1234' };
const requestLog = [];
const stateLog = [];

async function loginViaApi(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async ({ API, creds }) => {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, data };
    localStorage.setItem('agentic_access_token', data.access_token || '');
    localStorage.setItem('agentic_refresh_token', data.refresh_token || '');
    localStorage.removeItem('activeGuidedWorkflowId');
    localStorage.removeItem('pendingIdea');
    localStorage.removeItem('pendingAutoStart');
    localStorage.removeItem('dashboardIdea');
    localStorage.removeItem('postLoginRedirect');
    localStorage.removeItem('pendingSimulationDraft');
    return { ok: true };
  }, { API, creds });
  if (!result.ok) throw new Error(`login failed: ${JSON.stringify(result)}`);
}

async function workflowId(page) {
  return page.evaluate(() => localStorage.getItem('activeGuidedWorkflowId'));
}

async function token(page) {
  return page.evaluate(() => localStorage.getItem('agentic_access_token'));
}

async function fetchWorkflowState(page, label) {
  const wid = await workflowId(page);
  const tok = await token(page);
  if (!wid || !tok) {
    stateLog.push({ label, workflow_id: wid, missing: true });
    return null;
  }
  const data = await page.evaluate(async ({ API, wid, tok }) => {
    const response = await fetch(`${API}/simulation/workflow/state?workflow_id=${encodeURIComponent(wid)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }, { API, wid, tok });
  const json = data.json || {};
  stateLog.push({
    label,
    workflow_id: wid,
    status_code: data.status,
    workflow_status: json.status,
    current_stage: json.current_stage,
    current_stage_status: json.current_stage_status,
    required_fields: json.required_fields || [],
    review_ready_to_start: json.review?.ready_to_start ?? null,
    review_approved: json.review_approved ?? null,
    attached_simulation_id: json.simulation?.attached_simulation_id ?? null,
    draft_context: json.draft_context || null,
    persona_validation_errors: json.persona_validation_errors || [],
    guide_messages: Array.isArray(json.guide_messages) ? json.guide_messages.slice(-2) : [],
  });
  return json;
}

async function fetchSimulationState(page, simulationId) {
  const tok = await token(page);
  if (!simulationId || !tok) return null;
  return page.evaluate(async ({ API, simulationId, tok }) => {
    const response = await fetch(`${API}/simulation/state?simulation_id=${encodeURIComponent(simulationId)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }, { API, simulationId, tok });
}

async function clickTextButton(page, patterns) {
  for (const pattern of patterns) {
    const locator = page.getByRole('button', { name: pattern });
    if (await locator.count()) {
      await locator.first().click();
      return String(pattern);
    }
  }
  throw new Error(`button not found: ${patterns.map(String).join(', ')}`);
}

async function fillFirstTextbox(page, value) {
  const box = page.getByRole('textbox').first();
  await box.click();
  await box.fill(value);
}

async function waitForStageAdvance(page, disallowedStage, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const state = await fetchWorkflowState(page, 'poll');
    if (state && state.current_stage !== disallowedStage) return state;
  }
  return fetchWorkflowState(page, 'poll_timeout');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const log = (...args) => console.error('[verify]', ...args);

  page.on('requestfinished', async (req) => {
    const url = req.url();
    if (!url.startsWith(API)) return;
    const resp = await req.response();
    requestLog.push({ method: req.method(), url, status: resp ? resp.status() : null });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!url.startsWith(API)) return;
    requestLog.push({ method: req.method(), url, failed: req.failure()?.errorText || 'failed' });
  });

  log('login');
  await loginViaApi(page);
  log('goto simulate');
  await page.goto(`${BASE}/simulate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const bootstrapState = await fetchWorkflowState(page, 'after_bootstrap');
  log('after bootstrap', bootstrapState?.current_stage, bootstrapState?.current_stage_status);

  await clickTextButton(page, [/Internet \/ general audience/i]);
  log('clicked context');
  await page.waitForTimeout(1500);
  const afterContext = await waitForStageAdvance(page, 'context_scope', 20000);
  log('after context', afterContext?.current_stage, afterContext?.current_stage_status);

  if (afterContext?.current_stage === 'schema_intake') {
    log('schema step 1');
    await fillFirstTextbox(page, 'A platform for local businesses to coordinate with neighborhood creators and reach a broader online audience');
    await clickTextButton(page, [/التالي/i, /next/i]);

    log('schema step 2');
    await fillFirstTextbox(page, 'Marketplace');
    await clickTextButton(page, [/التالي/i, /next/i]);

    log('schema step 3');
    await clickTextButton(page, [/SMBs/i]);
    await clickTextButton(page, [/Professionals/i]);
    await clickTextButton(page, [/التالي/i, /next/i]);

    log('schema submit');
    await clickTextButton(page, [/Market Validation/i]);
    await clickTextButton(page, [/أرسل الحقول/i, /submit fields/i, /send fields/i]);
    await page.waitForTimeout(2500);
    await fetchWorkflowState(page, 'after_schema_submit');
  }

  const deadline = Date.now() + 90000;
  let finalState = await fetchWorkflowState(page, 'post_schema_initial');
  while (Date.now() < deadline) {
    if (!finalState) {
      await page.waitForTimeout(2000);
      finalState = await fetchWorkflowState(page, 'poll_missing');
      continue;
    }
    const stage = finalState.current_stage;
    if (stage === 'ready_to_start') break;
    if (finalState.simulation?.attached_simulation_id) break;
    if (stage === 'review') break;
    if (finalState.current_stage_status === 'awaiting_input' && !['context_scope', 'schema_intake'].includes(stage)) break;
    log('poll', stage, finalState.current_stage_status);
    await page.waitForTimeout(3000);
    finalState = await fetchWorkflowState(page, 'poll');
  }
  log('final stage', finalState?.current_stage, finalState?.current_stage_status);

  const wid = await workflowId(page);
  const tok = await token(page);
  const local = await page.evaluate(() => ({
    workflowId: localStorage.getItem('activeGuidedWorkflowId'),
    currentUrl: location.href,
  }));

  let simulationState = null;
  if (finalState?.simulation?.attached_simulation_id) {
    simulationState = await fetchSimulationState(page, finalState.simulation.attached_simulation_id);
  }

  await browser.close();
  console.log(JSON.stringify({
    requestLog,
    stateLog,
    local,
    workflowId: wid,
    hasToken: Boolean(tok),
    finalStage: finalState?.current_stage || null,
    finalState,
    simulationState,
  }, null, 2));
})().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
