const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const notes = [];
  const add = (m) => notes.push(`[${new Date().toISOString()}] ${m}`);

  page.on('console', (msg) => { if (msg.type() === 'error') add(`console-error: ${msg.text()}`); });
  page.on('response', async (res) => {
    const u = res.url();
    if (/\/simulation|\/research|\/auth/.test(u) && res.status() >= 400) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch {}
      add(`bad-response ${res.status()} ${u} ${body}`);
    }
  });

  const ensureChatInput = async () => {
    const hasInput = await page.locator('[data-testid="chat-input"]').count();
    if (hasInput) return true;
    const chatTab = page.getByRole('button', { name: /Chat|ÇáÏÑÏÔÉ/i }).first();
    if (await chatTab.count()) {
      await chatTab.click();
      await page.waitForTimeout(400);
    }
    return (await page.locator('[data-testid="chat-input"]').count()) > 0;
  };

  const sendText = async (txt) => {
    const ok = await ensureChatInput();
    if (!ok) {
      add(`sendText skipped (input missing): ${txt}`);
      return false;
    }
    await page.fill('[data-testid="chat-input"]', txt);
    await page.click('[data-testid="chat-send"]');
    add(`sent text: ${txt}`);
    return true;
  };

  await page.goto('http://127.0.0.1:8082/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Sign In|ÊÓÌíá ÇáÏÎæá/i }).first().click();
  const form = page.locator('form').first();
  await form.locator('input[type="text"], input[type="email"]').first().fill('admin');
  await form.locator('input[type="password"]').first().fill('Admin@1234');
  await form.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => /\/dashboard|\/control-center/.test(u.pathname), { timeout: 40000 });
  await page.goto('http://127.0.0.1:8082/simulate', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 45000 });

  await sendText('AI-powered coffee subscription app for GCC customers with hybrid fulfillment');

  const clickIf = async (regex) => {
    const b = page.getByRole('button', { name: regex }).first();
    if (await b.count()) {
      await b.click();
      add(`clicked button ${regex}`);
      return true;
    }
    return false;
  };

  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(3000);
    const snap = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const input = document.querySelector('[data-testid="chat-input"]');
      const statusText = Array.from(document.querySelectorAll('header *'))
        .map((e) => (e.textContent || '').trim())
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500);
      return {
        body: body.slice(0, 700),
        placeholder: input ? (input.getAttribute('placeholder') || '') : '',
        statusText,
      };
    });

    add(`poll ${i + 1}: placeholder='${snap.placeholder}' status='${snap.statusText.slice(0,120)}' body='${snap.body.replace(/\s+/g,' ').slice(0,180)}'`);

    if (/yes or no/i.test(snap.body) || /choose yes or no/i.test(snap.placeholder)) {
      if (await clickIf(/^Yes$/i)) continue;
      await sendText('yes');
      continue;
    }

    if (/enter country/i.test(snap.placeholder)) {
      await sendText('Saudi Arabia');
      continue;
    }
    if (/enter city/i.test(snap.placeholder)) {
      await sendText('Riyadh');
      continue;
    }

    if (/running|configuring|íÚãá|ÌÇÑ/.test(snap.statusText)) {
      add('Detected non-idle status in header');
      break;
    }
  }

  const final = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    return {
      url: location.href,
      statusText: Array.from(document.querySelectorAll('header *')).map((e) => (e.textContent || '').trim()).filter(Boolean).join(' | ').slice(0, 500),
      bodySample: body.slice(0, 1200),
      hasChatInput: !!document.querySelector('[data-testid="chat-input"]'),
      hasChatMessages: !!document.querySelector('[data-testid="chat-messages"]'),
      hasReasoningMessages: !!document.querySelector('[data-testid="reasoning-messages"]'),
      totalAgentsText: document.querySelector('[data-testid="metric-total-agents"]')?.textContent || '',
      acceptanceText: document.querySelector('[data-testid="metric-acceptance-rate"]')?.textContent || '',
    };
  });

  console.log(JSON.stringify({ notes, final }, null, 2));

  await ctx.close();
  await browser.close();
})();

