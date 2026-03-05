const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const notes = [];
  const add = (m) => notes.push(`[${new Date().toISOString()}] ${m}`);

  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Sign In|تسجيل الدخول/i }).first().click();
  const form = page.locator('form').first();
  await form.locator('input[type="text"], input[type="email"]').first().fill('admin');
  await form.locator('input[type="password"]').first().fill('Admin@1234');
  await form.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => /\/dashboard|\/control-center/.test(u.pathname), { timeout: 40000 });
  await page.goto('http://localhost:8080/simulate', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 45000 });

  await page.fill('[data-testid="chat-input"]', 'AI-powered coffee subscription app for GCC customers with hybrid fulfillment');
  await page.click('[data-testid="chat-send"]');
  add('sent idea');

  // Wait for yes/no and answer yes
  await page.waitForFunction(() => /yes or no/i.test(document.body?.innerText || '') || !!Array.from(document.querySelectorAll('button')).find(b => /^Yes$/i.test((b.textContent||'').trim())), { timeout: 60000 });
  const yesBtn = page.getByRole('button', { name: /^Yes$/i }).first();
  if (await yesBtn.count()) {
    await yesBtn.click();
    add('clicked yes');
  } else {
    await page.fill('[data-testid="chat-input"]', 'yes');
    await page.click('[data-testid="chat-send"]');
    add('sent yes');
  }

  // Wait for city prompt and answer
  await page.waitForFunction(() => /enter city/i.test((document.querySelector('[data-testid="chat-input"]')?.getAttribute('placeholder')||'')) || /city/i.test(document.body?.innerText || ''), { timeout: 60000 });
  await page.fill('[data-testid="chat-input"]', 'Riyadh');
  await page.click('[data-testid="chat-send"]');
  add('sent city');

  // Wait for config transition, then click Confirm Data / Start choices path
  await page.waitForTimeout(3000);

  const clickBy = async (r) => {
    const b = page.getByRole('button', { name: r }).first();
    if (await b.count()) {
      await b.click();
      add(`clicked ${r}`);
      return true;
    }
    return false;
  };

  if (!(await clickBy(/Confirm Data|تأكيد/i))) {
    if (await clickBy(/Start choices|How would you like to run|تشغيل/i)) {
      await page.waitForTimeout(500);
    }
    if (!(await clickBy(/Start with default society|default society|الافتراضي/i))) {
      await clickBy(/Create your own society|Build your own society|مجتمعك الخاص/i);
    }
  }

  // Wait up to 45s for non-idle status or metric change
  let progressed = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => {
      const header = Array.from(document.querySelectorAll('header *')).map(e => (e.textContent || '').trim()).filter(Boolean).join(' | ');
      const iterText = document.body?.innerText || '';
      return {
        header,
        iter: /Current Iteration\s*([0-9]+)/i.exec(iterText)?.[1] || null,
        acc: /Acceptance Rate\s*([0-9.]+%)/i.exec(iterText)?.[1] || null,
      };
    });
    add(`poll ${i+1}: header=${s.header.slice(0,140)} iter=${s.iter} acc=${s.acc}`);
    if (/Running|Configuring|يعمل|جار/.test(s.header) || (s.iter && s.iter !== '0')) {
      progressed = true;
      break;
    }
  }

  const final = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const header = Array.from(document.querySelectorAll('header *')).map(e => (e.textContent || '').trim()).filter(Boolean).join(' | ');
    return {
      header: header.slice(0, 500),
      sample: body.slice(0, 1200),
      hasChatInput: !!document.querySelector('[data-testid="chat-input"]'),
      hasReasoning: !!document.querySelector('[data-testid="reasoning-messages"]'),
      hasChatMessages: !!document.querySelector('[data-testid="chat-messages"]'),
    };
  });

  console.log(JSON.stringify({ progressed, notes, final }, null, 2));

  await ctx.close();
  await browser.close();
})();
