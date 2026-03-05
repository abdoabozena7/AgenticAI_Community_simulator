const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const notes = [];
  const add = (m) => { notes.push(`[${new Date().toISOString()}] ${m}`); };

  page.on('console', (msg) => { if (msg.type() === 'error') add(`console-error: ${msg.text()}`); });
  page.on('response', async (res) => {
    const u = res.url();
    if (/\/simulation|\/research|\/auth/.test(u) && res.status() >= 400) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch {}
      add(`bad-response ${res.status()} ${u} ${body}`);
    }
  });

  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Sign In|تسجيل الدخول/i }).first().click();
  const form = page.locator('form').first();
  await form.locator('input[type="text"], input[type="email"]').first().fill('admin');
  await form.locator('input[type="password"]').first().fill('Admin@1234');
  await form.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => /\/dashboard|\/control-center/.test(u.pathname), { timeout: 40000 });
  await page.goto('http://localhost:8080/simulate', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 40000 });

  await page.fill('[data-testid="chat-input"]', 'AI-powered coffee subscription app for GCC customers with hybrid fulfillment');
  await page.click('[data-testid="chat-send"]');
  add('sent idea');

  const clickIf = async (nameRegex) => {
    const b = page.getByRole('button', { name: nameRegex }).first();
    if (await b.count()) {
      await b.click();
      add(`clicked button ${nameRegex}`);
      return true;
    }
    return false;
  };

  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(3000);
    const snap = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const input = document.querySelector('[data-testid="chat-input"]');
      const status = Array.from(document.querySelectorAll('header span,header div,header button')).map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 30);
      return {
        body: body.slice(0, 600),
        hasYesBtn: !!Array.from(document.querySelectorAll('button')).find((b) => /yes/i.test((b.textContent || '').trim())),
        hasNoBtn: !!Array.from(document.querySelectorAll('button')).find((b) => /no/i.test((b.textContent || '').trim())),
        placeholder: input ? (input.getAttribute('placeholder') || '') : '',
        status,
      };
    });

    add(`poll ${i + 1}: placeholder='${snap.placeholder}' body='${snap.body.replace(/\s+/g,' ').slice(0,140)}'`);

    if (/yes or no/i.test(snap.body) || snap.hasYesBtn || snap.hasNoBtn || /Choose yes or no/i.test(snap.placeholder)) {
      if (await clickIf(/^No$/i)) continue;
      await page.fill('[data-testid="chat-input"]', 'no');
      await page.click('[data-testid="chat-send"]');
      add('answered no via input');
      continue;
    }

    if (/enter country/i.test(snap.placeholder)) {
      await page.fill('[data-testid="chat-input"]', 'Saudi Arabia');
      await page.click('[data-testid="chat-send"]');
      add('answered country');
      continue;
    }
    if (/enter city/i.test(snap.placeholder)) {
      await page.fill('[data-testid="chat-input"]', 'Riyadh');
      await page.click('[data-testid="chat-send"]');
      add('answered city');
      continue;
    }

    // fallback for multi-choice cards: click first small action button not top nav
    const progressed = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button')).filter((b) => {
        const t = (b.textContent || '').trim();
        if (!t) return false;
        if (/Back to dashboard|Log out|Settings|Chat|Reasoning|Config|Run research|Run search/i.test(t)) return false;
        const r = b.getBoundingClientRect();
        return r.width < 220 && r.height < 60 && r.y > 80;
      });
      if (candidates.length) {
        candidates[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return (candidates[0].textContent || '').trim();
      }
      return '';
    });
    if (progressed) add(`clicked fallback option '${progressed}'`);

    const statusText = snap.status.join(' | ');
    if (/Running|Configuring|يعمل|جار/.test(statusText)) {
      add(`status indicates progress: ${statusText}`);
      break;
    }
  }

  const final = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    return {
      url: location.href,
      bodySample: body.slice(0, 1200),
      chatCount: document.querySelector('[data-testid="chat-messages"]')?.querySelectorAll('*').length || 0,
      reasoningCount: document.querySelector('[data-testid="reasoning-messages"]')?.querySelectorAll('*').length || 0,
      hasMetricA: !!document.querySelector('[data-testid="metric-total-agents"]'),
      hasMetricB: !!document.querySelector('[data-testid="metric-acceptance-rate"]'),
    };
  });

  console.log(JSON.stringify({ notes, final }, null, 2));
  await ctx.close();
  await browser.close();
})();
