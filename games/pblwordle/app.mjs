import { words, topics } from './words.mjs';
import { evaluateGuess, parseCustomWords, buildDeck, roundPoints } from './engine.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'pblwordle-session-v1';
const statusNames = {correct:'right spot',present:'in the word, different spot',absent:'no unmatched copy in the word'};
const symbols = {correct:'✓',present:'↔',absent:'×'};
const priority = {absent:1,present:2,correct:3};
const params = new URLSearchParams(location.search);
const pupil = params.get('mode') === 'student';
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const customFromUrl = parseCustomWords(params.get('words') || '');
let config = {
  topic: Object.hasOwn(topics, params.get('deck')) ? params.get('deck') : 'all',
  count: ['5','10','all'].includes(params.get('rounds')) ? params.get('rounds') : '5',
  clues: params.get('clues') !== '0',
  seed: /^\d{1,10}$/.test(params.get('seed') || '') ? Number(params.get('seed')) >>> 0 : newSeed(),
  custom: customFromUrl.words,
};
let session = null;
let deck = [];
let current = '';
let guesses = [];
let hintLevel = 0;
let over = false;
let saved = readSaved();
let activeScreen = 'splash';
let lastDialogTrigger = null;

function store(name, value) { try { localStorage.setItem(name,JSON.stringify(value)); } catch {} }
function read(name) { try { return JSON.parse(localStorage.getItem(name)); } catch { return null; } }
function fingerprint(value) { return JSON.stringify([value.topic,value.count,value.clues,value.seed,value.custom]); }
function readSaved() {
  const value = read(storageKey);
  if (!value || !value.config || !Array.isArray(value.history) || !Array.isArray(value.guesses)) return null;
  const c = value.config;
  if (!Object.hasOwn(topics,c.topic) || !['5','10','all'].includes(c.count) || typeof c.clues !== 'boolean' || !Number.isInteger(c.seed) || !Array.isArray(c.custom) || c.custom.length > 20 || c.custom.some(w => !/^[A-Z]{4,12}$/.test(w))) return null;
  const entries = buildDeck(words,c);
  if (!Number.isInteger(value.index) || value.index < 0 || value.index > entries.length || value.history.length !== value.index) return null;
  if (value.history.some((round,i) => round.word !== entries[i]?.word || !Array.isArray(round.guesses) || round.guesses.length < 1 || round.guesses.length > 6 || round.guesses.some(g => !new RegExp(`^[A-Z]{${round.word.length}}$`).test(g)))) return null;
  const answer = entries[value.index]?.word;
  if (value.guesses.length > 6 || value.guesses.some(g => !answer || !new RegExp(`^[A-Z]{${answer.length}}$`).test(g))) return null;
  if (pupil && fingerprint(c) !== fingerprint(config)) return null;
  value.hintLevel = [0,1,2].includes(value.hintLevel) ? value.hintLevel : 0;
  return value;
}

function persist() {
  if (!session) return;
  session.guesses = [...guesses];
  session.hintLevel = hintLevel;
  store(storageKey, session);
  saved = session;
  $('resume-button').hidden = false;
}

function setScreen(name) {
  activeScreen = name;
  for (const screen of ['splash','game','summary']) $(screen).hidden = screen !== name;
  if (name !== 'game') document.body.classList.remove('projector');
  if (name !== 'game') $('celebration').replaceChildren();
  $('projector-button').setAttribute('aria-pressed',document.body.classList.contains('projector'));
  window.scrollTo({top:0,behavior:'instant'});
}

function score() { return session.history.reduce((total, round) => total + roundPoints(round.guesses, round.word),0); }
function entry() { return deck[session.index]; }
function roundFinished() { return guesses.length >= 6 || guesses.at(-1) === entry()?.word; }

