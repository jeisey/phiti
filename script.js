const CSV_URL = "graffiti.csv";
// If you hit CORS issues on GitHub Pages, try the workaround below:
// const CSV_URL = "https://corsproxy.io/?" + encodeURIComponent("https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv");

const CARDS_PER_BATCH = 18; // for lazy loading

// --- UTILS ---
function parseCSV(str) {
  const rows = str.replace(/\r/g, '').split('\n');
  const headers = rows.shift().split(',');
  return rows.filter(Boolean).map(row => {
    let val = '', inQuotes = false, arr = [], c;
    for (let i=0; i<row.length; ++i) {
      c = row[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) { arr.push(val); val = ''; }
      else val += c;
    }
    arr.push(val);
    return Object.fromEntries(headers.map((h, i) => [h, arr[i] || ""]));
  });
}

// --- DOM ---
const $gallery = document.getElementById('gallery');
const $loader = document.getElementById('loader');
const filters = {
  area: document.getElementById('area'),
  status: document.getElementById('status'),
  zipcode: document.getElementById('zipcode'),
  date: document.getElementById('date')
};
const $randomBtn = document.getElementById('randomBtn');
const $search = document.getElementById('search');

let graffitiData = [];
let filtered = [];
let lazyPointer = 0; // pointer to track batches

// --- INIT ---
async function init() {
  showLoader(true);
  let csvText;
  try {
    csvText = await fetch(CSV_URL).then(r => r.text());
  } catch (e) {
    $gallery.innerHTML = `<div style="color:red; font-size:1.2em;">Error loading data. Please try again later.</div>`;
    showLoader(false);
    return;
  }
  graffitiData = parseCSV(csvText);
  prepFilters();
  render(true); // first render, reset pointer
  showLoader(false);
  setupLazyLoad();
}

function showLoader(state) {
  $loader.classList.toggle('hidden', !state);
}

function prepFilters() {
  // Area (ordered)
  const areas = unique(graffitiData.map(g => g.area).filter(Boolean)).sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  filters.area.innerHTML = `<option value="">All</option>` + areas.map(a => `<option>${a}</option>`).join('');
  // Status (ordered)
  const statuses = unique(graffitiData.map(g => g.status).filter(Boolean)).sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  filters.status.innerHTML = `<option value="">All</option>` + statuses.map(s => `<option>${s}</option>`).join('');
  // Zipcode (top 50, ordered)
  const zips = unique(graffitiData.map(g => g.zipcode).filter(Boolean)).sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'})).slice(0,50);
  filters.zipcode.innerHTML = `<option value="">All</option>` + zips.map(z => `<option>${z}</option>`).join('');
  // Year from requested_datetime (ordered)
  const years = unique(graffitiData.map(g =>
    g.requested_datetime ? g.requested_datetime.slice(0,4) : null
  ).filter(Boolean)).sort();
  filters.date.innerHTML = `<option value="">All</option>` + years.map(y => `<option>${y}</option>`).join('');
  // Listeners
  Object.values(filters).forEach(sel => sel.onchange = () => render(true));
  $search.oninput = () => render(true);
  $randomBtn.onclick = showRandom;
}

// --- HELPERS ---
function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean).map(x => x.trim())));
}

// --- SEARCH & FILTERS ---
function applyFiltersAndSearch() {
  let arr = graffitiData;
  if (filters.area.value) arr = arr.filter(g => g.area === filters.area.value);
  if (filters.status.value) arr = arr.filter(g => g.status === filters.status.value);
  if (filters.zipcode.value) arr = arr.filter(g => g.zipcode === filters.zipcode.value);
  if (filters.date.value) arr = arr.filter(g => g.requested_datetime.startsWith(filters.date.value));
  if ($search.value.trim()) {
    const term = $search.value.trim().toLowerCase();
    arr = arr.filter(g =>
      (g.address && g.address.toLowerCase().includes(term)) ||
      (g.status_notes && g.status_notes.toLowerCase().includes(term)) ||
      (g.area && g.area.toLowerCase().includes(term)) ||
      (g.zipcode && g.zipcode.toLowerCase().includes(term))
    );
  }
  return arr;
}

