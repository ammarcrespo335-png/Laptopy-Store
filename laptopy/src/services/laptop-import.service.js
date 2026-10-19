import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { badRequest } from '../utils/http-error.js';
import { LAPTOP_DEFAULTS, laptopCreateSchema } from '../validators/laptop.schema.js';
import { normalizePriceListRow, normalizeType, photosSearchUrl } from './price-list.normalizer.js';

const MAX_ROWS = 2000;
const PREVIEW_ROWS = 60;
const GOOGLE_IMAGES = 'https://www.google.com/search?tbm=isch';

/**
 * The columns of the Excel sheet. `labels` are the header names we accept (English and Arabic,
 * case/space/underscore-insensitive), so the owner can write the headers in either language.
 * `required` columns must exist; Brand is also required unless the sheet is in the owner's "price list" format
 * (no Brand column), where it is detected from the model name.
 */
const COLUMNS = [
  { key: 'type', title: 'Type', labels: ['type', 'النوع'], example: ['Laptop', 'Desktop'] },
  { key: 'brand', title: 'Brand', labels: ['brand', 'company', 'الماركة', 'ماركة', 'الشركة'], example: ['Lenovo', 'HP'] },
  { key: 'model', title: 'Model', required: true, labels: ['model', 'name', 'الموديل', 'الاسم', 'اسم الجهاز'], example: ['IdeaPad Slim 3', 'EliteDesk 800 G4'] },
  { key: 'price', title: 'Price', required: true, labels: ['price', 'السعر', 'سعر'], example: [18500, 9500] },
  { key: 'cpu', title: 'CPU', required: true, labels: ['cpu', 'processor', 'المعالج', 'البروسيسور'], example: ['Intel Core i5-12450H', 'Core i5 8th Gen'] },
  { key: 'ram', title: 'RAM', required: true, labels: ['ram', 'memory', 'الرام', 'الذاكرة'], example: ['8GB', '16GB'] },
  { key: 'storage', title: 'Storage', required: true, labels: ['storage', 'ssd', 'ssd | hdd', 'disk', 'التخزين', 'الهارد'], example: ['512GB SSD', '256GB SSD'] },
  { key: 'screen', title: 'Screen', labels: ['screen', 'display', 'الشاشة'], example: ['15.6" FHD', ''] },
  { key: 'gpu', title: 'GPU', labels: ['gpu', 'graphics', 'كارت الشاشة', 'كرت الشاشة', 'الجرافيك'], example: ['Integrated', ''] },
  { key: 'battery', title: 'Battery', labels: ['battery', 'البطارية'], example: ['8h', ''] },
  { key: 'weight', title: 'Weight', labels: ['weight', 'الوزن'], example: ['1.6kg', ''] },
  { key: 'notes', title: 'Notes', labels: ['notes', 'note', 'ملاحظات', 'ملاحظة'], example: ['Great for study', ''] },
  { key: 'description', title: 'Description', labels: ['description', 'details', 'الوصف', 'التفاصيل'], example: ['Slim 15.6 inch laptop for students.', ''] },
  { key: 'os', title: 'OS', labels: ['os', 'system', 'نظام التشغيل', 'السيستم'], example: ['Windows 11', 'Windows 11'] },
  { key: 'color', title: 'Color', labels: ['color', 'colour', 'اللون'], example: ['Grey', 'Black'] },
  { key: 'ports', title: 'Ports', labels: ['ports', 'المنافذ'], example: ['2x USB-A, 1x USB-C, HDMI', ''] },
  { key: 'warranty', title: 'Warranty', labels: ['warranty', 'الضمان'], example: ['1 year', ''] },
  // "Photo" / "Photos": a link to pictures (the owner's sheet has "View photos" hyperlinks) OR a list of image links
  { key: 'images', title: 'Images', labels: ['images', 'image', 'photos', 'photo', 'الصور', 'صورة', 'روابط الصور'], example: ['https://example.com/photo1.jpg https://example.com/photo2.jpg', ''] },
  { key: 'photosUrl', title: 'Photos link', labels: ['photos link', 'photoslink', 'photo link', 'photourl', 'رابط الصور'], example: ['', ''] },
  { key: 'inStock', title: 'In stock', labels: ['instock', 'in stock', 'available', 'stock', 'متاح', 'متوفر', 'الحالة'], example: ['yes', 'yes'] },
];

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const normalizeHeader = (s) =>
  String(s ?? '').toLowerCase().replace(/[\u064b-\u065f]/g, '').replace(/[\s_\-./()|]+/g, '');