function startSession(nextConfig) {
  config = {...nextConfig,custom:[...nextConfig.custom]};
  deck = buildDeck(words,config);
  if (!deck.length) return;
  session = {config, index:0, history:[], guesses:[], hintLevel:0};
  guesses = []; current = ''; hintLevel = 0; over = false;
  persist();
  setScreen('game');
  renderRound();
  $('game-title').focus({preventScroll:true});
}

function resume() {
  if (!saved) return;
  session = structuredClone(saved);
  config = session.config;
  deck = buildDeck(words,config);
  guesses = [...session.guesses]; hintLevel = session.hintLevel; current = '';
  if (session.index === deck.length) return showSummary();
  setScreen('game');
  renderRound();
}

function renderRound() {
  const item = entry();
  if (!item) return showSummary();
  over = roundFinished();
  $('game-topic').textContent = config.custom.length ? 'Your teacher’s word collection' : topics[config.topic];
  $('progress').textContent = `Word ${session.index + 1} of ${deck.length}`;
  $('progress-fill').style.width = `${session.index / deck.length * 100}%`;
  $('score').textContent = `${score() + (over ? roundPoints(guesses,item.word) : 0)} points`;
  $('word-details').textContent = `${item.word.length} letters • ${over ? 'Round complete' : `${6-guesses.length} ${6-guesses.length === 1 ? 'guess' : 'guesses'} left`}`;
  $('clue-text').textContent = config.clues || hintLevel >= 1 || over ? item.clue : 'The clue is tucked away. Use the letters first, or ask for a hint.';
  $('hint-button').hidden = over;
  $('hint-button').textContent = !config.clues && hintLevel === 0 ? 'Show the thinking clue' : hintLevel < 2 ? 'Reveal the first letter' : 'Hint revealed';
  $('hint-button').disabled = hintLevel >= 2;
  $('extra-hint').hidden = hintLevel < 2 || over;
  $('extra-hint').textContent = `It starts with ${item.word[0]}.`;
  $('clue-footnote').hidden = over;
  $('learning-reveal').hidden = !over;
  $('round-actions').hidden = !over;
  $('next-button').textContent = session.index + 1 === deck.length ? 'See our results' : 'Next word';
  $('keyboard').hidden = over;
  if (over) renderLearning();
  drawBoard();
  drawKeyboard();
}

function drawBoard() {
  const item = entry();
  const board = $('board');
  board.replaceChildren();
  board.style.setProperty('--letters',item.word.length);
  board.setAttribute('aria-label',`Six-guess board. ${item.word.length} letters per word.`);
  for (let row=0; row<6; row++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'board-row';
    rowEl.setAttribute('role','group');
    rowEl.setAttribute('aria-label',`Guess ${row+1}${row === guesses.length && !over ? ', current guess' : ''}`);
    const text = guesses[row] || (row === guesses.length && !over ? current : '');
    const evaluation = guesses[row] ? evaluateGuess(guesses[row],item.word) : [];
    for (let column=0;column<item.word.length;column++) {
      const tile = document.createElement('span');
      const state = evaluation[column];
      tile.className = `tile${text[column] ? ' filled' : ''}${state ? ` ${state} evaluated` : ''}${row === guesses.length && !over && column === current.length ? ' current' : ''}`;
      tile.textContent = text[column] || '';
      tile.setAttribute('role','img');
      tile.setAttribute('aria-label',`${column+1}: ${text[column] || 'empty'}${state ? `, ${statusNames[state]}` : ''}`);
      if (state) {
        const marker = document.createElement('small');marker.textContent = symbols[state];marker.setAttribute('aria-hidden','true');tile.append(marker);
      }
      rowEl.append(tile);
    }
    board.append(rowEl);
  }
}

function keyStates() {
  const map = {};
  for (const guess of guesses) evaluateGuess(guess,entry().word).forEach((state,index)=>{
    const letter = guess[index];
    if (!map[letter] || priority[state] > priority[map[letter]]) map[letter] = state;
  });
  return map;
}

