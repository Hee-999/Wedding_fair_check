import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Robust Yanolja Crawler Engine
 * Designed to handle domestic stay details pages and promotion pages dynamically.
 */
export async function crawlPage(url, outputDir = './output') {
  console.log(`[Crawler] Starting crawl for: ${url}`);
  
  const userDataDir = path.resolve('./user_data');
  const headless = process.env.HEADLESS === 'true'; // false by default for Windows to bypass Cloudflare
  
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: headless,
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  try {
    // Navigate to page
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Allow extra time for client-side rendering

    let resultMarkdown = '';
    let dataJson = {};

    // Route based on URL pattern
    if (url.includes('/stay/domestic')) {
      console.log('[Crawler] Detected Domestic Stay Detail page');
      const details = await parseStayDetails(page);
      resultMarkdown = formatStayDetailsMarkdown(details, url);
      dataJson = details;
    } else if (url.includes('/promotion')) {
      console.log('[Crawler] Detected Promotion page');
      const promoData = await parsePromotionPage(page);
      resultMarkdown = formatPromotionMarkdown(promoData, url);
      dataJson = promoData;
    } else {
      console.log('[Crawler] Generic Page parsing');
      const genericData = await parseGenericPage(page);
      resultMarkdown = formatGenericMarkdown(genericData, url);
      dataJson = genericData;
    }

    // Save output
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `crawl_${Date.now()}.md`;
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, resultMarkdown, 'utf-8');

    const jsonFilename = `crawl_${Date.now()}.json`;
    const jsonOutputPath = path.join(outputDir, jsonFilename);
    fs.writeFileSync(jsonOutputPath, JSON.stringify(dataJson, null, 2), 'utf-8');

    console.log(`[Crawler] Crawl complete. Saved MD to: ${outputPath}, JSON to: ${jsonOutputPath}`);
    return {
      success: true,
      markdownPath: outputPath,
      jsonPath: jsonOutputPath,
      markdownContent: resultMarkdown,
      data: dataJson
    };

  } catch (error) {
    console.error(`[Crawler] Error crawling page: ${error.message}`);
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * Parser for Stay Details Page
 */
async function parseStayDetails(page) {
  // 1. Stay Name
  // Try to find main stay name header
  const name = await page.evaluate(() => {
    // Try h1, h2, or element containing 'Title' class
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim()) return h1.innerText.trim();
    const titleEl = document.querySelector('[class*="Title"], [class*="title"]');
    return titleEl ? titleEl.innerText.trim() : '이름을 찾을 수 없음';
  });

  // 2. Rating & Review Count
  const ratingInfo = await page.evaluate(() => {
    // Look for text matching "★ 4.8 (1,234)" or similar patterns
    const bodyText = document.body.innerText;
    const ratingRegex = /★\s*([0-5]\.[0-9])/;
    const countRegex = /\(([0-9,]+)\s*(개|건)?\s*(리뷰|평가|후기)\)/;
    
    // Search elements for rate indicator
    const rateEl = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('★'));
    let score = 'N/A';
    let reviewCount = '0';

    if (rateEl) {
      const match = rateEl.innerText.match(/([0-5]\.[0-9])/);
      if (match) score = match[1];
      const countMatch = rateEl.innerText.match(/\(([0-9,]+)\)/);
      if (countMatch) reviewCount = countMatch[1];
    }
    return { score, reviewCount };
  });

  // 3. Address
  const address = await page.evaluate(() => {
    // 1. Search in script tags first for clean JSON address
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const scr of scripts) {
      const text = scr.innerText || '';
      const match = text.match(/"sharedAddress"\s*:\s*\\*"\s*([^"\\]+)/) || 
                    text.match(/"address"\s*:\s*\\*"\s*([^"\\]+)/);
      if (match && match[1]) {
        return match[1].replace(/\\/g, '').trim();
      }
    }
    
    // 2. Fallback to DOM text search if not found in script tags
    const addressRegex = /([가-힣]+(도|시|군|구|읍|면|동|리|로|길)\s*)+(\d+-?\d*)/;
    const elements = Array.from(document.querySelectorAll('span, p, div, a'));
    for (const el of elements) {
      if (el.children.length === 0 && el.innerText) {
        const text = el.innerText.trim();
        if (addressRegex.test(text) && text.length > 10 && text.length < 80 && (text.includes('구 ') || text.includes('시 ') || text.includes('로 ') || text.includes('길 '))) {
          return text;
        }
      }
    }
    return '주소 정보를 찾을 수 없음';
  });

  console.log(`[Crawler] Stay: ${name}, Rating: ${ratingInfo.score}, Address: ${address}`);

  // 4. Room Lists & Prices
  // We need to scroll down to ensure all rooms load
  await scrollToBottom(page);
  await page.waitForTimeout(1000);

  const rooms = await page.evaluate(() => {
    const roomItems = [];
    const h2s = Array.from(document.querySelectorAll('h2'));
    const roomH2s = h2s.filter(h2 => {
      const text = h2.innerText || '';
      return text.length > 0 && !text.includes('최근 후기') && !text.includes('위치') && !text.includes('정보') && !text.includes('리뷰');
    });

    roomH2s.forEach(h2 => {
      const roomName = h2.innerText.trim();
      
      let cardContainer = h2.parentElement;
      while (cardContainer && cardContainer.tagName !== 'BODY') {
        const text = cardContainer.innerText || '';
        if (text.includes('원') && (text.includes('예약하기') || text.includes('대실') || text.includes('숙박') || text.includes('예약마감'))) {
          break;
        }
        cardContainer = cardContainer.parentElement;
      }
      
      if (!cardContainer) return;

      const features = [];
      const containerText = cardContainer.innerText || '';
      const capacityMatch = containerText.match(/기준\s*\d+인\s*\/\s*최대\s*\d+인/);
      if (capacityMatch) {
        features.push(capacityMatch[0]);
      }
      const bedMatch = containerText.match(/(더블|퀸|킹|트윈|싱글|온돌)\s*침대\s*\d+개/);
      if (bedMatch) {
        features.push(bedMatch[0]);
      }

      const allInnerDivs = Array.from(cardContainer.querySelectorAll('div'));
      const optionContainers = allInnerDivs.filter(div => {
        const text = div.innerText || '';
        const hasPrice = /원/.test(text) && /\d/.test(text);
        const hasTime = text.includes('체크인') || text.includes('대실') || text.includes('숙박');
        const childOptions = Array.from(div.querySelectorAll('div')).filter(cd => {
          const ct = cd.innerText || '';
          return /원/.test(ct) && /\d/.test(ct) && (ct.includes('체크인') || ct.includes('대실') || ct.includes('숙박'));
        });
        return hasPrice && hasTime && childOptions.length === 0;
      });

      const options = [];
      optionContainers.forEach(optDiv => {
        const text = optDiv.innerText || '';
        
        let type = '숙박';
        if (text.includes('대실')) {
          type = '대실';
        }
        
        let optionName = '';
        const h4 = optDiv.querySelector('h4');
        if (h4) {
          optionName = h4.innerText.trim();
        } else {
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines[0] && lines[0].length < 20 && !lines[0].includes('원') && !lines[0].includes('체크인') && !lines[0].includes('퇴실')) {
            optionName = lines[0];
          }
        }

        // Clean text by filtering lines and removing times, percentages, and commas
        const optionLines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const filteredLines = optionLines.filter(line => {
          return !line.includes('적립') && !line.includes('머니') && !line.includes('수수료') && !line.includes('객실');
        });
        
        const cleaned = filteredLines.join('\n')
          .replace(/\d{2}:\d{2}/g, '') // remove times
          .replace(/\d+%/g, '')       // remove discount percentages
          .replace(/,/g, '');         // remove commas
        
        const priceMatches = (cleaned.match(/\d+/g) || []).map(Number).filter(n => n >= 1000);
        let originalPrice = null;
        let salePrice = null;

        if (priceMatches.length >= 2) {
          originalPrice = priceMatches[0];
          salePrice = priceMatches[1];
        } else if (priceMatches.length === 1) {
          salePrice = priceMatches[0];
        }

        const times = [];
        const timeMatch = text.match(/\d{2}:\d{2}/g);
        if (timeMatch) {
          times.push(...timeMatch);
        }

        const isSoldOut = text.includes('예약마감') || text.includes('품절') || text.includes('판매종료');

        options.push({
          type: optionName ? `${type} (${optionName})` : type,
          originalPrice,
          salePrice,
          checkIn: times[0] || null,
          checkOut: times[1] || null,
          isSoldOut
        });
      });

      roomItems.push({
        roomName,
        options,
        features
      });
    });

    return roomItems;
  });

  // 5. Click Info Tab to get facilities/rules if available
  let amenities = [];
  let rules = [];
  try {
    // Find a tab containing "정보" or "상세정보"
    const infoTab = await page.locator('button, div, span', { hasText: /^정보$/ }).first();
    if (await infoTab.isVisible()) {
      await infoTab.evaluate(el => el.click());
      await page.waitForTimeout(1000);
      
      // Extract amenities
      amenities = await page.evaluate(() => {
        const list = [];
        const els = document.querySelectorAll('[class*="Facility"], [class*="facility"], [class*="Amenity"], [class*="amenity"]');
        els.forEach(el => {
          if (el.innerText.trim()) list.push(el.innerText.trim());
        });
        // Fallback: search for list items if nothing matches
        if (list.length === 0) {
          document.querySelectorAll('ul li').forEach(li => {
            if (li.innerText.trim().length < 20) list.push(li.innerText.trim());
          });
        }
        return Array.from(new Set(list));
      });

      // Extract rules
      rules = await page.evaluate(() => {
        const list = [];
        const ruleHeaders = Array.from(document.querySelectorAll('h4, h5, strong, [class*="Title"]'))
          .filter(el => el.innerText && (el.innerText.includes('규정') || el.innerText.includes('안내') || el.innerText.includes('이용')));
        
        ruleHeaders.forEach(header => {
          let sibling = header.nextElementSibling;
          const ruleSection = { sectionName: header.innerText.trim(), items: [] };
          while (sibling && !['H4', 'H5', 'STRONG'].includes(sibling.tagName)) {
            if (sibling.innerText.trim()) {
              ruleSection.items.push(sibling.innerText.trim());
            }
            sibling = sibling.nextElementSibling;
          }
          if (ruleSection.items.length > 0) {
            list.push(ruleSection);
          }
        });
        return list;
      });
    }
  } catch (tabErr) {
    console.log(`[Crawler] Info tab parsing skipped or failed: ${tabErr.message}`);
  }

  return {
    name,
    rating: ratingInfo.score,
    reviewsCount: ratingInfo.reviewCount,
    address,
    rooms,
    amenities,
    rules
  };
}

