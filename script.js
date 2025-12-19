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
    for (let i = 0; i < row.length; ++i) {
      c = row[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        arr.push(val);
        val = '';
      } else {
        val += c;
      }
    }
    arr.push(val);
    const obj = Object.fromEntries(headers.map((h, i) => [h, arr[i] || ""]));
    // Trim whitespace from all string values
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim();
      }
    }
    return obj;
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
const $clearBtn = document.getElementById('clearBtn');
const $search = document.getElementById('search');
const $resultsCount = document.getElementById('results-count');

let graffitiData = [];
let filtered = [];
let lazyPointer = 0;
let lastFocus = null;  // will hold the last focused element before opening lightbox

// --- INIT ---
async function init() {
  showLoader(true);
  let csvText;
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`Failed to load CSV: ${response.status}`);
    csvText = await response.text();
  } catch (e) {
    $gallery.innerHTML = '<div style="color:red; font-size:1.2em;">Error loading data. Please try again later.</div>';
    showLoader(false);
    return;
  }
  graffitiData = parseCSV(csvText);
  prepFilters();
  render(true);  // initial render (resets lazyPointer)
  showLoader(false);
  setupLazyLoad();
}

function showLoader(state) {
  $loader.classList.toggle('hidden', !state);
}

function prepFilters() {
  // Populate filter dropdowns with unique values
  const areas = unique(graffitiData.map(g => g.area).filter(Boolean))
    .sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  filters.area.innerHTML = '<option value="">All</option>' + areas.map(a => `<option>${a}</option>`).join('');
  const statuses = unique(graffitiData.map(g => g.status).filter(Boolean))
    .sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  filters.status.innerHTML = '<option value="">All</option>' + statuses.map(s => `<option>${s}</option>`).join('');
  const zips = unique(graffitiData.map(g => g.zipcode).filter(Boolean))
    .sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}))
    .slice(0, 50);
  filters.zipcode.innerHTML = '<option value="">All</option>' + zips.map(z => `<option>${z}</option>`).join('');
  const years = unique(graffitiData.map(g =>
    g.requested_datetime ? g.requested_datetime.slice(0,4) : null
  ).filter(Boolean)).sort();
  filters.date.innerHTML = '<option value="">All</option>' + years.map(y => `<option>${y}</option>`).join('');
  // Filter event listeners
  Object.values(filters).forEach(select => select.onchange = () => render(true));
  $search.oninput = () => render(true);
  $randomBtn.onclick = showRandom;
  $clearBtn.onclick = clearFilters;
}

// --- CLEAR FILTERS ---
function clearFilters() {
  filters.area.value = '';
  filters.status.value = '';
  filters.zipcode.value = '';
  filters.date.value = '';
  $search.value = '';
  render(true);
}

// --- UPDATE RESULTS COUNT ---
function updateResultsCount() {
  const total = graffitiData.length;
  const shown = filtered.length;
  if (total === 0) {
    $resultsCount.textContent = '';
  } else if (shown === total) {
    $resultsCount.textContent = `Showing all ${total.toLocaleString()} records`;
  } else {
    $resultsCount.textContent = `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} records`;
  }
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

// --- MAIN RENDER + LAZY LOADING ---
function render(resetPointer = false) {
  if (resetPointer) lazyPointer = 0;
  $gallery.innerHTML = '';
  filtered = applyFiltersAndSearch();
  updateResultsCount();
  if (!filtered.length) {
    $gallery.innerHTML = '<div style="color:#f53753;font-size:1.2em;padding:2.5em;text-align:center;">No graffiti matches these filters. Try relaxing your search!</div>';
    return;
  }
  // Render initial batch of cards
  renderBatch();
}

function renderBatch() {
  const start = lazyPointer;
  const end = Math.min(filtered.length, lazyPointer + CARDS_PER_BATCH);
  for (let i = start; i < end; ++i) {
    $gallery.appendChild(makeCard(filtered[i]));
  }
  lazyPointer = end;
  // Attach or detach scroll listener based on whether more cards remain
  if (lazyPointer >= filtered.length) detachScroll();
  else attachScroll();
}

// --- GRAFFITI CARD UI ---
function makeCard(g) {
  const card = document.createElement('div');
  card.className = 'graffiti-card';
  // Image
  const imgWrap = document.createElement('div');
  imgWrap.className = 'img-wrapper';
  const img = document.createElement('img');
  img.src = g.media_url;
  img.alt = g.address ? `Graffiti at ${g.address}` : 'Graffiti image';
  img.loading = 'lazy';
  img.onerror = () => { 
    // Fallback image if original fails
    img.src = 'https://pbs.twimg.com/profile_images/1110545067683524609/RINKPxjE_400x400.png'; 
  };
  // Make image clickable and keyboard-accessible
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  img.setAttribute('aria-label', g.address ? `View full graffiti image at ${g.address}` : 'View full graffiti image');
  img.onclick = () => showLightbox(g.media_url, img.alt);
  img.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      showLightbox(g.media_url, img.alt);
    }
  };
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);
  // Info text
  const info = document.createElement('div');
  info.className = 'graffiti-info';
  info.innerHTML = `
    <div class="address">${g.address} <span class="chip">${g.area || "?"}</span></div>
    <div class="graffiti-meta"><strong>Status:</strong>
      <span class="status">${g.status}</span>
      <span class="date">(${g.requested_datetime ? g.requested_datetime.slice(0,10) : ''})</span>
    </div>
    <div class="graffiti-meta"><strong>Time to Close:</strong> ${g.time_to_close || '-'} days</div>
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

function showLightbox(url, altText) {
  lastFocus = document.activeElement;
  lightbox.classList.remove('hidden');
  lightboxImg.src = url;
  lightboxImg.alt = altText || 'Graffiti - full view';
  lightboxClose.focus();
}
function hideLightbox() {
  lightbox.classList.add('hidden');
  lightboxImg.src = "";
  if (lastFocus) lastFocus.focus();
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
  lazyPointer = filtered.length;  // stop infinite scroll after showing one
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