function drawKeyboard() {
  const map = keyStates();
  for (const button of $('keyboard').querySelectorAll('button')) {
    const letter = button.dataset.key;
    const state = map[letter];
    button.className = `key${letter.length > 1 ? ' wide' : ''}${state ? ` ${state}` : ''}`;
    button.setAttribute('aria-label',letter === 'Backspace' ? 'Delete letter' : `${letter}${state ? `, ${statusNames[state]}` : ''}`);
    button.querySelector('small')?.remove();
    if (state) { const marker=document.createElement('small');marker.textContent=symbols[state];marker.setAttribute('aria-hidden','true');button.append(marker); }
  }
}

function buildKeyboard() {
  for (const letters of ['QWERTYUIOP'.split(''),'ASDFGHJKL'.split(''),['Enter',...'ZXCVBNM','Backspace']]) {
    const row = document.createElement('div');row.className = 'key-row';
    for (const letter of letters) {
      const button = document.createElement('button');
      button.type='button';button.dataset.key=letter;button.textContent=letter === 'Backspace' ? 'Delete' : letter;
      button.className=`key${letter.length > 1 ? ' wide' : ''}`;button.setAttribute('aria-label',letter === 'Backspace' ? 'Delete letter' : letter);
      row.append(button);
    }
    $('keyboard').append(row);
  }
}

function announce(message) { $('feedback').textContent=message; }

function handleKey(key) {
  if (activeScreen !== 'game' || over || document.querySelector('dialog[open]')) return;
  if (/^[a-z]$/i.test(key)) {
    if (current.length < entry().word.length) { current += key.toUpperCase();announce('');drawBoard(); }
  } else if (key === 'Backspace') { current=current.slice(0,-1);announce('');drawBoard(); }
  else if (key === 'Enter') submitGuess();
}

function submitGuess() {
  const answer = entry().word;
  if (current.length !== answer.length) return announce(`Use ${answer.length} letters. You have ${current.length}.`);
  if (guesses.includes(current)) return announce('You already tried that guess. Try another combination.');
  const submitted=current;
  guesses.push(submitted);current='';
  persist();renderRound();
  const evaluation = evaluateGuess(submitted,answer);
  if (over) {
    const won = submitted === answer;
    announce(won ? `You found ${answer}! ${roundPoints(guesses,answer)} points. Explore the learning connection, then continue.` : `The word was ${answer}. Explore the learning connection, then continue.`);
    if (won) celebrate();
    $('next-button').focus({preventScroll:true});
  } else {
    const correct=evaluation.filter(state=>state==='correct').length;
    const present=evaluation.filter(state=>state==='present').length;
    announce(`${correct} ${correct===1?'letter':'letters'} in the right spot; ${present} to move. ${6-guesses.length} guesses left.`);
  }
}

function renderLearning() {
  const item=entry();
  $('round-result').textContent=guesses.at(-1) === item.word ? `Aha! +${roundPoints(guesses,item.word)} points` : 'A new word for your toolkit';
  $('answer-word').textContent=item.word;
  $('answer-explanation').textContent=item.explanation;
  $('answer-source').textContent=item.slide ? `Slide ${item.slide}: ${item.heading}` : 'Teacher-selected custom word';
  $('discussion-question').textContent=item.discuss;
}

function advance() {
  if (!over) return;
  session.history.push({word:entry().word,guesses:[...guesses]});
  session.index++;
  guesses=[];current='';hintLevel=0;over=false;
  persist();announce('');
  if (session.index === deck.length) return showSummary();
  renderRound();window.scrollTo({top:0,behavior:'instant'});
  $('game-title').focus({preventScroll:true});
}

