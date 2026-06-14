import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const userDataDir = path.resolve('./user_data_test');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://nol.yanolja.com/promotion', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  const searchStr = '통영 스탠포드 호텔앤리조트';
  let idx = html.indexOf(searchStr);
  const results = [];
  while (idx !== -1) {
    results.push(html.substring(Math.max(0, idx - 300), Math.min(html.length, idx + 400)));
    idx = html.indexOf(searchStr, idx + 1);
  }
  
  console.log(JSON.stringify(results, null, 2));
  await context.close();
}

main();
