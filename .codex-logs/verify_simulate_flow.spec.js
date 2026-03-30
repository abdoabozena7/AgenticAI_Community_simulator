const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(process.cwd(), '.codex-logs', 'verify_simulate_flow_result.json');
const BASE_URL = 'http://127.0.0.1:5173';
const API_URL = 'http://127.0.0.1:8000';

const IDEA = 'A platform for local businesses to coordinate with neighborhood creators and reach a broader online audience';

async function poll(fn, predicate, timeoutMs = 30000, intervalMs = 1000) {
  const started = Date.now();
  let lastValue;
  while (Date.now() - started < timeoutMs) {
    lastValue = await fn();
    if (predicate(lastValue)) {
      return lastValue;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return lastValue;
}

test('verify simulate flow', async ({ page, request }) => {
  test.setTimeout(180000);

  const network = [];
  const seen = new Set();

  const shouldTrack = (url) => (
    url.includes('/simulation/workflow')
    || url.includes('/simulation/start')
    || url.includes('/simulation/state')
  );

  page.on('requestfinished', async (req) => {
    const url = req.url();
    if (!shouldTrack(url)) return;
    const response = await req.response().catch(() => null);
    let responseJson = null;
    if (response && (url.includes('/simulation/start') || url.includes('/simulation/workflow/start'))) {
      try {
        responseJson = await response.json();
      } catch {
        responseJson = null;
      }
    }
    const key = `${req.method()} ${url} ${response ? response.status() : 'unknown'} ${network.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    network.push({
      type: 'finished',
      method: req.method(),
      url,
      status: response ? response.status() : null,
      response_json: responseJson,
    });
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!shouldTrack(url)) return;
    network.push({
      type: 'failed',
      method: req.method(),
      url,
      error: req.failure()?.errorText || 'requestfailed',
    });
  });

  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: { username: 'user', password: 'User@1234' },
    timeout: 15000,
  });
  const loginJson = await loginResponse.json();
  const accessToken = loginJson.access_token;
  const refreshToken = loginJson.refresh_token;

  await page.addInitScript(([access, refresh]) => {
    localStorage.setItem('agentic_access_token', access);
    localStorage.setItem('agentic_refresh_token', refresh);
    localStorage.removeItem('activeGuidedWorkflowId');
    localStorage.removeItem('pendingIdea');
    localStorage.removeItem('pendingAutoStart');
    localStorage.removeItem('dashboardIdea');
    localStorage.removeItem('postLoginRedirect');
    localStorage.removeItem('pendingSimulationDraft');
  }, [accessToken, refreshToken]);

  const readWorkflowId = async () => page.evaluate(() => localStorage.getItem('activeGuidedWorkflowId'));

  const getWorkflowState = async (workflowId) => {
    if (!workflowId) return null;
    const response = await request.get(`${API_URL}/simulation/workflow/state?workflow_id=${encodeURIComponent(workflowId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
      failOnStatusCode: false,
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return {
      http_status: response.status(),
      workflow_id: workflowId,
      status: json?.status || null,
      current_stage: json?.current_stage || null,
      required_fields: json?.required_fields || null,
      draft_context: json?.draft_context || null,
      persona_generation_debug: json?.persona_generation_debug || null,
      persona_validation_errors: json?.persona_validation_errors || null,
      review: json?.review || null,
      review_approved: json?.review_approved || null,
      simulation: json?.simulation || null,
      verification: json?.verification || null,
    };
  };

  const states = [];
  const captureState = async (label) => {
    const workflowId = await readWorkflowId();
    const snapshot = await getWorkflowState(workflowId);
    states.push({ label, snapshot });
    return snapshot;
  };

  await page.goto(`${BASE_URL}/simulate`, { waitUntil: 'domcontentloaded' });

  const bootstrapState = await poll(
    async () => captureState('after_bootstrap'),
    (value) => Boolean(value && value.workflow_id && value.current_stage),
    30000,
    1000,
  );

  await page.getByRole('button', { name: /Internet \/ general audience/i }).click();

  const contextState = await poll(
    async () => captureState('after_context_scope'),
    (value) => value?.current_stage === 'schema_intake',
    30000,
    1000,
  );

  await page.getByRole('textbox').fill(IDEA);
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('textbox').fill('Marketplace');
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'Professionals' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'Market Validation' }).click();
  await page.getByRole('button', { name: 'أرسل الحقول' }).click();

  const afterSchema = await poll(
    async () => captureState('after_schema_submit'),
    (value) => Boolean(value && value.current_stage && value.current_stage !== 'schema_intake'),
    30000,
    1500,
  );

  let postSchemaState = afterSchema;
  let reviewReached = false;
  let readyToStartReached = false;
  let simulationStartFired = false;
  let simulationState = null;

  if (afterSchema?.current_stage === 'review') {
    reviewReached = true;
    await page.getByRole('button', { name: 'اعتمد المراجعة' }).click().catch(() => undefined);
    postSchemaState = await poll(
      async () => captureState('after_review'),
      (value) => Boolean(value && value.current_stage && value.current_stage !== 'review'),
      30000,
      1500,
    );
  }

  if (postSchemaState?.current_stage === 'ready_to_start') {
    readyToStartReached = true;
    await page.getByRole('button', { name: 'تابع إلى المحاكاة' }).click().catch(() => undefined);
    await poll(
      async () => {
        await captureState('after_ready_to_start');
        simulationStartFired = network.some((entry) => entry.method === 'POST' && entry.url.includes('/simulation/start') && entry.status === 200);
        return simulationStartFired;
      },
      (value) => value === true,
      20000,
      1000,
    );
  }

  if (simulationStartFired) {
    const simulationStartEntry = network.find((entry) => entry.method === 'POST' && entry.url.includes('/simulation/start') && entry.status === 200);
    const simulationId = simulationStartEntry?.response_json?.simulation_id || null;
    if (simulationId) {
      const response = await request.get(`${API_URL}/simulation/state?simulation_id=${encodeURIComponent(simulationId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
        failOnStatusCode: false,
      });
      try {
        simulationState = await response.json();
      } catch {
        simulationState = null;
      }
    }
  }

  const result = {
    network,
    states,
    bootstrapState,
    contextState,
    afterSchema,
    postSchemaState,
    reviewReached,
    readyToStartReached,
    simulationStartFired,
    simulationState,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
});