function showSummary() {
  setScreen('summary');
  const solved=session.history.filter(round=>round.guesses.at(-1)===round.word).length;
  $('summary-solved').textContent=`${solved}/${deck.length}`;
  $('summary-points').textContent=score();
  $('summary-message').textContent=`You explored ${deck.length} ${deck.length === 1 ? 'idea' : 'ideas'}. The best part is what you do with them next.`;
  $('review-list').replaceChildren();
  deck.forEach((item,index)=>{
    const article=document.createElement('article');article.className='review-entry';
    const heading=document.createElement('h3');
    const won=session.history[index]?.guesses.at(-1)===item.word;
    heading.textContent=`${item.word} — ${won ? 'solved' : 'explored'}`;
    const explanation=document.createElement('p');explanation.textContent=item.explanation;
    const source=document.createElement('small');source.textContent=item.slide ? `Slide ${item.slide}: ${item.heading}` : 'Teacher-selected custom word';
    article.append(heading,explanation,source);$('review-list').append(article);
  });
  $('copy-results-status').textContent='';
  $('summary-title').setAttribute('tabindex','-1');$('summary-title').focus({preventScroll:true});
  $('resume-button').textContent='View session results';
}

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors=['#6945bf','#08766d','#ffcf4a','#e66345'];
  $('celebration').replaceChildren();
  for(let i=0;i<26;i++){
    const piece=document.createElement('i');piece.className='confetti';piece.style.left=`${Math.random()*100}%`;piece.style.background=colors[i%4];piece.style.animationDelay=`${Math.random()*.25}s`;$('celebration').append(piece);
  }
  setTimeout(()=>$('celebration').replaceChildren(),2100);
}

function openDialog(id,trigger) {
  lastDialogTrigger=trigger;
  $(id).showModal();
}

function openTeacher(trigger) {
  $('topic-select').value=config.topic;$('round-count').value=config.count;
  $('clues-checkbox').checked=config.clues;$('custom-words').value=config.custom.join(', ');
  $('teacher-status').textContent='';$('share-link-panel').hidden=true;$('copy-link-status').textContent='';
  openDialog('teacher-dialog',trigger);
}

function teacherConfig() {
  const parsed=parseCustomWords($('custom-words').value);
  if(parsed.invalid.length || parsed.tooMany){
    $('teacher-status').textContent=parsed.invalid.length ? 'Use words with 4–12 letters only. Remove numbers, punctuation, and shorter or longer words.' : 'Please use no more than 20 different words.';
    $('custom-words').focus();return null;
  }
  $('teacher-status').textContent='';
  return {topic:$('topic-select').value,count:$('round-count').value,clues:$('clues-checkbox').checked,seed:newSeed(),custom:parsed.words};
}

async function copyText(text,status) {
  try { await navigator.clipboard.writeText(text);status.textContent='Copied!'; }
  catch {
    status.textContent='Copy isn’t available here. Select the text below and copy it manually.';
    let field=status.parentElement.querySelector('[data-manual-copy]');
    if(!field){field=document.createElement('textarea');field.dataset.manualCopy='';field.readOnly=true;field.setAttribute('aria-label','Text to copy');status.after(field);}
    field.value=text;field.hidden=false;field.focus();field.select();
  }
}

