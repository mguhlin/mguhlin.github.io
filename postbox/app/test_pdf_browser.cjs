// Start app.py --no-open --port 8792; run with Playwright available via NODE_PATH.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.POSTBOX_URL||'http://127.0.0.1:8792');
 assert(await page.locator('#exportPdf').isDisabled());
 const wide='<table style="width:4000px"><tr>'+Array.from({length:8},(_,i)=>`<td style="white-space:nowrap">Column${i} ${'LongText'.repeat(25)}</td>`).join('')+'</tr></table>';
 const first=`From: Ada <ada@example.com>\r\nSubject: Wide email\r\nDate: Tue, 3 Nov 2026 10:00:00 -0600\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<h2>First email content</h2><div style="width:4000px;position:fixed">${wide}<pre>${'unbroken'.repeat(80)}</pre><img src="https://example.com/tracker">${'<p>Long message paragraph for page flow.</p>'.repeat(70)}<p>END FIRST EMAIL</p></div>`;
 const second='From: Grace <grace@example.com>\r\nSubject: Plain email\r\nDate: Mon, 2 Nov 2026 10:00:00 -0600\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSecond email body\nEND SECOND EMAIL';
 await page.locator('#files').setInputFiles([{name:'wide.eml',mimeType:'message/rfc822',buffer:Buffer.from(first)},{name:'plain.eml',mimeType:'message/rfc822',buffer:Buffer.from(second)}]);
 await page.locator('#count').filter({hasText:'2 of 2'}).waitFor();await page.locator('#printCurrent').click();assert(await page.locator('#pdfClean').isChecked());await page.locator('#pdfCancel').click();
 await page.locator('#selectVisible').click();await page.locator('#search').fill('subject:Wide');await page.locator('#exportPdf').click();assert.match(await page.locator('#pdfCount').textContent(),/2 email/);
 const pending=page.waitForEvent('popup');await page.locator('#pdfPreview').click();const popup=await pending;await popup.locator('.email').nth(1).waitFor();
 assert.equal(await popup.locator('.email').count(),2);assert.match(await popup.locator('.email').first().textContent(),/Wide email/);assert.equal(await popup.locator('img[src^="https"]').count(),0);
 await popup.emulateMedia({media:'print'});
 const overflow=await popup.locator('.email-body').first().evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert(overflow.scroll<=overflow.client+1,JSON.stringify(overflow));
 await popup.evaluate(()=>{window.print=()=>{window.printCalled=true}});await popup.locator('#printNow').evaluate(el=>el.click());await popup.waitForFunction(()=>window.printCalled);
 await popup.pdf({path:'/tmp/postbox-batch.pdf',preferCSSPageSize:true,displayHeaderFooter:false});await popup.screenshot({path:'/tmp/postbox-pdf-preview.png',fullPage:true});await popup.close();
 await page.locator('#printCurrent').click();await page.locator('#pdfPaper').selectOption('a4');await page.locator('#pdfClean').uncheck();const next=page.waitForEvent('popup');await page.locator('#pdfPreview').click();const single=await next;
 await single.locator('.email').waitFor();assert.equal(await single.locator('.email').count(),1);assert.equal(await single.locator('body').getAttribute('class'),'formatted');await single.close();assert.deepEqual(errors,[]);
 console.log('PDF browser checks passed: single/batch export, hidden selections, default cleanup, formatted/A4 options, table wrapping, print action, multipage PDF.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
