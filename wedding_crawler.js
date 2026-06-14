import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export async function crawlWeddingFairs(startUrl, outputDir) {
  console.log(`[WeddingCrawler] Starting crawl for: ${startUrl}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Navigate to the Monetization URL
    console.log(`[WeddingCrawler] Navigating to referral link...`);
    await page.goto(startUrl, { waitUntil: 'networkidle' });
    
    // The page likely redirects to /intros/weddingC/
    console.log(`[WeddingCrawler] Redirected to: ${page.url()}`);
    
    // Wait for the main list or headers to load
    await page.waitForSelector('h2', { timeout: 10000 });

    // 2. Extract Data using Playwright evaluate
    const fairs = await page.evaluate(() => {
      const results = [];
      
      // Regions are typically identified by <h2> tags containing the region name
      const regionHeaders = Array.from(document.querySelectorAll('h2'));
      
      regionHeaders.forEach(header => {
        let regionText = header.innerText.trim();
        // Clean up the region text (e.g., "서울 웨딩박람회 일정" -> "서울")
        if (regionText.includes('웨딩박람회')) {
          regionText = regionText.split('웨딩박람회')[0].trim();
        }
        
        // Find all sibling elements until the next <h2>
        let sibling = header.nextElementSibling;
        while (sibling && sibling.tagName !== 'H2') {
          // If the sibling is a container for items (like ul, div)
          // We will find all 'a' tags inside it
          const links = sibling.tagName === 'A' ? [sibling] : Array.from(sibling.querySelectorAll('a'));
          
          links.forEach(aTag => {
            const link = aTag.href;
            if (!link || link.includes('javascript') || link.includes('#')) return;

            // Extract text contents inside the A tag or its children
            const textContent = aTag.innerText.trim();
            const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
            
            // Usually, lines are [Title, Date, Location]
            if (lines.length >= 3) {
              const title = lines[0];
              const date = lines[1];
              const location = lines.slice(2).join(' ');
              
              // Extract Image URL
              let imageUrl = null;
              const img = aTag.querySelector('img');
              if (img) {
                imageUrl = img.src;
              } else if (sibling.tagName === 'IMG') {
                // Sometimes the image is just a sibling right before the text block
                imageUrl = sibling.src;
              }

              results.push({
                region: regionText,
                title,
                date,
                location,
                link,
                imageUrl
              });
            }
          });
          
          sibling = sibling.nextElementSibling;
        }
      });
      
      // Fallback extraction if the structure is different
      if (results.length === 0) {
         const allLinks = Array.from(document.querySelectorAll('a'));
         allLinks.forEach(aTag => {
            const link = aTag.href;
            if (!link || link.includes('javascript') || link.includes('#')) return;
            const textContent = aTag.innerText.trim();
            const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length >= 3) {
              const img = aTag.querySelector('img');
              results.push({
                region: '전체',
                title: lines[0],
                date: lines[1],
                location: lines.slice(2).join(' '),
                link,
                imageUrl: img ? img.src : null
              });
            }
         });
      }

      return results;
    });

    console.log(`[WeddingCrawler] Extracted ${fairs.length} fairs.`);
    
    // Remove duplicates based on Link
    const uniqueFairsMap = new Map();
    fairs.forEach(fair => {
      if (!uniqueFairsMap.has(fair.link)) {
        uniqueFairsMap.set(fair.link, fair);
      }
    });
    const uniqueFairs = Array.from(uniqueFairsMap.values());
    console.log(`[WeddingCrawler] Total unique fairs after deduplication: ${uniqueFairs.length}`);

    // Group by region for frontend convenience
    const groupedData = { "전체": uniqueFairs };
    uniqueFairs.forEach(fair => {
      if (!groupedData[fair.region]) {
        groupedData[fair.region] = [];
      }
      groupedData[fair.region].push(fair);
    });

    // 3. Save JSON
    const timestamp = Date.now();
    const jsonPath = path.join(outputDir, `wedding_crawl_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(groupedData, null, 2));
    console.log(`[WeddingCrawler] Saved JSON to: ${jsonPath}`);
    
    return groupedData;
  } catch (error) {
    console.error(`[WeddingCrawler] Error during crawl:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Allow running directly from command line
import { fileURLToPath } from 'url';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = 'https://www.replyalba.com/pt/AbeFIn0JsA';
  crawlWeddingFairs(url, './output')
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
