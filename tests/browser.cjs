// Run with Node.js and Playwright installed; uses local Chromium by default.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
(async () => {
 const server=http.createServer((req,res)=>{const asset=req.url==='/assets/korostar-reference.png';res.setHeader('Content-Type',asset?'image/png':'text/html; charset=utf-8');res.end(fs.readFileSync(path.resolve(__dirname,asset?'../assets/korostar-reference.png':'../index.html')))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page = await browser.newPage({viewport:{width:375,height:812},hasTouch:true});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 assert.equal(await page.locator('#puzzle').isVisible(),false);
 await page.locator('#coinStart img').waitFor();
 assert.equal(await page.locator('#coinStart img').evaluate(img=>img.complete && img.naturalWidth>0),true);
 if(process.env.PREVIEW_PATH) await page.screenshot({path:process.env.PREVIEW_PATH,fullPage:true});
 await page.locator('#coinStart img').tap();
 assert.equal(await page.locator('#puzzle').isVisible(),true);
 await page.reload();
 await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('id'),'coinStart');
 await page.keyboard.press('Enter'); assert.equal(await page.locator(':focus').getAttribute('id'),'problemTitle');
 assert.equal(await page.locator('#experiment').isVisible(),false);
 assert.equal(await page.locator('.choices').isVisible(),false);
 assert.match(await page.locator('#question').textContent(),/100枚/);
 await page.locator('#hintBtn').click();assert.match(await page.locator('#hintHeading').textContent(),/ヒント1/);
 await page.locator('#hintNext').click();await page.locator('#hintNext').click();
 assert.match(await page.locator('#hintText').textContent(),/10枚/);
 await page.locator('#hintBtn').click();
 let cases=0;
 for (const [total,h] of [[100,10],[200,16],[50,5]]) {
  await page.locator('#try').click();
  await page.locator('#variantSettings > summary').click();
  await page.locator(`[data-total="${total}"]`).click();
  assert.equal(await page.locator('#experiment').isVisible(),true);
  assert.equal(await page.locator(`[data-total="${total}"]`).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#verificationSetup').textContent(),new RegExp(`${total}枚`));
  assert.match(await page.locator('#question').textContent(),/100枚/);
  for(let n=0;n<=h;n++) {
   await page.locator('#range').evaluate((el,n)=>{el.value=n;el.dispatchEvent(new Event('input'))},n);
   assert.equal(await page.locator('#answer').isVisible(),false);assert.equal(await page.locator('#solutionKey').isVisible(),false);
   assert.equal(+(await page.locator('#left').textContent()),n);
   assert.equal(+(await page.locator('#right').textContent()),h-n);
   assert.equal(await page.locator('.coin.head').count(),n);
   assert.equal(await page.locator('.coin').count(),h);
   // Track each physical coin, not only the total number of heads.
   const beforeCoins=await page.locator('.coin').evaluateAll(coins=>{window.trackedCoins=coins;return coins.map(c=>({face:c.textContent,x:c.getBoundingClientRect().x+scrollX,y:c.getBoundingClientRect().y+scrollY}))});
   await page.locator('#flip').click();
   assert.equal(await page.locator('#solutionKey').isVisible(),true);assert.match(await page.locator('#solutionSteps').textContent(),new RegExp(`最初の表は${h}枚`));
   const afterCoins=await page.locator('.coin').evaluateAll(coins=>coins.map((c,i)=>({face:c.textContent,x:c.getBoundingClientRect().x+scrollX,y:c.getBoundingClientRect().y+scrollY,same:c===window.trackedCoins[i]})));
   afterCoins.forEach((coin,i)=>{assert.equal(coin.face,beforeCoins[i].face==='表'?'裏':'表');assert.equal(coin.x,beforeCoins[i].x);assert.equal(coin.y,beforeCoins[i].y);assert.equal(coin.same,true)});
   assert.equal(+(await page.locator('#left').textContent()),h-n);
   assert.equal(+(await page.locator('#right').textContent()),h-n);
   assert.equal(await page.locator('.coin.head').count(),h-n);
   assert.equal(await page.locator('#answer p').first().isVisible(),false);
   await page.locator('#answer > summary').click();
   assert.equal(await page.locator('#explanation').isVisible(),true);
   assert.equal(await page.locator('#checkStage').textContent(),'裏返す前');
   assert.equal(await page.locator('.check-coin.is-head').count(),n);
   await page.locator('#checkFlip').click(); assert.match(await page.locator('#checkResult').textContent(),/そろいます/);
   assert.equal(await page.locator('.check-coin.is-head').count(),h-n);
   assert.equal(await page.locator('.check-coin.was-tail').count(),h-n);
   assert.equal(+(await page.locator('#checkOtherCount').textContent()),h-n);
   await page.locator('#checkReset').click();
   assert.equal(await page.locator('.check-coin.is-head').count(),n);
   await page.locator('#flip').click();
   assert.equal(+(await page.locator('#left').textContent()),n);
   assert.equal(await page.locator('#answer').isVisible(),false);assert.equal(await page.locator('#solutionKey').isVisible(),false);
   assert.equal(await page.locator('#checkStage').textContent(),'裏返す前');
   assert.deepEqual(await page.locator('.coin').allTextContents(),beforeCoins.map(c=>c.face));
   assert.equal(await page.locator('.coin').evaluateAll(coins=>coins.every((c,i)=>c===window.trackedCoins[i])),true);cases++;
  }
  await page.locator('#reset').click();
  assert.equal(await page.locator('#range').inputValue(),String(Math.floor(h/3)));
  assert.equal(await page.locator(':focus').getAttribute('id'),'selected-coin-0');
  const face=await page.locator('#selected-coin-0').textContent();
  await page.keyboard.press('Enter');assert.notEqual(await page.locator('#selected-coin-0').textContent(),face);
  await page.keyboard.press('Space');assert.equal(await page.locator('#selected-coin-0').textContent(),face);
  await page.locator('#back').click();
 }
 for(const width of [320,375,390,768,1280]) {
  await page.setViewportSize({width,height:800});
  await page.reload();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#start').tap();
  await page.locator('#try').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const b of await page.locator('button:visible').all()) assert.ok((await b.boundingBox()).height>=44);
  await page.locator('#back').click();
 }
 await page.reload(); await page.locator('#start').click();
 assert.equal(await page.locator('#puzzle').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${cases} configurations before/after/reverse; 3 problems; hints/reset; keyboard; 5 viewport widths; no JS errors`);
 await page.setViewportSize({width:375,height:812});
 if(process.env.SCREENSHOT_PATH) await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