const ALIASES = new Map(COLUMNS.flatMap((c) => [...c.labels, c.key].map((l) => [normalizeHeader(l), c.key])));
const TITLE = Object.fromEntries(COLUMNS.map((c) => [c.key, c.title]));

const TRUE_WORDS = new Set(['yes', 'y', 'true', '1', 'نعم', 'متاح', 'متوفر', 'موجود', 'في المخزون']);
const FALSE_WORDS = new Set(['no', 'n', 'false', '0', 'لا', 'غير متاح', 'غير متوفر', 'خلص', 'نفذ', 'مش متاح', 'hidden', 'out of stock']);

const squash = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Same product line = same brand + model (ignoring case and extra spaces). */
const modelKey = (d) => `${squash(d.type || 'Laptop')}|${squash(d.brand)}|${squash(d.model)}`;
/** One variant of a product: model + the specs that make two units different (a laptop sold with i5 and with i7...). */
const skuKey = (d) => [modelKey(d), squash(d.cpu), squash(d.ram), squash(d.storage), squash(d.gpu)].join('|');

function parsePrice(raw) {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw)
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[,\s٬]/g, '')
    .replace(/[^\d.]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

function parseInStock(text) {
  const t = text.trim().toLowerCase();
  if (TRUE_WORDS.has(t)) return true;
  if (FALSE_WORDS.has(t)) return false;
  throw new Error('In stock must be yes / no (نعم / لا)');
}

const cellText = (cell) => String(cell?.text ?? '').trim();
const isHttps = (v) => /^https:\/\/\S+$/i.test(v);

/** Loads the first sheet of an .xlsx or .csv file into a worksheet. */
async function loadSheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" = .xlsx
  try {
    if (isZip) await workbook.xlsx.load(buffer);
    else {
      const csv = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.subarray(3) : buffer;
      await workbook.csv.read(Readable.from(csv));
    }
  } catch {
    throw badRequest('We could not read this file. Please upload an Excel (.xlsx) or CSV file.', 'unreadable_file');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw badRequest('The sheet is empty. Add a header row and at least one laptop.', 'empty_sheet');
  return sheet;
}

/** Excel / CSV import of the whole catalogue. */
export class LaptopImportService {
  constructor({ repository, images }) {
    this.repo = repository;
    this.images = images;
  }

  /** Reads the sheet and checks every row. Nothing is saved here. */
  async parse(buffer) {
    const sheet = await loadSheet(buffer);

    // header row = the row (among the first 20) that contains the most column names we know.
    // Price lists often start with a title or a few notes above the real headers.
    let headerRowNumber = 0;
    let bestScore = 0;
    for (let n = 1; n <= Math.min(sheet.rowCount, 20); n++) {
      let score = 0;
      sheet.getRow(n).eachCell({ includeEmpty: false }, (cell) => {
        if (ALIASES.has(normalizeHeader(cellText(cell)))) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        headerRowNumber = n;
      }
    }
    if (bestScore < 3) {
      // nothing recognisable: fall back to the first row with any text, so the error names the missing columns
      headerRowNumber = 1;
      while (headerRowNumber <= sheet.rowCount && !sheet.getRow(headerRowNumber).values.some((v) => String(v ?? '').trim())) headerRowNumber++;
    }
    const headerRow = sheet.getRow(headerRowNumber);

    const columnOf = new Map(); // column number -> key
    const ignoredColumns = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = ALIASES.get(normalizeHeader(cellText(cell)));
      if (key && ![...columnOf.values()].includes(key)) columnOf.set(col, key);
      else if (cellText(cell)) ignoredColumns.push(cellText(cell));
    });

    const present = new Set(columnOf.values());
    // The owner's price list has no Brand column: the brand and a clean product name are worked out from "Model".
    const priceListMode = !present.has('brand');
    const missing = COLUMNS.filter((c) => c.required && !present.has(c.key)).map((c) => c.title);
    if (missing.length) {
      throw badRequest(`The sheet is missing these columns: ${missing.join(', ')}. Download the template to see the expected headers.`, 'missing_columns');
    }

    const lastRow = Math.min(sheet.rowCount, headerRowNumber + MAX_ROWS);
    if (sheet.rowCount > headerRowNumber + MAX_ROWS) throw badRequest(`Too many rows (maximum ${MAX_ROWS}).`, 'too_many_rows');

    const rows = [];
    for (let n = headerRowNumber + 1; n <= lastRow; n++) {
      const row = sheet.getRow(n);
      const raw = {};
      for (const [col, key] of columnOf) {
        const cell = row.getCell(col);
        const text = cellText(cell);
        if (key === 'images') {
          // "View photos" with a hyperlink = a link to pictures; otherwise a list of image links
          const link = typeof cell.hyperlink === 'string' ? cell.hyperlink : '';
          if (link && !/\bhttps:\/\/\S+\.(?:jpe?g|png|webp)\b/i.test(text)) raw.photosUrl = link;
          else if (text) raw.images = text;
          continue;
        }
        if (text === '') continue;
        raw[key] = key === 'price' && typeof cell.value === 'number' ? cell.value : text;
      }
      if (Object.keys(raw).length === 0) continue; // blank line
      rows.push(this.#validateRow(n, raw, priceListMode));
    }
    if (!rows.length) throw badRequest('No laptops found below the header row.', 'empty_sheet');
    return { rows, ignoredColumns, columns: [...present], priceListMode };
  }

  #validateRow(rowNumber, rawIn, priceListMode) {
    const problems = [];
    let data = { ...rawIn };

    if (priceListMode) {
      const clean = normalizePriceListRow(rawIn);
      if (!clean.brand) problems.push('Brand: could not tell the brand from the model name (add a Brand column)');
      const sheetLink = rawIn.photosUrl;
      data = { ...data, ...clean };
      // a picture link typed by the owner wins; the old Google searches built from the typed names are replaced
      if (sheetLink && isHttps(sheetLink) && !sheetLink.startsWith(GOOGLE_IMAGES)) data.photosUrl = sheetLink;
      if (rawIn.notes && clean.notes) data.notes = `${rawIn.notes}. ${clean.notes}`;
    } else if (data.type !== undefined) {
      data.type = normalizeType(data.type);
    }

    if (data.price !== undefined) data.price = parsePrice(data.price);
    if (data.images !== undefined) data.images = String(data.images).split(/[\s,;|]+/).filter(Boolean);
    if (data.inStock !== undefined) {
      try {
        data.inStock = parseInStock(String(data.inStock));
      } catch (e) {
        problems.push(`${TITLE.inStock}: ${e.message}`);
        delete data.inStock;
      }
    }
    for (const k of Object.keys(data)) if (data[k] === '') delete data[k]; // an empty cell never overwrites existing data
    if (data.brand === undefined && data.model === undefined && problems.length === 0) problems.push('Model: This field is required');

    const parsed = laptopCreateSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push(`${TITLE[issue.path[0]] ?? issue.path[0] ?? 'Row'}: ${issue.message}`);
    }
    if (problems.length) {
      return { row: rowNumber, error: problems.join('; '), key: data.brand && data.model ? skuKey(data) : null };
    }
    return { row: rowNumber, data: parsed.data, key: skuKey(parsed.data), modelKey: modelKey(parsed.data) };
  }

  /** Decides what would be created, updated, left alone or removed. Nothing is saved here. */
  plan(parsedRows, existing, { replace }) {
    const skipped = [];
    let sameModelTwice = 0;

    // 1. Rows that repeat the same variant AND the same price are plain duplicates. The same variant with a
    //    different price is a different unit (another supplier / condition): both are kept as separate lines.
    const seenPrice = new Map(); // sku|price -> row number
    const skuCount = new Map();
    const rows = [];
    for (const r of parsedRows) {
      if (r.error) {
        skipped.push({ row: r.row, message: r.error });
        rows.push(r);
        continue;
      }
      const dupKey = `${r.key}|${r.data.price}`;
      if (seenPrice.has(dupKey)) {
        skipped.push({ row: r.row, message: `Duplicate of row ${seenPrice.get(dupKey)} (same model, specifications and price)` });
        continue;
      }
      seenPrice.set(dupKey, r.row);
      const n = skuCount.get(r.key) ?? 0;
      skuCount.set(r.key, n + 1);
      if (n > 0) sameModelTwice += 1;
      rows.push({ ...r, line: `${r.key}#${n}` }); // "#n": the n-th line of this variant
    }

    // 2. How does a row find "its" laptop in the catalogue?
    //  - the model appears once in the file and once in the catalogue: by brand + model (a changed spec updates it)
    //  - otherwise (several variants of one model): by the variant + its line number
    const count = (items, keyFn) => items.reduce((m, x) => m.set(keyFn(x), (m.get(keyFn(x)) ?? 0) + 1), new Map());
    const good = rows.filter((r) => !r.error);
    const fileModels = count(good, (r) => r.modelKey);
    const existingModels = count(existing, modelKey);
    const lines = new Map();
    const byLine = new Map();
    for (const l of existing) {
      const k = skuKey(l);
      const n = lines.get(k) ?? 0;
      lines.set(k, n + 1);
      byLine.set(`${k}#${n}`, l);
    }
    const byModel = new Map(existing.map((l) => [modelKey(l), l]));

    const used = new Set(); // catalogue items that matched a row
    const create = [];
    const update = [];
    let unchanged = 0;
    const preview = [];
    const addPreview = (action, d, changes) => preview.length < PREVIEW_ROWS && preview.push({ action, label: `${d.brand} ${d.model}`, detail: [d.cpu, d.ram, d.storage].filter(Boolean).join(' · '), price: d.price, changes });

    for (const r of rows) {
      if (r.error) {
        const match = r.key && byLine.get(`${r.key}#0`);
        if (match) used.add(match.id); // a broken row for an existing laptop must not delete it in replace mode
        continue;
      }
      const single = fileModels.get(r.modelKey) === 1 && existingModels.get(r.modelKey) === 1;
      const match = single ? byModel.get(r.modelKey) : byLine.get(r.line);
      if (!match || used.has(match.id)) {
        create.push({ ...LAPTOP_DEFAULTS, ...r.data });
        addPreview('create', r.data);
        continue;
      }
      used.add(match.id);

      // update: only the cells that were filled in change the laptop
      const patch = {};
      const changes = [];
      for (const [field, value] of Object.entries(r.data)) {
        if (field === 'brand' || field === 'model') continue; // same line = same laptop: never rename it
        if (JSON.stringify(match[field] ?? (field === 'images' ? [] : '')) !== JSON.stringify(value)) {
          patch[field] = value;
          changes.push(field);
        }
      }
      if (changes.length === 0) unchanged += 1;
      else {
        update.push({ id: match.id, patch });
        addPreview('update', { ...match, ...patch }, changes);
      }
    }

    const removed = replace ? existing.filter((l) => !used.has(l.id)) : [];
    return { create, update, removeIds: removed.map((l) => l.id), skipped, unchanged, preview, removeLabels: removed.map((l) => `${l.brand} ${l.model}`), sameModelTwice };
  }

  /**
   * Runs an import.
   * @param dryRun  only report what would happen
   * @param replace also delete laptops that are not in the file
   */
  async run({ buffer, dryRun = false, replace = false }) {
    const { rows, ignoredColumns, priceListMode } = await this.parse(buffer);
    const plan = this.plan(rows, this.repo.list(), { replace });

    if (!dryRun && (plan.create.length || plan.update.length || plan.removeIds.length)) {
      const { removed } = await this.repo.apply({ create: plan.create, update: plan.update, removeIds: plan.removeIds });
      await this.images?.cleanup(removed.flatMap((l) => l.images ?? []));
    }

    return {
      dryRun,
      replace,
      priceListFormat: priceListMode,
      totalRows: rows.length,
      created: plan.create.length,
      updated: plan.update.length,
      unchanged: plan.unchanged,
      removed: plan.removeIds.length,
      removedNames: plan.removeLabels.slice(0, 30),
      skipped: plan.skipped,
      sameModelTwice: plan.sameModelTwice,
      ignoredColumns,
      preview: plan.preview,
    };
  }

  /** Reads a sheet and returns complete catalogue entries (used to build the starting catalogue from the owner's file). */
  async toCatalogue(buffer) {
    const { rows, priceListMode } = await this.parse(buffer);
    const good = rows.filter((r) => !r.error);
    const seen = new Set();
    const items = [];
    for (const r of good) {
      const dup = `${r.key}|${r.data.price}`;
      if (seen.has(dup)) continue;
      seen.add(dup);
      items.push({ ...LAPTOP_DEFAULTS, ...r.data });
    }
    return { items, skipped: rows.filter((r) => r.error), priceListMode };
  }

  /** The downloadable Excel template (headers, two example rows and a help sheet). */
  async template() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Laptopy';
    const sheet = workbook.addWorksheet('Laptops', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = COLUMNS.map((c) => ({ header: c.title, key: c.key, width: Math.max(12, c.title.length + 6) }));
    for (const i of [0, 1]) sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.example[i]])));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14264D' } };
    sheet.getColumn('model').width = 24;
    sheet.getColumn('cpu').width = 26;
    sheet.getColumn('description').width = 40;
    sheet.getColumn('images').width = 50;

    const help = workbook.addWorksheet('Help');
    help.columns = [{ width: 16 }, { width: 12 }, { width: 80 }];
    help.addRow(['Column', 'Required', 'What to write (الأعمدة بالعربي مقبولة كمان)']).font = { bold: true };
    const notes = {
      type: 'Laptop, Desktop or Tower. Empty = Laptop (النوع)',
      brand: 'Brand, e.g. Lenovo (الماركة). If your sheet has no Brand column, the brand is detected from the model name',
      model: 'Model name (الموديل). The same model with different CPU / RAM / storage = different variants (each row is one variant)',
      price: 'Number only, e.g. 18500 (السعر)',
      images: 'Photo FILE links starting with https:// ending in .jpg/.png/.webp, separated by a space (الصور). A "View photos" hyperlink is used as the photos link',
      photosUrl: 'A link opened by the "View photos" button. Empty = a Google Images search for the exact product name',
      inStock: 'yes / no (نعم / لا). Empty = keep as is; new laptops default to yes (متاح)',
    };
    for (const c of COLUMNS) help.addRow([c.title, c.required ? 'Yes' : 'No', notes[c.key] ?? `${c.title} (${c.labels.find((l) => /[\u0600-\u06ff]/.test(l)) ?? ''})`]);
    help.addRow([]);
    help.addRow(['Tip', '', 'An empty cell never erases existing data. Use the Admin panel to clear a field.']);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

export { photosSearchUrl };
