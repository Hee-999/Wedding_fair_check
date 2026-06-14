const { chromium } = require('playwright');
const fs = require('fs');

async function inspectStructure() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to promotion page...');
  await page.goto('https://nol.yanolja.com/promotion', { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait for the tab to appear
  await page.waitForTimeout(2000);
  
  console.log('Clicking "추천특가" tab...');
  const tabElement = await page.locator('span, button, a', { hasText: /^추천특가$/ }).first();
  if (await tabElement.isVisible()) {
    await tabElement.click();
  }
  
  // Scroll down a bit to load items
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(2000);
  
  console.log('Extracting DOM structure...');
  const structure = await page.evaluate(() => {
    // Let's find all headings that might be section titles
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong'));
    
    return headings.map(h => {
      const text = h.innerText.trim();
      if (!text || text.length > 50 || text.includes('%') || text.includes('원')) return null;
      
      // Let's look at the parent structure
      let parent = h.parentElement;
      let depth = 0;
      let siblingsCount = 0;
      let hasCards = false;
      
      // Try to find if this heading's parent or ancestor contains price/discount items
      while (parent && parent.tagName !== 'BODY' && depth < 5) {
        siblingsCount = parent.children.length;
        const textContent = parent.innerText || '';
        if (textContent.includes('%') && textContent.includes('원') && textContent.length > text.length + 10) {
          hasCards = true;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      
      if (hasCards) {
        // Find actual card elements within this container
        // We look for elements that have both % and 원, but don't contain other elements that have both
        const allDescendants = Array.from(parent.querySelectorAll('div, a'));
        const cards = allDescendants.filter(el => {
          const t = el.innerText || '';
          const hasDiscount = /%/.test(t);
          const hasPrice = /원/.test(t) && /\d/.test(t);
          if (!hasDiscount || !hasPrice) return false;
          
          // Must be a leaf node regarding cards (no child contains BOTH discount and price)
          const childCards = Array.from(el.children).filter(child => {
             const ct = child.innerText || '';
             return /%/.test(ct) && /원/.test(ct) && /\d/.test(ct);
          });
          
          return childCards.length === 0 && t !== parent.innerText;
        }).map(c => c.innerText.replace(/\n/g, ' | '));
        
        return {
          heading: text,
          containerTag: parent.tagName,
          depth,
          cardsFound: cards.length,
          sampleCards: cards.slice(0, 2)
        };
      }
      
      return null;
    }).filter(Boolean);
  });
  
  fs.writeFileSync('dom_structure.json', JSON.stringify(structure, null, 2));
  console.log('Saved to dom_structure.json');
  
  await browser.close();
}

inspectStructure().catch(console.error);
