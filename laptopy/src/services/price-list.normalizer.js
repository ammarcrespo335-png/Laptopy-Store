/**
 * Cleans up the owner's price-list sheet (Type | Model | CPU | RAM | SSD | HDD | GPU | Display | Price | Photo).
 *
 * The sheet is typed by hand: "hp840 g8", "percision 7720", "P5510", "razer- 14", "i5-8th (U)", "nvidia 4 g"...
 * Everything here turns those into proper product names and specifications, so that
 *   - the catalogue looks professional ("HP EliteBook 840 G8", "Core i5 8th Gen (U)", "256GB SSD"),
 *   - the "View photos" link searches for the REAL product name (the original typos found wrong pictures).
 *
 * Only patterns that are recognised are rewritten; anything else is kept as typed.
 */

// ------------------------------------------------------------------ small helpers
const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')}`;
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ specs
export function normalizeCpu(raw) {
  const s = squash(raw).toLowerCase();
  if (!s) return '';

  const special = {
    xeon: 'Intel Xeon',
    'xeon/i7-10': 'Intel Xeon / Core i7 10th Gen',
    'xeon / i7-11': 'Intel Xeon / Core i7 11th Gen',
    'i7,7th-xeon': 'Core i7 7th Gen / Xeon',
    amd: 'AMD',
  };
  if (special[s]) return special[s];

  // Intel Core: "i5 8th", "I 7 12th", "i5-11th (G7)", "i5 7th HQ", "i7,6th", "i5-8", "i7"
  const core = s.match(/^(?:core\s*)?i\s*([3579])(?:[\s,-]+(\d{1,2})(?:st|nd|rd|th)?)?(?:\s*\(?\s*(u|h|hq|g7|g4)\s*\)?)?$/);
  if (core) {
    const [, family, gen, suffix] = core;
    return `Core i${family}${gen ? ` ${ordinal(Number(gen))} Gen` : ''}${suffix ? ` (${suffix.toUpperCase()})` : ''}`;
  }
  const ryzen = s.match(/^(?:ryzen|rayzen)\s*([3579])$/);
  if (ryzen) return `Ryzen ${ryzen[1]}`;
  const ultra = s.match(/^ultra\s*([579])$/);
  if (ultra) return `Core Ultra ${ultra[1]}`;
  const aSeries = s.match(/^a(4|6|8|10|12)$/);
  if (aSeries) return `AMD A${aSeries[1]}`;
  return squash(raw);
}

/** "256GB" -> "256GB SSD" (a plain size in the SSD | HDD column means SSD), "HDD 500GB" -> "500GB HDD". */
export function normalizeStorage(raw) {
  const s = squash(raw);
  const m = s.match(/^(?:(ssd|hdd)\s*)?(\d+(?:\.\d+)?)\s*(gb|tb)(?:\s*(ssd|hdd))?$/i);
  if (!m) return s;
  const kind = (m[1] || m[4] || 'SSD').toUpperCase();
  return `${m[2]}${m[3].toUpperCase()} ${kind}`;
}

export function normalizeRam(raw) {
  return squash(raw).replace(/^(\d+)\s*gb\b/i, '$1GB').replace(/\bddr(\d)\b/i, 'DDR$1');
}

