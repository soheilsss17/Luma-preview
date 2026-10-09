// LUMA engine — localized strings (single table shared with Unity: Content/Localization/strings.fa.json).
export class Strings {
  constructor(table) { this.map = {}; for (const e of table.entries) this.map[e.key] = e; this.locale = table.locale; }
  t(key, lang = 'fa') { const e = this.map[key]; return e ? e[lang] || e.fa : `⟨${key}⟩`; }
  has(key) { return key in this.map; }
}
/** Persian digits for any number shown to the child or parent (plan 09: engine-rendered Persian numerals). */
export const faDigits = (v) => String(v).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
