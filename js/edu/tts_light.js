// LUMA — the «light» TTS marking rule for Persian VO (user decision, round 13: full vocalization made the voice read worse).
// tts_fa = text_fa as written, plus ONLY:
//   • a kasra on the last letter of a word for a spoken ezafe that is not written («کنارِ میدان», «پشتِ چاه»);
//   • «ـهٔ» (U+0654) for an ezafe after a silent ه («دربارهٔ»);
//   • a sukun on the last letter of a word where the voice would otherwise add a false ezafe («کتابْ قرض», «زنگْ دارد»);
//   • a vowel on a known homograph (HOMOGRAPHS: «پُر» not «پَر», «گُل» not «گِل», «نُه» not «نه»).
// Nothing else: no fatha/damma/tashdid/tanvin, no sukun or kasra inside a word. At most MAX_MARKS marks per line.
export const HOMOGRAPHS = ['پُر', 'گُل', 'نُه'];            // نُه = nine (not «نه» = no), SOC-01
export const MAX_MARKS = 4;
const MARK = /[\u064B-\u0652\u0654\u0670]/;
const SEP = /[\s\u200c.،؛!؟«»]/;
export const stripMarks = (t) => t.replace(/[\u064B-\u0652\u0654\u0670]/g, '');

/** → list of problems (empty = the line follows the light rule). */
export function lightIssues(t) {
  const out = [];
  const ch = [...t];
  let marks = 0;
  for (let i = 0; i < ch.length; i++) {
    if (!MARK.test(ch[i])) continue;
    marks++;
    const endOfWord = i + 1 >= ch.length || SEP.test(ch[i + 1]);
    let s = i; while (s > 0 && !SEP.test(ch[s - 1])) s--;
    let e = i; while (e + 1 < ch.length && !SEP.test(ch[e + 1])) e++;
    const word = ch.slice(s, e + 1).join('');
    const m = ch[i];
    if (HOMOGRAPHS.includes(word)) continue;
    if ((m === '\u0650' || m === '\u0652') && endOfWord) continue;                 // ezafe kasra / anti-ezafe sukun on the last letter
    if (m === '\u0654' && ch[i - 1] === 'ه' && endOfWord) continue;              // ـهٔ
    out.push(`«${word}» ${m === '\u0652' ? 'sukun' : m === '\u0650' ? 'kasra' : 'mark U+' + m.codePointAt(0).toString(16)} inside the word`);
  }
  if (marks > MAX_MARKS) out.push(`${marks} marks (> ${MAX_MARKS}): too heavy`);
  return out;
}
