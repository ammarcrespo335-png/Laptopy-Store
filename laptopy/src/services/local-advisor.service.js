import { compareLaptops, num, toGB } from '../../shared/specs.js';

/**
 * Rule-based advisor used when the AI provider is not configured or temporarily fails.
 * It understands Arabic and English, reads a budget, detects the intended use and
 * ranks the real stock accordingly. It never invents specs or prices.
 */

const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** [id, trigger, [Arabic name, English name], [Arabic tip, English tip]] */
const USES = [
  ['dev', /برمج|programm|coding|coder|developer|software|مبرمج|كود/i, ['برمجة', 'programming'],
    ['معالج قوي بأكتر من نواة، ورام 16 جيجا على الأقل، وهارد SSD سريع', 'a strong multi-core CPU, at least 16GB RAM and a fast SSD']],
  ['game', /جيم|العاب|ألعاب|لعب|gaming|\bgames?\b|\bfps\b/i, ['جيمنج', 'gaming'],
    ['كارت شاشة مخصص (GPU)، وشاشة بتردد عالي، وتبريد كويس', 'a dedicated GPU, a high refresh-rate screen and good cooling']],
  ['design', /تصميم|مونتاج|فوتوشوب|جرافيك|\bdesign|\bedit(ing|or)?\b|\bvideo|\b3d\b|photoshop|premiere|autocad|رسم/i, ['تصميم', 'design and video editing'],
    ['رام 16-32 جيجا، وكارت شاشة قوي، وشاشة ألوانها دقيقة', '16-32GB RAM, a strong GPU and a color-accurate screen']],
  ['study', /جامعة|جامعه|دراسة|مذاكرة|طالب|مدرسة|كلية|\bstudy|\bstudent|\bschool|\bcollege|\buniversity/i, ['دراسة', 'study'],
    ['بطارية تعيش كتير، ووزن خفيف، ورام 8-16 جيجا', 'long battery life, light weight and 8-16GB RAM']],
  ['office', /شغل|مكتب|اكسل|اوفيس|أوفيس|\boffice\b|\bwork\b|\bbusiness\b|\bexcel\b|محاسب/i, ['شغل', 'office work'],
    ['بطارية كويسة، ومعالج متوسط، ورام 8-16 جيجا', 'a reliable battery, a mid-range CPU and 8-16GB RAM']],
  ['light', /خفيف|محمول|سفر|بطارية|\blight(weight)?\b|\bportable\b|\bbattery\b|\btravel/i, ['تنقل', 'portability'],
    ['وزن خفيف وبطارية بتعيش كتير', 'light weight and long battery life']],
];

/** [trigger, Arabic answer, English answer] */
const FAQ = [
  [/\bram\b|رام|ذاكرة/i,
    '**RAM** هي ذاكرة التشغيل: كل ما زادت، اللابتوب بيفتح برامج أكتر في نفس الوقت من غير بطء. 8 جيجا للاستخدام العادي و16 جيجا للبرمجة والتصميم.',
    '**RAM** is the working memory: more RAM lets you run more apps at once without slowing down. 8GB suits everyday use, 16GB suits programming and design.'],
  [/\bcpu\b|processor|معالج|بروسيسور/i,
    '**المعالج (CPU)** هو عقل اللابتوب: كل ما كان أقوى (Core i7 أو Ryzen 7 أو Apple M) كان أسرع في البرمجة والتصميم والبرامج التقيلة. Core i5 كفاية للدراسة والشغل.',
    '**The CPU** is the laptop brain: a stronger one (Core i7, Ryzen 7, Apple M) is faster for programming, design and heavy apps. Core i5 is enough for study and office work.'],
  [/\bssd\b|\bhdd\b|storage|هارد|تخزين/i,
    '**الـ SSD** أسرع بكتير من الهارد القديم: السيستم والبرامج بتفتح في ثواني. 512 جيجا مناسبة لمعظم الناس.',
    '**An SSD** is far faster than an old hard drive: the system and apps open in seconds. 512GB suits most people.'],
  [/\bgpu\b|graphics|كارت|جرافيك/i,
    '**كارت الشاشة (GPU)** مهم للجيمنج والمونتاج والتصميم ثلاثي الأبعاد. للدراسة والشغل العادي الكارت المدمج كفاية.',
    '**The GPU** matters for gaming, video editing and 3D. For study and everyday work the integrated graphics are enough.'],
];

