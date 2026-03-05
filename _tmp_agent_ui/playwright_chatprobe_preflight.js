const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const notes = [];
  const add = (m) => notes.push(`[${new Date().toISOString()}] ${m}`);

  page.on('response', async (res) => {
    const u = res.url();
    if (/\/simulation|\/auth|\/research/.test(u) && res.status() >= 400) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch {}
      add(`bad-response ${res.status()} ${u} ${body}`);
    }
  });

  const clickByName = async (regexList) => {
    for (const r of regexList) {
      const b = page.getByRole('button', { name: r }).first();
      if (await b.count()) {
        await b.click();
        add(`clicked ${r}`);
        return true;
      }
    }
    return false;
  };

  const send = async (text) => {
    const hasInput = await page.locator('[data-testid="chat-input"]').count();
    if (!hasInput) {
      await clickByName([/Chat|الدردشة/i]);
      await page.waitForTimeout(300);
    }
    if (await page.locator('[data-testid="chat-input"]').count()) {
      await page.fill('[data-testid="chat-input"]', text);
      await page.click('[data-testid="chat-send"]');
      add(`sent: ${text}`);
      return true;
    }
    add(`send failed (no input): ${text}`);
    return false;
  };

  const headerState = async () => {
    return await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('header *')).map(e => (e.textContent || '').trim()).filter(Boolean).join(' | ');
      const body = document.body?.innerText || '';
      const roundMatch = body.match(/Round\s*(\d+)\/(\d+)/i);
      return {
        header: h.slice(0, 250),
        round: roundMatch ? `${roundMatch[1]}/${roundMatch[2]}` : null,
        sample: body.slice(0, 500),
      };
    });
  };

  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  await clickByName([/Sign In|تسجيل الدخول/i]);
  const form = page.locator('form').first();
  await form.locator('input[type="text"], input[type="email"]').first().fill('admin');
  await form.locator('input[type="password"]').first().fill('Admin@1234');
  await form.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => /\/dashboard|\/control-center/.test(u.pathname), { timeout: 40000 });
  await page.goto('http://localhost:8080/simulate', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 45000 });

  await send('AI-powered coffee subscription app for GCC customers with hybrid fulfillment');

  // clarification 1
  await page.waitForFunction(() => /yes or no/i.test(document.body?.innerText || '') || !!Array.from(document.querySelectorAll('button')).find(b => /^Yes$/i.test((b.textContent||'').trim())), { timeout: 60000 });
  if (!(await clickByName([/^Yes$/i, /^No$/i]))) {
    await send('yes');
  }

  // city prompt
  await page.waitForFunction(() => /enter city/i.test((document.querySelector('[data-testid="chat-input"]')?.getAttribute('placeholder')||'')) || /city/i.test(document.body?.innerText || ''), { timeout: 60000 });
  await send('Riyadh');

  // config confirm
  await page.waitForTimeout(2500);
  await clickByName([/Confirm Data|تأكيد/i]);
  await page.waitForTimeout(1000);

  // Preflight rounds: click first option-like button until rounds disappear or max attempts
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(3000);
    const st = await headerState();
    add(`poll ${i+1}: header=${st.header} round=${st.round}`);

    const roundExists = !!st.round;
    if (roundExists) {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const candidate = buttons.find((b) => {
          const t = (b.textContent || '').trim();
          if (!t) return false;
          if (/Back to dashboard|Log out|Settings|Chat|Reasoning|Config|Run research|Control actions|Yes|No/i.test(t)) return false;
          const r = b.getBoundingClientRect();
          return r.y > 100 && r.width > 120 && r.height < 70;
        });
        if (candidate) {
          candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return (candidate.textContent || '').trim().slice(0, 80);
        }
        return '';
      });
      if (clicked) {
        add(`clicked preflight option: ${clicked}`);
        continue;
      }
    }

    if (/Running|Configuring|يعمل|جار/.test(st.header)) {
      add('status moved out of idle');
      break;
    }
  }

  const final = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('header *')).map(e => (e.textContent || '').trim()).filter(Boolean).join(' | ').slice(0, 350);
    const b = document.body?.innerText || '';
    const roundMatch = b.match(/Round\s*(\d+)\/(\d+)/i);
    return {
      header: h,
      round: roundMatch ? `${roundMatch[1]}/${roundMatch[2]}` : null,
      sample: b.slice(0, 1400),
      hasChatInput: !!document.querySelector('[data-testid="chat-input"]'),
      hasChatMessages: !!document.querySelector('[data-testid="chat-messages"]'),
      metricTotal: document.querySelector('[data-testid="metric-total-agents"]')?.textContent || '',
      metricAcc: document.querySelector('[data-testid="metric-acceptance-rate"]')?.textContent || '',
    };
  });

  console.log(JSON.stringify({ notes, final }, null, 2));
  await ctx.close();
  await browser.close();
})();
