import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export async function crawlWeddingFairs(startUrl, outputDir) {
  console.log(`[WeddingCrawler] Starting crawl for: ${startUrl}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Extract campaign code from startUrl
  // e.g., "https://www.replyalba.com/pt/AbeFIn0JsA" -> "AbeFIn0JsA"
  const urlParts = startUrl.replace(/\/$/, '').split('/');
  const campaignCode = urlParts[urlParts.length - 1];
  console.log(`[WeddingCrawler] Extracted campaign code: ${campaignCode}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const REGIONS = [
    { key: 'seoul', name: '서울' },
    { key: 'gyeonggi', name: '경기' },
    { key: 'incheon', name: '인천' },
    { key: 'busan', name: '부산' },
    { key: 'chungcheong', name: '충청도' },
    { key: 'jeolla', name: '전라도' },
    { key: 'gangwon', name: '강원도' },
    { key: 'gyeongsang', name: '경상도' },
    { key: 'jeju', name: '제주도' }
  ];

  const allFairs = [];
  const groupedData = {};

  try {
    for (const region of REGIONS) {
      const regionUrl = `https://replyalba.com/pt/${campaignCode}/${region.key}/hit`;
      console.log(`[WeddingCrawler] Crawling region [${region.name}] from: ${regionUrl}`);
      
      try {
        await page.goto(regionUrl, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for list or headers to load
        await page.waitForSelector('h2', { timeout: 10000 });

        // Extract using page.evaluate
        const pageFairs = await page.evaluate(() => {
          const results = [];
          const regionHeaders = Array.from(document.querySelectorAll('h2'));
          
          regionHeaders.forEach(header => {
            let regionText = header.innerText.trim();
            if (regionText.includes('웨딩박람회')) {
              regionText = regionText.split('웨딩박람회')[0].trim();
            }
            
            let sibling = header.nextElementSibling;
            while (sibling && sibling.tagName !== 'H2') {
              const links = sibling.tagName === 'A' ? [sibling] : Array.from(sibling.querySelectorAll('a'));
              
              links.forEach(aTag => {
                const link = aTag.href;
                if (!link || link.includes('javascript') || link.includes('#')) return;

                const textContent = aTag.innerText.trim();
                const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
                
                if (lines.length >= 3) {
                  const title = lines[0];
                  const date = lines[1];
                  const location = lines.slice(2).join(' ');
                  
                  let imageUrl = null;
                  const img = aTag.querySelector('img');
                  if (img) {
                    imageUrl = img.src;
                  } else if (sibling.tagName === 'IMG') {
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
          
          // Fallback extraction
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

        // Filter only the current region's fairs from this page
        const regionFairs = pageFairs.filter(f => f.region === region.name);
        console.log(`[WeddingCrawler] Extracted ${regionFairs.length} fairs for [${region.name}].`);
        
        if (regionFairs.length > 0) {
          // Remove duplicates within this region
          const uniqueRegionFairsMap = new Map();
          regionFairs.forEach(fair => {
            if (!uniqueRegionFairsMap.has(fair.link)) {
              uniqueRegionFairsMap.set(fair.link, fair);
            }
          });
          const uniqueRegionFairs = Array.from(uniqueRegionFairsMap.values());
          
          groupedData[region.name] = uniqueRegionFairs;
          allFairs.push(...uniqueRegionFairs);
        } else {
          groupedData[region.name] = [];
        }

      } catch (err) {
        console.error(`[WeddingCrawler] Error crawling region ${region.name}:`, err.message);
        groupedData[region.name] = [];
      }
    }

    // Build the "전체" category from all gathered unique fairs
    const uniqueAllFairsMap = new Map();
    allFairs.forEach(fair => {
      if (!uniqueAllFairsMap.has(fair.link)) {
        uniqueAllFairsMap.set(fair.link, fair);
      }
    });
    const uniqueAllFairs = Array.from(uniqueAllFairsMap.values());
    console.log(`[WeddingCrawler] Total unique fairs across all regions: ${uniqueAllFairs.length}`);
    
    const finalGroupedData = {
      "전체": uniqueAllFairs,
      ...groupedData
    };

    // Save JSON output
    const timestamp = Date.now();
    const jsonPath = path.join(outputDir, `wedding_crawl_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(finalGroupedData, null, 2));
    console.log(`[WeddingCrawler] Saved JSON to: ${jsonPath}`);

    // Copy to frontend static data folder
    const frontendDataDir = path.join(process.cwd(), 'frontend', 'src', 'data');
    if (!fs.existsSync(frontendDataDir)) {
      fs.mkdirSync(frontendDataDir, { recursive: true });
    }
    const frontendJsonPath = path.join(frontendDataDir, 'wedding_fairs.json');
    fs.writeFileSync(frontendJsonPath, JSON.stringify(finalGroupedData, null, 2));
    console.log(`[WeddingCrawler] Saved JSON to frontend for deployment: ${frontendJsonPath}`);
    
    return finalGroupedData;
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
