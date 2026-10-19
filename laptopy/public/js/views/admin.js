import { ApiError, api } from '../api.js';
import { onChange, onClick, onInput, onSubmit } from '../events.js';
import { hooks } from '../hooks.js';
import { ICONS } from '../icons.js';
import { $, debounce, esc, money, toast } from '../utils.js';
import { byId, isAdmin, state, store } from '../state.js';

const TYPES = ['Laptop', 'Desktop', 'Tower'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** [name, label, type, wide?] */
const FIELDS = [
  ['brand', 'Brand', 'text'], ['model', 'Model', 'text'], ['price', 'Price', 'number'],
  ['cpu', 'Processor', 'text'], ['ram', 'Memory (e.g. 16GB)', 'text'], ['storage', 'Storage (e.g. 512GB SSD)', 'text'],
  ['screen', 'Screen', 'text'], ['gpu', 'Graphics', 'text'], ['battery', 'Battery (e.g. 8h)', 'text'],
  ['weight', 'Weight (e.g. 1.6kg)', 'text'], ['os', 'Operating system', 'text'], ['color', 'Color', 'text'],
  ['warranty', 'Warranty', 'text'],
];
const WIDE = [['ports', 'Ports', 'text'], ['notes', 'Short note (shown on the card)', 'text'], ['photosUrl', 'Photos link (optional). Empty = a Google Images search for the exact model name', 'url']];
const TEXT_KEYS = ['type', ...FIELDS.map(([k]) => k), ...WIDE.map(([k]) => k), 'description'];
const LABELS = Object.fromEntries([...FIELDS, ...WIDE].map(([k, l]) => [k, l]).concat([['description', 'Description'], ['type', 'Type']]));

// ---------------------------------------------------------------- form

const field = (name, label, type, value, wide = false) => `<div ${wide ? 'class="full"' : ''}>
  <label for="f-${name}">${label}</label>
  <input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" autocomplete="off" ${type === 'number' ? 'min="1" step="1" inputmode="numeric"' : ''}>
  <p class="err" id="e-${name}"></p>
</div>`;

function formHTML() {
  const l = state.editingId ? byId(state.editingId) : null;
  const v = (k) => l?.[k] ?? '';
  return `<form class="af" data-submit="admin-save" novalidate aria-labelledby="form-title">
    <h3 id="form-title" class="full">${l ? `Edit ${esc(l.brand)} ${esc(l.model)}` : 'Add a laptop'}</h3>
    <div class="summary full" id="form-errors" tabindex="-1" role="alert" hidden></div>
    <div><label for="f-type">Type</label><select id="f-type" name="type">${TYPES.map((t) => `<option ${(l?.type ?? 'Laptop') === t ? 'selected' : ''}>${t}</option>`).join('')}</select><p class="err" id="e-type"></p></div>
    ${FIELDS.map(([name, label, type]) => field(name, label, type, v(name))).join('')}
    ${WIDE.map(([name, label, type]) => field(name, label, type, v(name), true)).join('')}
    <div class="full"><label for="f-description">Description (shown on the laptop's page)</label>
      <textarea id="f-description" name="description" rows="4" maxlength="1500">${esc(v('description'))}</textarea><p class="err" id="e-description"></p></div>
    <div class="chk full"><input type="checkbox" id="f-inStock" name="inStock" ${l ? (l.inStock !== false ? 'checked' : '') : 'checked'}><label for="f-inStock">In stock (visible to customers)</label></div>
    <div class="actions full">
      <button type="submit" class="btn primary">${l ? 'Save changes' : 'Add laptop'}</button>
      ${l ? '<button type="button" class="btn" data-action="admin-cancel">Done</button>' : ''}
    </div>
  </form>`;
}

// ---------------------------------------------------------------- photos

export function photosHTML(l) {
  const items = l.images
    .map((src, i) => `<li>
      <img src="${esc(src)}" alt="Photo ${i + 1} of ${esc(l.model)}" referrerpolicy="no-referrer">
      ${i === 0 ? '<span class="badge ok main">Main</span>' : ''}
      <div class="pacts">
        ${i === 0 ? '' : `<button type="button" class="btn small" data-action="photo-main" data-index="${i}">Make main</button>`}
        <button type="button" class="btn small danger" data-action="photo-remove" data-index="${i}" aria-label="Remove photo ${i + 1}">Remove</button>
      </div></li>`)
    .join('');
  return `<section class="panel-box" id="photos" aria-labelledby="photos-title">
    <h3 id="photos-title">Photos of ${esc(l.brand)} ${esc(l.model)} (${l.images.length} / 10)</h3>
    <p class="mu">The first photo is the main one shown on the cards. JPG, PNG or WebP, up to 5 MB each. Customers can open every photo full screen.</p>
    ${items ? `<ul class="pgrid">${items}</ul>` : '<p class="mu">No photos yet.</p>'}
    <div class="actions">
      <label class="btn primary file-btn"><input type="file" id="photo-input" class="sr-only" accept="image/jpeg,image/png,image/webp" multiple data-change="photo-files">${ICONS.upload} Add photos</label>
      <span id="photo-status" class="mu" role="status"></span>
    </div>
  </section>`;
}

const replaceLaptop = (laptop) => {
  const i = state.laptops.findIndex((x) => x.id === laptop.id);
  if (i >= 0) state.laptops[i] = laptop;
};

// ---------------------------------------------------------------- Excel import

export function importHTML() {
  return `<section class="panel-box" aria-labelledby="imp-title">
    <h3 id="imp-title">Import devices from Excel</h3>
    <p class="mu">Upload your price list (your own sheet works as it is: Type, Model, CPU, RAM, SSD | HDD, GPU, Display, Price, Photo) or the template. New devices are added, devices that already exist are updated, and customers see the changes straight away. An empty cell never erases existing data. Headers can be in English or Arabic.</p>
    <div class="actions">
      <a class="btn" href="/api/laptops/template.xlsx" download>${ICONS.download} Download the Excel template</a>
      <label class="btn primary file-btn"><input type="file" id="xl-input" class="sr-only" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" data-change="xl-file">${ICONS.sheet} Choose Excel / CSV file</label>
    </div>
    <div id="xl-report" aria-live="polite">${reportHTML()}</div>
  </section>`;
}

const chip = (n, label, cls = '') => `<span class="rchip ${cls}"><b>${n}</b> ${label}</span>`;

function previewTable(rows) {
  if (!rows.length) return '';
  const cur = store().currency;
  return `<div class="tw"><table class="tbl"><caption class="sr-only">What will change</caption>
    <thead><tr><th scope="col">Action</th><th scope="col">Laptop</th><th scope="col">Price</th><th scope="col">Changes</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td><span class="badge ${r.action === 'create' ? 'ok' : ''}">${r.action === 'create' ? 'New' : 'Update'}</span></td><td>${esc(r.label)}<div class="mu">${esc(r.detail ?? '')}</div></td><td>${money(r.price, cur)}</td><td class="mu">${esc((r.changes ?? []).join(', '))}</td></tr>`).join('')}</tbody></table></div>`;
}

function skippedList(skipped) {
  if (!skipped.length) return '';
  return `<div class="summary"><b>${skipped.length} row${skipped.length === 1 ? '' : 's'} will be skipped:</b><ul>${skipped.slice(0, 40).map((s) => `<li>Row ${s.row}: ${esc(s.message)}</li>`).join('')}</ul>${skipped.length > 40 ? `<p>…and ${skipped.length - 40} more</p>` : ''}</div>`;
}

function reportHTML() {
  const imp = state.import;
  if (!imp) return '';
  if (imp.busy) return `<p class="mu"><span class="dots"><i></i><i></i><i></i></span> ${esc(imp.busy)}</p>`;
  if (imp.error) return `<div class="summary" role="alert">${esc(imp.error)}</div>`;

  if (imp.done) {
    const r = imp.done;
    return `<div class="rep done"><p><b>Import finished</b> (${esc(imp.name)}). Customers can already see the new catalogue.</p>
      <div class="rchips">${chip(r.created, 'added', 'ok')}${chip(r.updated, 'updated')}${chip(r.unchanged, 'unchanged')}${r.removed ? chip(r.removed, 'removed', 'bad') : ''}${r.skipped.length ? chip(r.skipped.length, 'skipped', 'bad') : ''}</div>
      ${skippedList(r.skipped)}</div>`;
  }

  const r = imp.report;
  if (!r) return '';
  const nothing = !r.created && !r.updated && !r.removed;
  const notes = [
    r.priceListFormat ? 'Your price-list format was recognised: the brand and a clean product name were worked out from each model, CPU / storage / graphics were tidied, and each device\'s "View photos" link now searches for its exact name.' : '',
    r.sameModelTwice ? `${r.sameModelTwice} device${r.sameModelTwice === 1 ? ' appears' : 's appear'} twice with the same model and specs but a different price: both lines are kept.` : '',
  ].filter(Boolean);
  return `<div class="rep"><p><b>${esc(imp.name)}</b>: ${r.totalRows} row${r.totalRows === 1 ? '' : 's'} found. Nothing has been saved yet.</p>
    ${notes.map((n) => `<p class="mu">${esc(n)}</p>`).join('')}
    <div class="rchips">${chip(r.created, 'to add', 'ok')}${chip(r.updated, 'to update')}${chip(r.unchanged, 'unchanged')}${r.skipped.length ? chip(r.skipped.length, 'skipped', 'bad') : ''}${r.removed ? chip(r.removed, 'to remove', 'bad') : ''}</div>
    ${r.ignoredColumns.length ? `<p class="mu">Columns ignored: ${esc(r.ignoredColumns.join(', '))}</p>` : ''}
    ${previewTable(r.preview)}
    ${skippedList(r.skipped)}
    <div class="chk"><input type="checkbox" id="xl-replace" data-change="xl-replace" ${imp.replace ? 'checked' : ''}><label for="xl-replace">Also remove laptops that are not in this file (make the website match the sheet exactly)</label></div>
    ${imp.replace && r.removed ? `<p class="mu">Will remove: ${esc(r.removedNames.join(', '))}${r.removed > r.removedNames.length ? '…' : ''}</p>` : ''}
    <div class="actions"><button type="button" class="btn primary" data-action="xl-commit" ${nothing ? 'disabled' : ''}>Import now</button><button type="button" class="btn" data-action="xl-cancel">Cancel</button></div></div>`;
}

const renderReport = () => { const box = $('#xl-report'); if (box) box.innerHTML = reportHTML(); };

async function checkFile() {
  const imp = state.import;
  imp.busy = 'Checking your file…';
  imp.error = null;
  renderReport();
  try {
    imp.report = await api.importLaptops(imp.buffer, { dryRun: true, replace: imp.replace });
  } catch (err) {
    imp.error = err.message || 'We could not read this file.';
    imp.report = null;
  }
  imp.busy = null;
  renderReport();
}

// ---------------------------------------------------------------- inventory

const inventoryMatches = () => {
  const q = state.invQ.trim().toLowerCase();
  return q ? state.laptops.filter((l) => `${l.brand} ${l.model} ${l.type} ${l.cpu} ${l.ram} ${l.storage} ${l.price}`.toLowerCase().includes(q)) : state.laptops;
};

function inventoryRowsHTML(list) {
  const cur = store().currency;
  return list
    .slice(0, state.invShown)
    .map((l) => `<tr>
      <td><a href="#laptop/${encodeURIComponent(l.id)}"><b>${esc(l.brand)} ${esc(l.model)}</b></a>${l.type !== 'Laptop' ? ` <span class="badge">${esc(l.type)}</span>` : ''}
        <div class="mu">${esc([l.cpu, l.ram, l.storage].filter(Boolean).join(' · '))} · ${l.images.length} photo${l.images.length === 1 ? '' : 's'}</div></td>
      <td><label class="sr-only" for="p-${esc(l.id)}">Price of ${esc(l.model)}</label>
        <input type="number" id="p-${esc(l.id)}" value="${l.price}" min="1" step="1" inputmode="numeric"> <span class="mu">${esc(cur)}</span></td>
      <td><span class="badge ${l.inStock !== false ? 'ok' : 'off'}">${l.inStock !== false ? 'In stock' : 'Hidden'}</span></td>
      <td><div class="acts">
        <button type="button" class="btn small" data-action="admin-price" data-id="${esc(l.id)}">Save price</button>
        <button type="button" class="btn small" data-action="admin-edit" data-id="${esc(l.id)}">Edit and photos</button>
        <button type="button" class="btn small" data-action="admin-toggle" data-id="${esc(l.id)}">${l.inStock !== false ? 'Hide' : 'Show'}</button>
        <button type="button" class="btn small danger" data-action="admin-delete" data-id="${esc(l.id)}">Delete</button>
      </div></td>
    </tr>`)
    .join('');
}

const inventoryMoreHTML = (list) =>
  list.length > state.invShown
    ? `<button type="button" class="btn" data-action="inv-more">Show ${Math.min(40, list.length - state.invShown)} more (${list.length - state.invShown} left)</button>`
    : '';

function renderInventory() {
  const list = inventoryMatches();
  const body = $('#inv-body');
  if (!body) return;
  body.innerHTML = inventoryRowsHTML(list);
  $('#inv-more').innerHTML = inventoryMoreHTML(list);
  $('#inv-count').textContent = `${list.length} of ${state.laptops.length} devices`;
}

function inventoryHTML() {
  const cur = store().currency;
  const list = inventoryMatches();
  return `<div class="inv-tools"><label class="sr-only" for="inv-q">Filter the inventory</label>
      <input id="inv-q" type="search" placeholder="Filter by model, CPU, price…" value="${esc(state.invQ)}" data-input="inv-filter" autocomplete="off">
      <span class="mu" id="inv-count" role="status">${list.length} of ${state.laptops.length} devices</span></div>
    <div class="tw"><table class="tbl"><caption class="sr-only">Inventory (prices in ${esc(cur)})</caption>
    <thead><tr><th scope="col">Device</th><th scope="col">Price</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
    <tbody id="inv-body">${inventoryRowsHTML(list)}</tbody></table></div>
    <div class="morebar" id="inv-more">${inventoryMoreHTML(list)}</div>`;
}

export function adminPage() {
  if (!isAdmin()) return '<main class="wrap"><p>This area is for the store admin only.</p></main>';
  const editing = state.editingId ? byId(state.editingId) : null;
  return `<main class="wrap adm">
    <h2>Admin</h2>
    <p class="mu">Signed in as ${esc(state.user.email)}. Changes are saved on the server and appear for every visitor immediately.</p>
    ${importHTML()}
    <section class="panel-box">${formHTML()}</section>
    ${editing ? photosHTML(editing) : ''}
    <section class="panel-box"><h3>Inventory</h3>${inventoryHTML()}</section>
  </main>`;
}

// ---------------------------------------------------------------- handlers

/** Runs an admin action, then refreshes the data and the page. Errors become a toast. */
async function run(action, success) {
  try {
    await action();
    toast(success);
    await hooks.reloadAndRender();
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
  }
}

function clearErrors(form) {
  for (const el of form.querySelectorAll('.err')) el.textContent = '';
  for (const el of form.querySelectorAll('[aria-invalid]')) {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  }
  const summary = $('#form-errors');
  summary.hidden = true;
  summary.innerHTML = '';
}

/** Inline error under each field + a focusable summary at the top of the form. */
function showErrors(err) {
  const fields = err.fields ?? [];
  if (!fields.length) return toast(err.message, 'error');
  const items = [];
  for (const { field: name, message } of fields) {
    const input = name && $(`#f-${name}`);
    if (input) {
      $(`#e-${name}`).textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `e-${name}`);
    }
    items.push(`<li><button type="button" class="linkbtn" data-action="focus-field" data-field="${esc(name ?? '')}">${esc(LABELS[name] ?? name ?? 'Form')}: ${esc(message)}</button></li>`);
  }
  const summary = $('#form-errors');
  summary.innerHTML = `<b>Please fix ${fields.length} ${fields.length === 1 ? 'field' : 'fields'}:</b><ul>${items.join('')}</ul>`;
  summary.hidden = false;
  summary.focus();
}

