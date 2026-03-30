const { chromium } = require('playwright');

async function main() {
  console.log(typeof chromium);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