/** CPU strength: the family (i3 < i5 < i7 < i9, Ryzen, Xeon, Core Ultra) plus a bonus for newer generations. */
function cpuPower(cpu) {
  const s = String(cpu ?? '').toLowerCase();
  const base = /ultra 9|i9|ryzen 9/.test(s) ? 4 : /ultra 7|i7|ryzen 7|xeon/.test(s) ? 3 : /ultra 5|i5|ryzen 5/.test(s) ? 2 : 1;
  const generation = Number((s.match(/(\d{1,2})(?:st|nd|rd|th) gen/) ?? s.match(/i[3579]-(\d{1,2})\d{3}/) ?? [])[1]) || (/ultra/.test(s) ? 14 : 8);
  return base + (generation >= 12 ? 1 : generation >= 10 ? 0.6 : generation >= 8 ? 0.3 : 0);
}
const hasDedicatedGpu = (gpu) => /rtx|gtx|quadro|nvidia|radeon rx|arc a|dedicated|\bt\d{3,4}\b|\bp\d{4}\b/i.test(gpu ?? '') && !/^(intel|amd) graphics$/i.test(String(gpu).trim());

/** How well a laptop fits a use-case; higher is better. */
export function fitScore(laptop, use) {
  const ram = num(laptop.ram) || 8;
  const storage = toGB(laptop.storage) || 256;
  const battery = num(laptop.battery) || 6;
  const weight = num(laptop.weight) || 2;
  const cpu = cpuPower(laptop.cpu);
  const gpu = hasDedicatedGpu(laptop.gpu) ? 1 : 0;
  const screen = /oled|retina|4k|3\.5k|2k|qhd/i.test(laptop.screen ?? '') ? 1 : 0;
  const ssd = /ssd/i.test(laptop.storage ?? '') ? 1 : 0;
  const scores = {
    dev: cpu * 3 + (ram / 8) * 2 + (storage >= 512 ? 1 : 0) + ssd,
    game: gpu * 8 + cpu * 2 + ram / 16,
    design: (ram / 8) * 2 + gpu * 3 + cpu * 2 + screen * 2,
    study: battery / 3 + (2.2 - weight) * 2 + (ram >= 8 ? 1 : 0) + cpu - laptop.price / 20000,
    office: battery / 3 + (2.2 - weight) * 2 + cpu * 1.2 + ssd - laptop.price / 25000,
    light: battery / 2 + (2.5 - weight) * 4 + ssd,
  };
  return scores[use] ?? cpu + ram / 8 + battery / 6;
}

/** First budget-looking number: "40 ألف" -> 40000, "40k" -> 40000, "35000" -> 35000. */
export function extractBudget(text) {
  const normalized = text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/,/g, '');
  for (const m of normalized.matchAll(/(\d+(?:\.\d+)?)\s*(k|ألف|الف)?/gi)) {
    const value = parseFloat(m[1]) * (m[2] ? 1000 : 1);
    if (value >= 3000) return value;
  }
  return 0;
}

export class LocalAdvisor {
  constructor({ currency = 'EGP' } = {}) {
    this.currency = currency;
  }

