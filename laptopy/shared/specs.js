/**
 * Spec parsing and comparison scoring.
 * Pure functions with no dependencies: used by the server (local advisor,
 * comparison summary) and by the browser (comparison table).
 */

/** First number found in a string: "16GB" -> 16, "1.6kg" -> 1.6. NaN if none. */
export const num = (v) => {
  const m = String(v ?? '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

/** Storage size in GB: "512GB SSD" -> 512, "1TB SSD" -> 1024. */
export const toGB = (v) => (/tb/i.test(String(v ?? '')) ? num(v) * 1024 : num(v));

/** Metrics shown as bars in the comparison table. */
export const METRICS = Object.freeze([
  { key: 'price', label: 'Price', hint: 'lower is better', higherIsBetter: false, read: (l) => Number(l.price) },
  { key: 'ram', label: 'Memory (RAM)', hint: 'more is better', higherIsBetter: true, read: (l) => num(l.ram) },
  { key: 'storage', label: 'Storage', hint: 'more is better', higherIsBetter: true, read: (l) => toGB(l.storage) },
  { key: 'battery', label: 'Battery life', hint: 'longer is better', higherIsBetter: true, read: (l) => num(l.battery) },
  { key: 'weight', label: 'Weight', hint: 'lighter is better', higherIsBetter: false, read: (l) => num(l.weight) },
]);

const usable = (v) => Number.isFinite(v) && v > 0;

/**
 * Scores laptops against each other.
 * Every metric gets a percentage relative to the best laptop in that row (best = 100). The overall score is the
 * average of the rows the laptop HAS data for: a missing value (a desktop has no battery) is shown as "no data"
 * and never counts as zero. A row nobody has data for is flagged `empty` so it can be hidden.
 */
export function compareLaptops(laptops) {
  const rows = METRICS.map((metric) => {
    const values = laptops.map(metric.read);
    const valid = values.filter(usable);
    const best = valid.length ? (metric.higherIsBetter ? Math.max(...valid) : Math.min(...valid)) : NaN;
    return {
      key: metric.key,
      label: metric.label,
      hint: metric.hint,
      empty: valid.length === 0,
      cells: values.map((value) => {
        if (!usable(value)) return { value, pct: null, best: false };
        const ratio = metric.higherIsBetter ? value / best : best / value;
        return { value, pct: Math.round(ratio * 100), best: valid.length > 1 && value === best };
      }),
    };
  });
  const scores = laptops.map((_, i) => {
    const pcts = rows.map((r) => r.cells[i].pct).filter((p) => p !== null);
    return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  });
  const top = Math.max(...scores);
  return { rows, scores, top, topIndexes: scores.flatMap((s, i) => (s === top ? [i] : [])) };
}