// --- MAIN RENDER with LAZY LOADING ---
function render(resetPointer = false) {
  if (resetPointer) lazyPointer = 0;
  $gallery.innerHTML = '';
  filtered = applyFiltersAndSearch();
  if (!filtered.length) {
    $gallery.innerHTML = `<div style="color:#f53753;font-size:1.2em;padding:2.5em;text-align:center;">No graffiti matches these filters. Try relaxing your search!</div>`;
    return;
  }
  // Render initial batch
  renderBatch();
}

// Render a batch (e.g., on scroll)
function renderBatch() {
  const start = lazyPointer;
  const end = Math.min(filtered.length, lazyPointer + CARDS_PER_BATCH);
  for (let i = start; i < end; ++i) {
    $gallery.appendChild(makeCard(filtered[i]));
  }
  lazyPointer = end;
  // If all loaded, stop lazy loading
  if (lazyPointer >= filtered.length) detachScroll();
  else attachScroll();
}

// --- GRAFFITI CARD UI (with hover style already in CSS) ---
function makeCard(g) {
  const card = document.createElement('div');
  card.className = "graffiti-card";
  // Image wrapper
  const imgWrap = document.createElement('div');
  imgWrap.className = 'img-wrapper';
  const img = document.createElement('img');
  img.src = g.media_url;
  img.alt = "Graffiti image";
  img.loading = "lazy";
  img.onerror = () => img.src = "https://pbs.twimg.com/profile_images/1110545067683524609/RINKPxjE_400x400.png";
  // === ENLARGE ON CLICK ===
  img.onclick = () => showLightbox(g.media_url);
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);
  // Info
  const info = document.createElement('div');
  info.className = 'graffiti-info';
  info.innerHTML = `
    <div class="address">${g.address} <span class="chip">${g.area || "?"}</span></div>
    <div class="graffiti-meta"><strong>Status:</strong>
      <span class="status">${g.status}</span>
      <span class="date">(${g.requested_datetime ? g.requested_datetime.slice(0,10) : ''})</span>
    </div>
    <div class="graffiti-meta"><strong>Time to Close:</strong> ${g.time_to_close || "?"} days</div>
    <div class="graffiti-meta"><strong>Notes:</strong> ${g.status_notes || '-'}</div>
    <div class="graffiti-meta"><strong>Zipcode:</strong> ${g.zipcode}</div>
  `;
  card.appendChild(info);
  return card;
}

// --- LIGHTBOX LOGIC ---
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxBg = document.querySelector('.lightbox-bg');

function showLightbox(url) {
  lightbox.classList.remove('hidden');
  lightboxImg.src = url;
  lightboxImg.alt = "Graffiti - full view";
}
function hideLightbox() {
  lightbox.classList.add('hidden');
  lightboxImg.src = "";
}
lightboxClose.onclick = hideLightbox;
lightboxBg.onclick = hideLightbox;
window.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('hidden') && (e.key === 'Escape' || e.key === ' ')) {
    hideLightbox();
  }
});


// --- RANDOM ---
function showRandom() {
  if (!filtered.length) return;
  const i = Math.floor(Math.random() * filtered.length);
  $gallery.innerHTML = '';
  $gallery.appendChild(makeCard(filtered[i]));
  lazyPointer = filtered.length; // prevent infinite scroll after random
  detachScroll();
}

// --- LAZY LOADING ---
function setupLazyLoad() {
  window.addEventListener('scroll', onScrollThrottled);
}
function attachScroll() {
  window.addEventListener('scroll', onScrollThrottled);
}
function detachScroll() {
  window.removeEventListener('scroll', onScrollThrottled);
}
let scrollTimeout = null;
function onScrollThrottled() {
  if (scrollTimeout) return;
  scrollTimeout = setTimeout(() => {
    scrollTimeout = null;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 250) {
      renderBatch();
    }
  }, 120);
}

// --- START ---
init();