/**
 * Parser for Promotion Page
 */
async function parsePromotionPage(page) {
  console.log(`[Crawler] Scrolling page to load all sections...`);
  
  // Scroll to load all cards
  await scrollToBottom(page);
  await page.waitForTimeout(2000);

  // Extract items for the entire page
  const items = await page.evaluate(() => {
    const itemList = [];
    
    // Extract URLs from the raw React SSR payload embedded in the DOM
    const html = document.documentElement.innerHTML;
    const titleToUrl = {};
    const regex1 = /"title"\s*:\s*"([^"]+)".*?"web"\s*:\s*"(https:\/\/.*?)"/g;
    const regex2 = /\\"title\\"\s*:\s*\\"([^\\"]+)\\".*?\\"web\\"\s*:\s*\\"(https:\/\/.*?)\\"/g;
    let m;
    while ((m = regex1.exec(html)) !== null) {
      titleToUrl[m[1]] = m[2].replace(/\\u0026/g, '&');
    }
    while ((m = regex2.exec(html)) !== null) {
      titleToUrl[m[1]] = m[2].replace(/\\u0026/g, '&');
    }
    
    // Find all valid product cards using robust leaf-node detection
    const allElements = Array.from(document.querySelectorAll('div, a, li'));
    const cardContainers = allElements.filter(el => {
      const text = el.innerText || '';
      const hasDiscount = /%/.test(text);
      const hasPrice = /원/.test(text) && /\d/.test(text);
      const hasImage = el.querySelector('img') !== null;
      if (!hasDiscount || !hasPrice || !hasImage) return false;
      
      // A valid card must have at least 3 lines of text
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 3) return false;
      
      // It is a valid card ONLY IF none of its children also qualify as a full card.
      const hasChildCard = Array.from(el.querySelectorAll('div, a, li')).some(child => {
        const ct = child.innerText || '';
        if (!/%/.test(ct) || !/원/.test(ct) || !/\d/.test(ct)) return false;
        if (child.querySelector('img') === null) return false;
        const childLines = ct.split('\n').filter(l => l.trim().length > 0);
        return childLines.length >= 3 && ct !== text;
      });
      
      // Also reject if it's too big (e.g., covers the whole page)
      const rect = el.getBoundingClientRect();
      return !hasChildCard && rect.height < 800;
    });

    // Find all section headings and their Y coordinates
    // Yanolja uses non-semantic tags (div/p) for headings, so we search by text for the exact sections we need.
    const targetSectionNames = [
      '특가 TOP 3',
      '지금 가기 좋은 호텔',
      '펜션 이번주만 할인',
      '이번주 해외 숙소 특가',
      '해외 패키지 스페셜 특가'
    ];
    
    const headingElements = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const text = el.innerText || '';
        if (el.children.length > 0) return false; // Must be the leaf node containing the text
        
        const isTarget = targetSectionNames.some(name => text.includes(name));
        if (!isTarget) return false;
        
        const isInsideCard = cardContainers.some(card => card.contains(el));
        return !isInsideCard;
      });
      
    const headings = headingElements.map(el => {
      const rect = el.getBoundingClientRect();
      // Find which target name it matched to keep the name clean
      const matchedName = targetSectionNames.find(name => (el.innerText || '').includes(name)) || el.innerText.trim().split('\n')[0];
      return {
        text: matchedName,
        y: rect.top + window.scrollY
      };
    }).filter(h => h.y > 0).sort((a, b) => a.y - b.y);

    const seenTitles = new Set();

    cardContainers.forEach(card => {
      const text = card.innerText || '';
      const rect = card.getBoundingClientRect();
      const cardY = rect.top + window.scrollY;
      
      // Extract title: usually the first non-badge, non-price text block
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      let title = lines[0];
      let discount = null;
      let price = null;
      let description = '';

      lines.forEach((line) => {
        const discountMatch = line.match(/(\d+)%/);
        if (discountMatch) {
          discount = discountMatch[0];
        }
        if (line.includes('원') && /\d/.test(line)) {
          price = line;
        }
      });

      if (!price) return;
      
      if (lines[0].length < 6 && lines[1] && lines[1].length > 4) {
        title = lines[1];
        description = lines.slice(2).join(' | ');
      } else {
        title = lines[0];
        description = lines.slice(1).join(' | ');
      }

      description = description
        .replace(price, '')
        .replace(discount || '', '')
        .replace(/^[| ]+|[| ]+$/g, '')
        .trim();

      if (seenTitles.has(title)) return;
      seenTitles.add(title);

      let imageUrl = null;
      const img = card.querySelector('img');
      if (img) imageUrl = img.src;

      let link = null;
      let currentEl = card;
      while (currentEl && currentEl !== document.body) {
        if (currentEl.tagName === 'A') {
          link = currentEl.href;
          break;
        }
        currentEl = currentEl.parentElement;
      }
      
      if (!link && titleToUrl[title]) {
        link = titleToUrl[title];
      }

      // Assign section by finding the closest heading ABOVE the card
      let section = '일반 특가';
      // Find the heading with the max Y that is still less than or equal to cardY
      // Give it a 150px buffer to account for sticky headers or layout shifts
      const validHeadings = headings.filter(h => h.y <= cardY + 150);
      if (validHeadings.length > 0) {
        section = validHeadings[validHeadings.length - 1].text;
      }

      itemList.push({
        section,
        title,
        discount,
        price,
        description,
        imageUrl,
        link
      });
    });

    return itemList;
  });

  console.log(`[Crawler] Extracted ${items.length} items from the page`);
  return { '전체특가': items };
}