function initialize() {
  buildKeyboard();
  $('teacher-button').hidden=pupil;
  $('game-title').setAttribute('tabindex','-1');
  $('resume-button').hidden=!saved;
  if(saved && saved.index === buildDeck(words,saved.config).length) $('resume-button').textContent='View session results';
  if(pupil){
    const count=buildDeck(words,config).length;
    $('session-description').textContent=`Your teacher picked ${count} ${count===1?'word':'words'}. Everyone with this link gets the same challenge.`;
    $('play-note').textContent=`${count} ${count===1?'word':'words'}. Six guesses each. No timer. Room to think.`;
  }
  if(params.has('words') && (customFromUrl.invalid.length || customFromUrl.tooMany)) $('play-note').textContent='Some shared words were invalid. Only words with 4–12 letters are used; if none remain, the showcase set is used.';
  const contrast=read('pblwordle-contrast') === true;
  document.body.classList.toggle('contrast',contrast);$('contrast-button').setAttribute('aria-pressed',contrast);
  $('play-button').addEventListener('click',()=>startSession(pupil ? config : {...config,seed:newSeed()}));
  $('resume-button').addEventListener('click',resume);
  $('home-button').addEventListener('click',()=>{setScreen('splash');$('resume-button').hidden=!saved;});
  $('summary-home-button').addEventListener('click',()=>setScreen('splash'));
  $('again-button').addEventListener('click',()=>startSession({...config,seed:newSeed()}));
  $('help-button').addEventListener('click',event=>openDialog('help-dialog',event.currentTarget));
  $('about-button').addEventListener('click',event=>openDialog('about-dialog',event.currentTarget));
  $('teacher-button').addEventListener('click',event=>openTeacher(event.currentTarget));
  $('contrast-button').addEventListener('click',()=>{
    const enabled=document.body.classList.toggle('contrast');$('contrast-button').setAttribute('aria-pressed',enabled);store('pblwordle-contrast',enabled);
  });
  $('projector-button').addEventListener('click',()=>{
    const enabled=document.body.classList.toggle('projector');$('projector-button').setAttribute('aria-pressed',enabled);
  });
  $('keyboard').addEventListener('click',event=>{
    const button=event.target.closest('button[data-key]');if(button)handleKey(button.dataset.key);
  });
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.target.closest('input,textarea,select,dialog'))return;
    // Enter/Space on a focused action must keep the browser's native button behavior.
    if(event.key === 'Enter' && event.target.closest('button:not([data-key])'))return;
    if(activeScreen==='game' && !over && (/^[a-z]$/i.test(event.key) || ['Enter','Backspace'].includes(event.key))){
      event.preventDefault();
      // Typing after a toolbar click returns input to the board, while Enter
      // on an explicitly focused action still keeps its native behavior.
      if(/^[a-z]$/i.test(event.key) && event.target.closest('button:not([data-key])'))$('game-title').focus({preventScroll:true});
      handleKey(event.key);
    }
  });
  $('hint-button').addEventListener('click',()=>{
    hintLevel=!config.clues && hintLevel===0 ? 1 : 2;persist();renderRound();
    announce(hintLevel===1 ? 'The thinking clue is now shown.' : `Hint: the word starts with ${entry().word[0]}.`);
  });
  $('next-button').addEventListener('click',advance);
  $('teacher-form').addEventListener('submit',event=>{
    event.preventDefault();const chosen=teacherConfig();if(!chosen)return;lastDialogTrigger=null;$('teacher-dialog').close();startSession(chosen);
  });
  $('create-link-button').addEventListener('click',()=>{
    const chosen=teacherConfig();if(!chosen)return;
    const url=new URL(location.pathname,location.origin);
    for(const [key,value] of Object.entries({mode:'student',deck:chosen.topic,rounds:chosen.count,clues:chosen.clues?'1':'0',seed:String(chosen.seed)}))url.searchParams.set(key,value);
    if(chosen.custom.length)url.searchParams.set('words',chosen.custom.join(','));
    $('pupil-link').value=url.href;$('share-link-panel').hidden=false;$('copy-link-status').textContent='';
    $('pupil-link').focus();$('pupil-link').select();
  });
  $('copy-link-button').addEventListener('click',()=>copyText($('pupil-link').value,$('copy-link-status')));
  $('copy-results-button').addEventListener('click',()=>{
    const solved=session.history.filter(round=>round.guesses.at(-1)===round.word).length;
    copyText(`PBL Wordle\n${solved}/${deck.length} words solved | ${score()} points\nBig ideas, one word at a time.\nhttps://mguhlin.github.io/games/pblwordle/`,$('copy-results-status'));
  });
  for(const dialog of document.querySelectorAll('dialog')){
    dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
    dialog.addEventListener('close',()=>{if(lastDialogTrigger && !lastDialogTrigger.hidden)lastDialogTrigger.focus({preventScroll:true});});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();}});
  }
}
initialize();
