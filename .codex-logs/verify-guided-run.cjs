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
    const data = await response.json();
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

async function workflowId(page) { return page.evaluate(() => localStorage.getItem('activeGuidedWorkflowId')); }
async function token(page) { return page.evaluate(() => localStorage.getItem('agentic_access_token')); }

async function fetchState(page, label) {
  const wid = await workflowId(page);
  const tok = await token(page);
  if (!wid || !tok) { stateLog.push({ label, workflow_id: wid, missing: true }); return null; }
  const data = await page.evaluate(async ({ API, wid, tok }) => {
    const response = await fetch(`${API}/simulation/workflow/state?workflow_id=${encodeURIComponent(wid)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const json = await response.json();
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
    required_fields: json.required_fields,
    review_ready_to_start: json.review?.ready_to_start ?? null,
    review_approved: json.review_approved,
    attached_simulation_id: json.simulation?.attached_simulation_id ?? null,
    draft_context: json.draft_context,
    persona_validation_errors: json.persona_validation_errors,
    guide_messages: json.guide_messages?.slice(-2) || [],
  });
  return json;
}

async function clickByText(page, text) {
  await page.getByRole('button', { name: text, exact: false }).click();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
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

  await loginViaApi(page);
  await page.goto(`${BASE}/simulate`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await fetchState(page, 'after_bootstrap');

  await clickByText(page, 'Internet / general audience');
  await page.waitForTimeout(1200);
  await fetchState(page, 'after_context_scope');

  await page.getByRole('textbox').first().fill('A platform for local businesses to coordinate with neighborhood creators and reach a broader online audience');
  await clickByText(page, 'التالي');
  await page.getByRole('textbox').first().fill('Marketplace');
  await clickByText(page, 'التالي');
  await clickByText(page, 'SMBs');
  await clickByText(page, 'Professionals');
  await clickByText(page, 'التالي');
  await clickByText(page, 'Market Validation');
  await clickByText(page, 'أرسل الحقول');
  await page.waitForTimeout(3000);
  let state = await fetchState(page, 'after_schema_submit');

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    state = await fetchState(page, 'poll');
    if (!state) continue;
    const stage = state.current_stage;
    if (stage === 'review' || stage === 'ready_to_start') break;
    if ((state.current_stage_status === 'awaiting_input' || state.status === 'awaiting_input') && stage !== 'schema_intake') break;
  }

  const finalState = await fetchState(page, 'final');
  const local = await page.evaluate(() => ({ workflowId: localStorage.getItem('activeGuidedWorkflowId'), currentUrl: location.href }));
  await browser.close();
  console.log(JSON.stringify({ requestLog, stateLog, local, finalStage: finalState?.current_stage || state?.current_stage || null, finalState }, null, 2));
})().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