/** Returns { gpu, touch } ("touch screen" typed in the GPU column is moved out of it). */
export function normalizeGpu(raw) {
  const original = squash(raw);
  if (!original) return { gpu: '', touch: false };
  let text = original;
  let touch = false;
  if (/touch/i.test(text)) {
    touch = true;
    text = squash(text.replace(/touch( screen)?/gi, ''));
    if (!text) return { gpu: '', touch };
  }
  if (/^(built-?in )?intel( graphics)?$/i.test(text)) return { gpu: 'Intel Graphics', touch };
  if (/^amd$/i.test(text)) return { gpu: 'AMD Graphics', touch };
  if (/^amd 512$/i.test(text)) return { gpu: 'AMD 512', touch };

  const sizeMatch = text.match(/(\d+)\s*(?:gb|g)\b/i);
  const size = sizeMatch ? `${sizeMatch[1]}GB` : '';
  const rest = squash(text.replace(/(\d+)\s*(?:gb|g)\b/gi, ' '));
  const words = rest ? rest.split(' ') : [];
  const out = [];
  let hasBrand = false;
  for (const w of words) {
    const l = w.toLowerCase();
    if (l === 'nvidia' || l === 'nv') { out.push('NVIDIA'); hasBrand = true; }
    else if (l === 'amd') { out.push('AMD'); hasBrand = true; }
    else if (l === 'quadro') { out.push('Quadro'); }
    else if (l === 'rtx') { out.push('RTX'); }
    else if (l === 'q') { /* "Q" = Quadro written in short: dropped */ }
    else if (/^rtx\d+$/.test(l)) { out.push('RTX', l.slice(3)); }
    else if (/^[a-z]?\d{2,4}[a-z]?$|^r\d$/.test(l)) { out.push(w.toUpperCase()); }
    else out.push(upperFirst(l));
  }
  const nvidiaHint = out.some((w) => /^(Quadro|RTX|P\d{4}|T\d{3,4}|A\d{3,4})$/.test(w));
  const amdHint = out.some((w) => /^(Vega|R\d)$/.test(w));
  if (!hasBrand && nvidiaHint) out.unshift('NVIDIA');
  else if (!hasBrand && amdHint) out.unshift('AMD');
  if (size) out.push(size);
  if (!out.length) return { gpu: original, touch };
  if (!hasBrand && !nvidiaHint && !amdHint && size && out.length === 1) return { gpu: `${size} dedicated`, touch };
  return { gpu: out.join(' '), touch };
}

export function normalizeDisplay(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? `${n}"` : '';
}

export function normalizeType(raw) {
  const s = squash(raw).toLowerCase();
  if (s.startsWith('desk')) return 'Desktop';
  if (s.startsWith('tower')) return 'Tower';
  return 'Laptop';
}

// ------------------------------------------------------------------ product names
const product = (brand, model, search = `${brand} ${model}`) => ({ brand, model, search });
const upperTokens = (s) => s.replace(/\bg(\d+)\b/gi, 'G$1').replace(/\bgen\s?(\d)\b/gi, 'Gen $1');