  #money(n) {
    return `${Number(n).toLocaleString('en-US')} ${this.currency}`;
  }

  #line(l) {
    const gpu = hasDedicatedGpu(l.gpu) ? ` · ${l.gpu}` : '';
    const kind = l.type && l.type !== 'Laptop' ? ` (${l.type})` : '';
    return `- **${l.brand} ${l.model}**${kind} — ${this.#money(l.price)} · ${l.cpu} · ${l.ram} · ${l.storage}${gpu}`;
  }

  /** @param text everything the customer wrote so far (newest last) */
  reply(text, laptops) {
    const ar = hasArabic(text);
    if (!laptops.length) return ar ? 'لسه مفيش لابتوبات متاحة.' : 'No laptops in stock yet.';

    const budget = extractBudget(text);
    const use = USES.find(([, re]) => re.test(text));

    if (!use && !budget) {
      const faq = FAQ.find(([re]) => re.test(text));
      if (faq) return ar ? faq[1] : faq[2];
      return ar
        ? 'أهلاً بيك! قولي هتستخدم اللابتوب في إيه (برمجة، جيمنج، تصميم، دراسة...) وميزانيتك كام، وأرشحلك أنسب لابتوب من اللي عندنا.'
        : 'Tell me what you will use the laptop for (programming, gaming, design, study...) and your budget, and I will suggest the best match from our stock.';
    }

    const id = use ? use[0] : '';
    // "desktop" / "tower" asked for explicitly; otherwise portable uses (study, travel) only make sense for laptops
    const wanted = /desktop|\bpc\b|ديسكتوب|كمبيوتر مكتبي/i.test(text) ? 'Desktop' : /tower|تاور/i.test(text) ? 'Tower' : null;
    const portable = id === 'study' || id === 'light';
    const stock = laptops.filter((l) => (wanted ? l.type === wanted : portable ? (l.type ?? 'Laptop') === 'Laptop' : true));
    const inBudget = budget ? stock.filter((l) => l.price <= budget) : stock;
    const over = budget > 0 && inBudget.length === 0;
    const pool = over ? [[...(stock.length ? stock : laptops)].sort((a, b) => a.price - b.price)[0]] : inBudget;
    const top = [...pool].sort((a, b) => fitScore(b, id) - fitScore(a, id)).slice(0, 3);

    const tip = use
      ? ar ? `لل${use[2][0]} أهم حاجة: ${use[3][0]}.\n\n` : `For ${use[2][1]} focus on ${use[3][1]}.\n\n`
      : '';
    const head = over
      ? ar ? `مفيش حاجة في حدود ${this.#money(budget)}، أقرب اختيار عندنا:` : `Nothing fits ${this.#money(budget)}, the closest option is:`
      : ar ? `أنسب اللي عندنا${budget ? ' في ميزانيتك' : ''}:` : `Best matches in our stock${budget ? ' within your budget' : ''}:`;
    const tail = ar
      ? budget ? '\n\nتقدر تطلب مباشرة من زرار واتساب تحت اللابتوب.' : '\n\nقولي ميزانيتك وأضبطلك الترشيح أكتر.'
      : budget ? '\n\nYou can order directly with the WhatsApp button under each laptop.' : '\n\nTell me your budget and I will refine the suggestions.';

    return `${tip}${head}\n${top.map((l) => this.#line(l)).join('\n')}${tail}`;
  }

  /** Plain-text comparison verdict built from the numbers (used when AI is unavailable). */
  compareSummary(laptops, { lang = 'ar' } = {}) {
    const ar = lang === 'ar';
    const { rows, scores, topIndexes } = compareLaptops(laptops);
    const name = (i) => `${laptops[i].brand} ${laptops[i].model}`;
    const bestOf = (key) => {
      const row = rows.find((r) => r.key === key);
      const i = row.cells.findIndex((c) => c.best);
      return i < 0 ? null : name(i);
    };
    const labels = ar
      ? { overall: 'الأفضل إجمالاً', price: 'الأرخص', ram: 'أكبر ذاكرة', storage: 'أكبر تخزين', battery: 'أطول بطارية', weight: 'الأخف وزناً' }
      : { overall: 'Best overall', price: 'Lowest price', ram: 'Most memory', storage: 'Most storage', battery: 'Longest battery', weight: 'Lightest' };
    const lines = ['price', 'ram', 'storage', 'battery', 'weight']
      .map((k) => [k, bestOf(k)])
      .filter(([, n]) => n)
      .map(([k, n]) => `- ${labels[k]}: **${n}**`);
    const winners = topIndexes.map((i) => `**${name(i)}** (${scores[i]}/100)`).join(ar ? ' و ' : ' & ');
    return `${labels.overall}: ${winners}\n${lines.join('\n')}`;
  }
}
