const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let bank;
test.beforeAll(async()=>{bank=(await import(pathToFileURL(path.join(__dirname,'../words.mjs')).href)).words;});

async function enter(page,word){await page.keyboard.type(word);await page.keyboard.press('Enter');}
async function customGame(page,words,clues=true){
  await page.goto('./');await page.getByRole('button',{name:'Teacher setup'}).click();
  await page.locator('.custom-settings summary').click();
  await page.getByLabel('Custom words',{exact:true}).fill(words);
  await page.getByLabel('Session length').selectOption('all');
  if(!clues)await page.getByLabel('Show the thinking clue from the start').uncheck();
  await page.getByRole('button',{name:'Start this session'}).click();
}
test('splash, five-word play, keyboard input, and wrong-length feedback',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading',{name:'Big ideas. One word at a time.'})).toBeVisible();
  await expect(page.locator('.splash-art img')).toBeVisible();
  await page.getByRole('button',{name:'Let’s play'}).click();
  await expect(page.locator('#progress')).toHaveText('Word 1 of 5');
  await page.keyboard.press('Enter');await expect(page.locator('#feedback')).toContainText('Use');
  await page.getByRole('button',{name:'Q',exact:true}).click();
  await expect(page.locator('.board-row').first().locator('.tile').first()).toHaveText('Q');
  await page.keyboard.press('Backspace');await expect(page.locator('.board-row').first().locator('.tile').first()).toHaveText('');
  const clue=await page.locator('#clue-text').textContent();
  const item=bank.find(x=>x.clue===clue);
  expect(item).toBeTruthy();
  await enter(page,item.word);
  await expect(page.locator('#answer-word')).toHaveText(item.word);
  expect(errors).toEqual([]);
});

test('duplicate letters, winning, learning connection, resume, and session results',async({page})=>{
  await customGame(page,'EVIDENCE');
  await enter(page,'EEEEEEEE');
  await expect(page.locator('.board-row').first().locator('.correct')).toHaveCount(3);
  await expect(page.locator('.board-row').first().locator('.absent')).toHaveCount(5);
  await page.reload();await page.getByRole('button',{name:'Continue session'}).click();
  await expect(page.locator('.board-row').first().locator('.correct')).toHaveCount(3);
  await enter(page,'EVIDENCE');
  await expect(page.locator('#answer-word')).toHaveText('EVIDENCE');
  await expect(page.locator('#answer-source')).toContainText('Slide 20');
  await expect(page.locator('#discussion-question')).toBeVisible();
  await page.getByRole('button',{name:'See our results'}).click();
  await expect(page.locator('#summary-solved')).toHaveText('1/1');
  await expect(page.locator('#summary-points')).toHaveText('50');
  await page.getByRole('button',{name:'Back to the splash page'}).click();
  await page.getByRole('button',{name:'View session results'}).click();
  await expect(page.locator('#summary-points')).toHaveText('50');
});

test('six missed guesses reveal the term and award zero points',async({page})=>{
  await customGame(page,'SOLO');
  for(const guess of ['AAAA','BBBB','CCCC','DDDD','EEEE','FFFF'])await enter(page,guess);
  await expect(page.locator('#answer-word')).toHaveText('SOLO');
  await expect(page.locator('#keyboard')).toBeHidden();
  await page.getByRole('button',{name:'See our results'}).click();
  await expect(page.locator('#summary-solved')).toHaveText('0/1');
  await expect(page.locator('#summary-points')).toHaveText('0');
});

test('hints and long custom words fit small screens and projector view',async({page})=>{
  await customGame(page,'CONNECTIVITY',false);
  await expect(page.locator('#clue-text')).toContainText('tucked away');
  await page.getByRole('button',{name:'Show the thinking clue'}).click();
  await expect(page.locator('#clue-text')).toContainText('12-letter');
  await page.getByRole('button',{name:'Reveal the first letter'}).click();
  await expect(page.locator('#extra-hint')).toHaveText('It starts with C.');
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Projector view'}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Projector view'}).click();
  }
  await enter(page,'CONNECTIVITY');await expect(page.locator('#answer-word')).toHaveText('CONNECTIVITY');
});

test('teacher validation and shared pupil links use the same deck in separate browsers',async({page,browser})=>{
  await page.goto('./');await page.getByRole('button',{name:'Teacher setup'}).click();
  await page.locator('.custom-settings summary').click();
  await page.getByLabel('Custom words',{exact:true}).fill('AI, 12345');
  await page.getByRole('button',{name:'Create pupil link'}).click();
  await expect(page.locator('#teacher-status')).toContainText('4–12 letters');
  await page.getByLabel('Custom words',{exact:true}).fill('DEEP, SOLO');
  await page.getByRole('button',{name:'Create pupil link'}).click();
  const url=await page.getByLabel('Pupil link',{exact:true}).inputValue();
  const other=await browser.newContext();const second=await other.newPage();
  await second.goto(url);await second.getByRole('button',{name:'Let’s play'}).click();
  const clue=await second.locator('#clue-text').textContent();
  await page.goto(url);await page.getByRole('button',{name:'Let’s play'}).click();
  await expect(page.locator('#clue-text')).toHaveText(clue);
  await expect(page.getByRole('button',{name:'Teacher setup'})).toBeHidden();
  await expect(page.locator('#progress')).toHaveText('Word 1 of 2');
  await other.close();
});

test('dialog keyboard behavior, color-independent feedback, contrast, and responsive splash',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'How to play'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'How to play'})).toBeFocused();
  await page.getByRole('button',{name:'Contrast',exact:true}).click();
  await expect(page.locator('body')).toHaveClass(/contrast/);
  await page.reload();await expect(page.locator('body')).toHaveClass(/contrast/);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:path.join(__dirname,'../../../.tmp/pblwordle-splash.png'),fullPage:true});
});

test('all five AI words advance without repeats and results count each round once',async({page})=>{
  await page.goto('./');await page.getByRole('button',{name:'Teacher setup'}).click();
  await page.getByLabel('Word set',{exact:true}).selectOption('ai');
  await page.getByLabel('Session length').selectOption('all');
  await page.getByRole('button',{name:'Start this session'}).click();
  const seen=new Set();
  for(let i=0;i<5;i++){
    await expect(page.locator('#progress')).toHaveText(`Word ${i+1} of 5`);
    const clue=await page.locator('#clue-text').textContent();
    const item=bank.find(x=>x.clue===clue);
    expect(seen.has(item.word)).toBe(false);seen.add(item.word);
    await enter(page,item.word);
    await page.getByRole('button',{name:i===4?'See our results':'Next word',exact:true}).click();
  }
  await expect(page.locator('#summary-solved')).toHaveText('5/5');
  await expect(page.locator('#summary-points')).toHaveText('300');
});

test('blocked storage and clipboard still allow play and manual sharing',async({page})=>{
  await page.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new Error('Blocked');};
    Storage.prototype.setItem=()=>{throw new Error('Blocked');};
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied');}}});
  });
  await customGame(page,'DEEP');await enter(page,'DEEP');
  await page.getByRole('button',{name:'See our results'}).click();
  await page.getByRole('button',{name:'Copy results'}).click();
  await expect(page.locator('#copy-results-status')).toContainText('copy it manually');
  await expect(page.getByRole('textbox',{name:'Text to copy'})).toHaveValue(/1\/1 words solved/);
});
