import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGuess,buildDeck,parseCustomWords,roundPoints,shuffled} from '../engine.mjs';
import {words,topics} from '../words.mjs';

test('duplicate letters use only the unmatched copies of the target',()=>{
  assert.deepEqual(evaluateGuess('ALLEY','APPLE'),['correct','present','absent','present','absent']);
  assert.deepEqual(evaluateGuess('SPEED','SHEEP'),['correct','present','correct','correct','absent']);
  assert.deepEqual(evaluateGuess('EEEEEEEE','EVIDENCE'),['correct','absent','absent','absent','correct','absent','absent','correct']);
  assert.deepEqual(evaluateGuess('CCCCC','CRANE'),['correct','absent','absent','absent','absent']);
});
test('slide vocabulary is unique, playable, and fully attributed',()=>{
  assert.equal(words.length,32);
  assert.equal(new Set(words.map(x=>x.word)).size,32);
  for(const entry of words){
    assert.match(entry.word,/^[A-Z]{4,12}$/);
    assert.ok(Object.hasOwn(topics,entry.topic));
    assert.ok(entry.slide>=1 && entry.slide<=42);
    for(const key of ['heading','clue','explanation','discuss'])assert.ok(entry[key].length>10);
  }
});
test('shared seeds reproduce the same unique topic deck and respect session length',()=>{
  const config={topic:'thinking',count:'5',seed:1042,custom:[]};
  const a=buildDeck(words,config),b=buildDeck(words,config);
  assert.deepEqual(a,b);
  assert.equal(a.length,5);
  assert.ok(a.every(x=>x.topic==='thinking'));
  assert.equal(new Set(a.map(x=>x.word)).size,5);
  assert.equal(buildDeck(words,{...config,topic:'ai',count:'10'}).length,5);
  assert.equal(buildDeck(words,{...config,topic:'all',count:'all'}).length,32);
  assert.notDeepEqual(shuffled(words,1),shuffled(words,2));
});
test('custom words validate, deduplicate, cap counts, and retain known slide connections',()=>{
  assert.deepEqual(parseCustomWords('evidence, EVIDENCE;solo transfer').words,['EVIDENCE','SOLO','TRANSFER']);
  assert.deepEqual(parseCustomWords('AI, 1234, ice-cream, ABCDEFGHIJKLM').invalid,['AI','1234','ICE-CREAM','ABCDEFGHIJKLM']);
  assert.ok(parseCustomWords(Array.from({length:21},(_,i)=>'WORD'+String.fromCharCode(65+i)).join(',')).tooMany);
  const deck=buildDeck(words,{topic:'all',count:'all',seed:1,custom:['EVIDENCE','CURIOUS']});
  assert.equal(deck.length,2);
  assert.equal(deck.find(x=>x.word==='EVIDENCE').slide,20);
  assert.equal(deck.find(x=>x.word==='CURIOUS').topic,'custom');
});
test('points depend on a solved round and cannot include unfinished guesses',()=>{
  assert.equal(roundPoints(['DEEP'],'DEEP'),60);
  assert.equal(roundPoints(['AAAA','BBBB','CCCC','DDDD','EEEE','DEEP'],'DEEP'),10);
  assert.equal(roundPoints(['AAAA'],'DEEP'),0);
  assert.equal(roundPoints([],'DEEP'),0);
});