/**
 * Fallback Generic Parser
 */
async function parseGenericPage(page) {
  const pageTitle = await page.title();
  const text = await page.evaluate(() => document.body.innerText);
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.innerText.trim(), href: a.href }))
      .filter(l => l.text && l.href && l.href.startsWith('http'));
  });

  return {
    title: pageTitle,
    textSummary: text.substring(0, 2000), // Sample first 2000 chars
    links: links.slice(0, 50) // Return first 50 links
  };
}

/**
 * Scroll to bottom to trigger lazy loading
 */
async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 150;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 15000) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });
}

/**
 * Format functions to output MD
 */
function formatStayDetailsMarkdown(data, url) {
  let md = `# ${data.name}\n\n`;
  md += `> **원본 링크:** ${url}\n`;
  md += `> **평점:** ★ ${data.rating} (${data.reviewsCount}개 리뷰) | **주소:** ${data.address}\n\n`;
  md += `---\n\n## 🏨 객실 및 옵션 정보\n\n`;

  data.rooms.forEach(room => {
    md += `### 📌 ${room.roomName}\n`;
    if (room.features && room.features.length > 0) {
      md += `* **특징:** ${room.features.join(', ')}\n`;
    }
    md += `\n| 구분 | 판매가 | 원래 가격 | 체크인 | 체크아웃 | 상태 |\n`;
    md += `| --- | --- | --- | --- | --- | --- |\n`;
    room.options.forEach(opt => {
      const origPrice = opt.originalPrice ? `${opt.originalPrice.toLocaleString()}원` : '-';
      const salePrice = opt.salePrice ? `${opt.salePrice.toLocaleString()}원` : '-';
      const status = opt.isSoldOut ? '❌ 예약마감' : '✅ 예약가능';
      md += `| ${opt.type} | **${salePrice}** | ${origPrice} | ${opt.checkIn || '-'} | ${opt.checkOut || '-'} | ${status} |\n`;
    });
    md += `\n`;
  });

  if (data.amenities && data.amenities.length > 0) {
    md += `---\n\n## 🛠️ 편의 시설 및 서비스\n\n`;
    md += data.amenities.map(a => `- ${a}`).join('\n') + '\n\n';
  }

  if (data.rules && data.rules.length > 0) {
    md += `---\n\n## 📋 이용 규정 및 안내\n\n`;
    data.rules.forEach(rule => {
      md += `### 🔹 ${rule.sectionName}\n`;
      md += rule.items.map(item => `- ${item}`).join('\n') + '\n\n';
    });
  }

  return md;
}

