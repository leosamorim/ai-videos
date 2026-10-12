const normalize = (s) => s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');

/** Word alignment is evidence for review, not a judge of factual correctness or prosody. */
export function compareSpeech(expected, actual) {
  const a = expected.map((w) => normalize(w.text)), b = actual.map((w) => normalize(w.text));
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const issues = []; let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) issues.push({ kind: 'substitution', expected: expected[i - 1], heard: actual[j - 1] });
      i--; j--;
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) { issues.push({ kind: 'missing', expected: expected[--i] }); }
    else { issues.push({ kind: 'extra', heard: actual[--j] }); }
  }
  return { expected_words: a.length, recognized_words: b.length, edit_distance: dp[a.length][b.length], word_error_rate: dp[a.length][b.length] / Math.max(1, a.length), issues: issues.reverse() };
}