export function registerAdminHandlers() {
  onInput('inv-filter', debounce((el) => {
    state.invQ = el.value;
    state.invShown = 40;
    renderInventory();
  }, 120));
  onClick('inv-more', () => {
    state.invShown += 40;
    renderInventory();
  });

  // ----- add / edit a laptop
  onSubmit('admin-save', async (form) => {
    clearErrors(form);
    const data = new FormData(form);
    const body = Object.fromEntries(TEXT_KEYS.map((k) => [k, String(data.get(k) ?? '').trim()]));
    body.price = Number(body.price);
    body.inStock = form.elements.inStock.checked;
    const editing = state.editingId;
    try {
      let savedId = editing;
      if (editing) await api.updateLaptop(editing, body);
      else savedId = (await api.createLaptop(body)).laptop.id;
      state.editingId = savedId; // stay on the laptop so photos can be added right away
      toast(editing ? 'Changes saved' : 'Laptop added. You can add its photos below.');
      await hooks.reloadAndRender();
      if (!editing) $('#photos')?.scrollIntoView({ block: 'start' });
    } catch (err) {
      showErrors(err instanceof ApiError ? err : new ApiError(0, 'Something went wrong.'));
    }
  });

  onClick('focus-field', (el) => $(`#f-${el.dataset.field}`)?.focus());

  onClick('admin-edit', (el) => {
    state.editingId = el.dataset.id;
    hooks.renderPage({ animate: false });
    $('#form-title')?.scrollIntoView({ block: 'start' });
    $('#f-brand')?.focus({ preventScroll: true });
  });

  onClick('admin-cancel', () => {
    state.editingId = null;
    hooks.renderPage({ animate: false });
  });

  onClick('admin-price', (el) => {
    const price = Number($(`#p-${CSS.escape(el.dataset.id)}`).value);
    return run(() => api.updateLaptop(el.dataset.id, { price }), 'Price updated');
  });

  onClick('admin-toggle', (el) => {
    const laptop = byId(el.dataset.id);
    return run(() => api.updateLaptop(laptop.id, { inStock: laptop.inStock === false }), laptop.inStock === false ? 'Now visible' : 'Now hidden');
  });

  onClick('admin-delete', (el) => {
    const laptop = byId(el.dataset.id);
    if (!confirm(`Delete ${laptop.brand} ${laptop.model} and its photos? This cannot be undone.`)) return;
    if (state.editingId === laptop.id) state.editingId = null;
    return run(() => api.deleteLaptop(laptop.id), 'Laptop deleted');
  });

  // ----- photos (updates only the photo section, so unsaved form text is not lost)
  const refreshPhotos = (laptop) => {
    replaceLaptop(laptop);
    const box = $('#photos');
    if (box) box.outerHTML = photosHTML(laptop);
  };

  onChange('photo-files', async (input) => {
    const id = state.editingId;
    const files = [...input.files];
    input.value = '';
    const status = $('#photo-status');
    let added = 0;
    for (const [i, file] of files.entries()) {
      if (!PHOTO_TYPES.includes(file.type)) { toast(`${file.name}: please choose a JPG, PNG or WebP photo`, 'error'); continue; }
      if (file.size > MAX_PHOTO_BYTES) { toast(`${file.name} is larger than 5 MB`, 'error'); continue; }
      if (status) status.textContent = `Uploading ${i + 1} of ${files.length}…`;
      try {
        refreshPhotos((await api.uploadPhoto(id, file)).laptop);
        added += 1;
      } catch (err) {
        toast(err.message || 'Upload failed', 'error');
        break;
      }
    }
    const done = $('#photo-status');
    if (done) done.textContent = added ? `${added} photo${added === 1 ? '' : 's'} added.` : '';
  });

  onClick('photo-remove', async (el) => {
    try {
      refreshPhotos((await api.removePhoto(state.editingId, Number(el.dataset.index))).laptop);
      toast('Photo removed');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  onClick('photo-main', async (el) => {
    const l = byId(state.editingId);
    const index = Number(el.dataset.index);
    const images = [l.images[index], ...l.images.filter((_, i) => i !== index)];
    try {
      refreshPhotos((await api.updateLaptop(l.id, { images })).laptop);
      toast('Main photo changed');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ----- Excel import
  onChange('xl-file', async (input) => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      state.import = { name: file.name, error: 'This file is larger than 5 MB.' };
      return renderReport();
    }
    state.import = { name: file.name, buffer: await file.arrayBuffer(), replace: false };
    await checkFile();
  });

  onChange('xl-replace', async (el) => {
    state.import.replace = el.checked;
    await checkFile();
  });

  onClick('xl-cancel', () => {
    state.import = null;
    renderReport();
  });

  onClick('xl-commit', async () => {
    const imp = state.import;
    if (imp.replace && imp.report.removed > 0 && !confirm(`This will delete ${imp.report.removed} laptop(s) that are not in the file. Continue?`)) return;
    imp.busy = 'Importing…';
    renderReport();
    try {
      const done = await api.importLaptops(imp.buffer, { dryRun: false, replace: imp.replace });
      state.import = { name: imp.name, done };
      state.editingId = null;
      toast(`Imported: ${done.created} added, ${done.updated} updated`);
      await hooks.reloadAndRender();
    } catch (err) {
      imp.busy = null;
      imp.error = err.message || 'The import failed.';
      renderReport();
    }
  });
}
