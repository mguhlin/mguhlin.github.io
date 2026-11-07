export function evaluateGuess(guess, answer) {
  const result = Array(answer.length).fill('absent');
  const remaining = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < answer.length; i++) {
    if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
      result[i] = 'present';
      remaining[guess[i]]--;
    }
  }
  return result;
}

export function shuffled(items, seed) {
  let value = Number(seed) >>> 0;
  const random = () => {
    value += 0x6D2B79F5;
    let n = value;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function parseCustomWords(text) {
  const tokens = text.toUpperCase().split(/[\s,;]+/).filter(Boolean);
  const invalid = tokens.filter(word => !/^[A-Z]{4,12}$/.test(word));
  return { words: [...new Set(tokens.filter(word => /^[A-Z]{4,12}$/.test(word)))].slice(0,20), invalid, tooMany: new Set(tokens).size > 20 };
}

export function buildDeck(bank, config) {
  const pool = config.custom?.length
    ? config.custom.map(word => bank.find(entry => entry.word === word) || {
      word, topic:'custom', clue:`Your teacher chose this ${word.length}-letter word.`,
      explanation:'A word selected by your teacher for this session.', discuss:'How does this word connect to your learning?',
    })
    : bank.filter(entry => config.topic === 'all' || entry.topic === config.topic);
  return shuffled(pool, config.seed).slice(0, config.count === 'all' ? pool.length : Number(config.count));
}

export function roundPoints(guesses, answer) {
  return guesses.at(-1) === answer ? (7 - guesses.length) * 10 : 0;
}