/** @returns {{brand: string, model: string, search: string} | null} */
export function normalizeProductName(rawModel, { type = 'Laptop', display = '' } = {}) {
  let s = squash(rawModel).replace(/percision/gi, 'precision').replace(/dragon fly/gi, 'dragonfly').replace(/-$/, '');
  const l = s.toLowerCase();
  const inches = Number(String(display).replace(/[^\d.]/g, '')) || 0;
  let m;

  // ---------- desktops and towers (HP business PCs)
  if (type === 'Desktop' || type === 'Tower') {
    if ((m = l.match(/^hp 6(\d{3})$/))) return product('HP', `Compaq Pro 6${m[1]}`);
    if (/^hp 705 g1 & g2$/.test(l)) return product('HP', 'EliteDesk 705 G1 / G2', 'HP EliteDesk 705 G1');
    if ((m = l.match(/^hp 705 g(\d)$/))) return product('HP', `EliteDesk 705 G${m[1]}`);
    if ((m = l.match(/^hp 600\/800 g(\d)$/))) return product('HP', `ProDesk / EliteDesk 600/800 G${m[1]}`, `HP EliteDesk 800 G${m[1]}`);
  }

  // ---------- Microsoft Surface
  if (/^surface go 2$/.test(l)) return product('Microsoft', 'Surface Go 2');
  if ((m = l.match(/^surface laptop (\d)\s*(?:\/|\s)\s*(?:14|15)$/)) || (m = l.match(/^surface laptop (\d) (?:14|15)$/))) {
    const size = inches >= 15 ? '15"' : '13.5"';
    return product('Microsoft', `Surface Laptop ${m[1]} ${size}`, `Microsoft Surface Laptop ${m[1]} ${size.replace('"', ' inch')}`);
  }

  // ---------- Razer
  if ((m = l.match(/^razer-?\s*(\d{2})$/))) return product('Razer', `Blade ${m[1]}`, `Razer Blade ${m[1]}`);

  // ---------- Lenovo
  if ((m = l.match(/^lenovo\s+([xtle])(\d{2,3}s?)(?:\s+(yoga))?$/))) {
    const base = `${m[1].toUpperCase()}${m[2].toUpperCase().replace(/S$/, 's')}`;
    return product('Lenovo', `ThinkPad ${base}${m[3] ? ' Yoga' : ''}`);
  }
  if ((m = l.match(/^lenovo\s+(l13|e14)\s*(?:gen\s*(\d))?$/))) {
    return product('Lenovo', `ThinkPad ${m[1].toUpperCase()}${m[2] ? ` Gen ${m[2]}` : ''}`);
  }
  if ((m = l.match(/^lenovo\s+v14\s+g(\d)$/))) return product('Lenovo', `V14 G${m[1]}`);

  // ---------- Dell
  if (/^xps$/.test(l)) return product('Dell', inches >= 15 ? 'XPS 15' : 'XPS');
  if (/^dell pro$/.test(l)) return product('Dell', 'Pro', 'Dell Pro 14');
  if ((m = l.match(/^(?:dell )?(?:latitude )?7350 detachable$/))) return product('Dell', 'Latitude 7350 Detachable');
  if ((m = l.match(/^7320 tablet$/))) return product('Dell', 'Latitude 7320 Detachable');
  if ((m = l.match(/^dell latitude 7420 touch screen x360$/))) return product('Dell', 'Latitude 7420 2-in-1', 'Dell Latitude 7420 2-in-1');
  if ((m = l.match(/^dell latitude 7200 2 in 1$/))) return product('Dell', 'Latitude 7200 2-in-1');
  if ((m = l.match(/^(?:dell )?precision (\d{4})$/)) || (m = l.match(/^(?:dell )?p(\d{4})$/))) return product('Dell', `Precision ${m[1]}`);
  if ((m = l.match(/^dell latitude (\d{4})$/))) return product('Dell', `Latitude ${m[1]}`);
  if ((m = l.match(/^(?:dell )?(\d{4})$/))) {
    return Number(m[1]) >= 7500 ? product('Dell', `Precision ${m[1]}`) : product('Dell', `Latitude ${m[1]}`);
  }

  // ---------- HP: ZBook workstations
  if (/^hp zbook g5$/.test(l)) return product('HP', 'ZBook 15u G5'); // the i5 / Radeon Pro 15-inch model
  if (/zbook/.test(l)) {
    const gen = (l.match(/\bg(\d+)\b/) || l.match(/(?:studio|fury|firefly)\s*\d*\s*g(\d+)/) || [])[1];
    const x360 = /x360/.test(l);
    const family = /firefly/.test(l) ? 'Firefly' : /fury/.test(l) ? 'Fury' : /studio/.test(l) ? 'Studio' : /power/.test(l) ? 'Power' : '';
    let size = (l.match(/\b(14|15|16|17)\b/) || l.match(/studio(16)/) || [])[1];
    if (!size && family !== 'Power' && family !== 'Studio') size = inches >= 17 ? '17' : inches >= 15 ? '15' : inches >= 14 ? '14' : '';
    if (!size && family === 'Studio' && !x360 && inches >= 16) size = '16';
    if (/\bu$/.test(l)) size = `${size}u`;
    // HP's own names (checked against HP / Notebookcheck): 14-inch G5/G6 = "14u", and from G7 the 14-inch is the "Firefly 14"
    if (!family && size === '14' && Number(gen) <= 6) size = '14u';
    if (!family && size === '14' && Number(gen) >= 7) return product('HP', `ZBook Firefly 14 G${gen}`);
    let model;
    if (family === 'Power') model = `ZBook Power G${gen}`;
    else if (family === 'Studio' && x360) model = `ZBook Studio x360 G${gen}`;
    else if (family) model = `ZBook ${family}${size ? ` ${size}` : ''} G${gen}`;
    else model = `ZBook ${size} G${gen}`;
    return product('HP', model.replace(/\s+/g, ' ').trim());
  }

  // ---------- HP: Elite x2, Dragonfly
  if ((m = l.match(/^hp x2 ?1013 g(\d)$/))) return product('HP', `Elite x2 1013 G${m[1]}`);
  if ((m = l.match(/^hp elite x2 g(\d)$/))) return product('HP', `Elite x2 G${m[1]}`);
  if ((m = l.match(/^dragonfly x360$/))) return product('HP', 'Elite Dragonfly', 'HP Elite Dragonfly');
  if ((m = l.match(/^dragonfly g(\d)$/))) return product('HP', `Elite Dragonfly G${m[1]}`);

  // ---------- HP: ProBook / EliteBook
  if ((m = l.match(/^(?:hp )?(probook|elitebook) (\d{3,4}) g(\d+)( x360)?$/))) {
    return product('HP', `${upperFirst(m[1]).replace('book', 'Book')} ${m[2]} G${m[3]}${m[4] ? ' x360' : ''}`);
  }
  if ((m = l.match(/^hp ?(\d{3,4}) ?g(\d+)( 2in1)?$/))) {
    const series = Number(m[1]);
    const line = series >= 700 ? 'EliteBook' : 'ProBook'; // 4xx/6xx = ProBook, 7xx/8xx/10xx = EliteBook
    return product('HP', `${line} ${m[1]} G${m[2]}${m[3] ? ' 2-in-1' : ''}`);
  }
  if ((m = l.match(/^hp ?(\d{3,4}) ?g(\d+) 2in1$/))) return product('HP', `EliteBook ${m[1]} G${m[2]} 2-in-1`);
  if ((m = l.match(/^elitebook (\d{3,4}) g(\d+)$/))) return product('HP', `EliteBook ${m[1]} G${m[2]}`);
  if ((m = l.match(/^hp ?(\d{3,4}) ?g(\d+)$/))) return product('HP', `ProBook ${m[1]} G${m[2]}`);
  if (/^hp 655s$/.test(l)) return product('HP', '655S', 'HP 655 laptop AMD 15.6'); // exact model could not be identified

  // ---------- generic fallback: keep the typing, only detect the brand
  const known = { hp: 'HP', dell: 'Dell', lenovo: 'Lenovo', asus: 'ASUS', acer: 'Acer', msi: 'MSI', apple: 'Apple', microsoft: 'Microsoft', razer: 'Razer', toshiba: 'Toshiba', samsung: 'Samsung', huawei: 'Huawei' };
  const first = l.split(' ')[0];
  if (known[first]) return product(known[first], upperTokens(squash(s.slice(first.length))));
  return null;
}

// ------------------------------------------------------------------ photos
/**
 * The "View photos" link: a Google Images search for the exact product name in quotes, so every result
 * is a picture of that product (not of a similar one).
 */
export function photosSearchUrl({ search, brand, model, type = 'Laptop' }) {
  const name = search || `${brand} ${model}`;
  const word = type === 'Desktop' ? 'desktop' : type === 'Tower' ? 'tower pc' : 'laptop';
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`"${name}" ${word}`)}`;
}

/** One sheet row (already read as text) -> the fields of a catalogue entry. */
export function normalizePriceListRow(raw) {
  const type = normalizeType(raw.type);
  const displayText = raw.screen;
  const named = normalizeProductName(raw.model, { type, display: displayText });
  const gpu = normalizeGpu(raw.gpu);
  const out = {
    type,
    cpu: normalizeCpu(raw.cpu),
    ram: normalizeRam(raw.ram),
    storage: normalizeStorage(raw.storage),
    gpu: gpu.gpu,
    screen: normalizeDisplay(displayText),
    notes: gpu.touch ? 'Touch screen' : '',
  };
  if (named) {
    out.brand = named.brand;
    out.model = named.model;
    out.photosUrl = photosSearchUrl({ ...named, type });
  }
  return out;
}
