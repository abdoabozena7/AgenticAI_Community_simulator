const { chromium } = require('playwright');
console.log(typeof chromium.launch === 'function' ? 'ok' : 'bad');
