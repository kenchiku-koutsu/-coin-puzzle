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
 let cases=0;
 for (const [total,h] of [[100,10],[200,16],[50,5]]) {
  await page.locator(`[data-total="${total}"]`).click();
  assert.equal(await page.locator(`[data-total="${total}"]`).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#question').textContent(),new RegExp(`${total}枚`));
  await page.locator('#hintBtn').click(); assert.equal(await page.locator('#hint').isVisible(),true);
  await page.locator('#hintBtn').click(); assert.equal(await page.locator('#hint').isVisible(),false);
  await page.locator('#try').click();
  for(let n=0;n<=h;n++) {
   await page.locator('#range').evaluate((el,n)=>{el.value=n;el.dispatchEvent(new Event('input'))},n);
   assert.equal(await page.locator('#answer').isVisible(),false);
   assert.equal(+(await page.locator('#left').textContent()),n);
   assert.equal(+(await page.locator('#right').textContent()),h-n);
   assert.equal(await page.locator('.coin.head').count(),n);
   assert.equal(await page.locator('.coin').count(),h);
   await page.locator('#flip').click();
   assert.equal(+(await page.locator('#left').textContent()),h-n);
   assert.equal(+(await page.locator('#right').textContent()),h-n);
   assert.equal(await page.locator('.coin.head').count(),h-n);
   assert.equal(await page.locator('#answer p').first().isVisible(),false);
   await page.locator('#answer summary').click();
   assert.equal(await page.locator('#explanation').isVisible(),true);
   await page.locator('#flip').click();
   assert.equal(+(await page.locator('#left').textContent()),n);
   assert.equal(await page.locator('#answer').isVisible(),false);cases++;
  }
  await page.locator('#reset').click();
  assert.equal(await page.locator('#range').inputValue(),String(Math.floor(h/3)));
  assert.equal(await page.locator(':focus').getAttribute('id'),'range');
  await page.keyboard.press('Home');assert.equal(await page.locator('#range').inputValue(),'0');
  assert.equal(await page.locator('#decrease').isDisabled(),true);
  await page.keyboard.press('End');assert.equal(await page.locator('#range').inputValue(),String(h));
  assert.equal(await page.locator('#increase').isDisabled(),true);
  await page.locator('#decrease').click();assert.equal(await page.locator('#range').inputValue(),String(h-1));
  await page.locator('#increase').click();assert.equal(await page.locator('#range').inputValue(),String(h));
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