function formatPromotionMarkdown(data, url) {
  let md = `# 야놀자 NOL 프로모션 크롤링 결과\n\n`;
  md += `> **원본 링크:** ${url}\n`;
  md += `> **크롤링 시각:** ${new Date().toLocaleString()}\n\n`;

  Object.entries(data).forEach(([tabName, items]) => {
    md += `---\n\n## 🏷️ ${tabName} (${items.length}개 상품)\n\n`;
    
    if (items.length === 0) {
      md += `이 카테고리에는 노출되는 상품 정보가 없습니다.\n\n`;
      return;
    }

    items.forEach((item, index) => {
      md += `### ${index + 1}. ${item.title}\n`;
      if (item.discount) md += `* **할인율:** ${item.discount}\n`;
      md += `* **가격:** ${item.price}\n`;
      if (item.description) md += `* **설명/혜택:** ${item.description}\n`;
      if (item.link) md += `* **상세 보기 링크:** [바로가기](${item.link})\n`;
      if (item.imageUrl) md += `* **대표 이미지:** [이미지 확인](${item.imageUrl})\n`;
      md += `\n`;
    });
  });

  return md;
}

function formatGenericMarkdown(data, url) {
  let md = `# 크롤링 결과: ${data.title}\n\n`;
  md += `> **원본 링크:** ${url}\n\n`;
  md += `## 텍스트 요약\n\`\`\`text\n${data.textSummary}\n\`\`\`\n\n`;
  md += `## 추출된 링크 리스트 (최대 50개)\n`;
  data.links.forEach(l => {
    md += `- [${l.text}](${l.href})\n`;
  });
  return md;
}
