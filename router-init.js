// App state, data loading, and interaction bindings.

let TOPICS = {};
let CONFIG = {};
let STATE = { views: [], byId: {}, dailyViews: [], currentWeek: '', defaultId: '' };
const READ_STORE = 'morning-desk:read:v1';
const THEME_STORE = 'morning-desk:theme';
const UI = {
  currentView: null,
  allItems: [],
  filteredItems: [],
  topicCounts: [],
  topic: 'all',
  query: '',
  selectedId: '',
  readIds: new Set(loadStoredArray(READ_STORE)),
  lastFeedTrigger: null
};

function loadStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function persistReadIds() {
  try { localStorage.setItem(READ_STORE, JSON.stringify(Array.from(UI.readIds).slice(-1000))); } catch (_) {}
}

function announce(message) {
  document.getElementById('live-region').textContent = message;
}

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.body.toggleAttribute('data-theme', isDark);
  if (isDark) document.body.setAttribute('data-theme', 'dark');
  document.getElementById('theme-toggle').setAttribute('aria-pressed', String(isDark));
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#101512' : '#f4f7f5';
  try { localStorage.setItem(THEME_STORE, isDark ? 'dark' : 'light'); } catch (_) {}
}

function setAccessibleHidden(element, hidden) {
  element.inert = hidden;
  element.setAttribute('aria-hidden', String(hidden));
}

function syncResponsivePaneState() {
  const archive = document.getElementById('archive-pane');
  const reader = document.getElementById('reader-pane');
  const feed = document.getElementById('feed-pane');
  const topbar = document.querySelector('.topbar');
  const archiveIsOverlay = window.innerWidth <= 1180;
  const readerIsOverlay = true;

  if (!archiveIsOverlay) archive.classList.remove('open');
  const archiveOpen = archiveIsOverlay && archive.classList.contains('open');
  const readerOpen = readerIsOverlay && reader.classList.contains('open');
  const archiveHidden = (archiveIsOverlay && !archiveOpen) || readerOpen;
  const archiveModalOpen = archiveOpen && !readerOpen;

  setAccessibleHidden(archive, archiveHidden);
  setAccessibleHidden(reader, readerIsOverlay && !readerOpen);
  setAccessibleHidden(feed, readerOpen || archiveModalOpen);
  setAccessibleHidden(topbar, readerOpen || archiveModalOpen);
  document.getElementById('nav-toggle').setAttribute('aria-expanded', String(archiveOpen));

  if (archiveModalOpen) {
    archive.setAttribute('role', 'dialog');
    archive.setAttribute('aria-modal', 'true');
  } else {
    archive.removeAttribute('role');
    archive.removeAttribute('aria-modal');
  }

  if (readerOpen) {
    reader.setAttribute('role', 'dialog');
    reader.setAttribute('aria-modal', 'true');
  } else {
    reader.removeAttribute('role');
    reader.removeAttribute('aria-modal');
  }
}

function toggleArchive(force) {
  const pane = document.getElementById('archive-pane');
  const wasOpen = pane.classList.contains('open');
  const open = typeof force === 'boolean' ? force : !pane.classList.contains('open');
  pane.classList.toggle('open', open);
  document.getElementById('nav-backdrop').classList.toggle('show', open);
  syncResponsivePaneState();
  if (open) pane.querySelector('a, button')?.focus();
  else if (wasOpen && window.innerWidth <= 1180) {
    document.getElementById('nav-toggle').focus({ preventScroll: true });
  }
}

function trapOverlayFocus(event, container) {
  const focusable = Array.from(container.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function openReader() {
  const reader = document.getElementById('reader-pane');
  toggleArchive(false);
  reader.classList.add('open');
  document.getElementById('reader-backdrop').classList.add('show');
  document.body.classList.add('reader-open');
  syncResponsivePaneState();
  (reader.querySelector('[data-close-reader]') || reader).focus({ preventScroll: true });
}

function closeReader() {
  const reader = document.getElementById('reader-pane');
  if (!reader.classList.contains('open')) return;
  reader.classList.remove('open');
  document.getElementById('reader-backdrop').classList.remove('show');
  document.body.classList.remove('reader-open');
  syncResponsivePaneState();
  UI.lastFeedTrigger?.focus({ preventScroll: true });
}

function bindEvents() {
  const search = document.getElementById('search-input');
  document.getElementById('nav-toggle').addEventListener('click', () => toggleArchive());
  document.getElementById('nav-close').addEventListener('click', () => toggleArchive(false));
  document.getElementById('nav-backdrop').addEventListener('click', () => toggleArchive(false));
  document.getElementById('reader-backdrop').addEventListener('click', closeReader);

  document.getElementById('archive-nav').addEventListener('click', event => {
    const topic = event.target.closest('[data-topic]');
    if (topic) {
      UI.topic = topic.dataset.topic;
      applyFeedFilter({ resetScroll: true });
      if (window.innerWidth <= 1180) toggleArchive(false);
      return;
    }
    if (event.target.closest('[data-view-id]') && window.innerWidth <= 1180) toggleArchive(false);
  });

  document.getElementById('topic-strip').addEventListener('click', event => {
    const button = event.target.closest('[data-topic]');
    if (!button) return;
    UI.topic = button.dataset.topic;
    applyFeedFilter({ resetScroll: true });
  });

  document.getElementById('feed-list').addEventListener('click', event => {
    if (event.target.closest('[data-retry-load]')) return location.reload();
    if (event.target.closest('[data-reset-feed]')) {
      UI.query = '';
      UI.topic = 'all';
      search.value = '';
      applyFeedFilter({ resetScroll: true });
      search.focus({ preventScroll: true });
      announce('Đã hiển thị toàn bộ bản tin');
      return;
    }
    const row = event.target.closest('[data-story-id]');
    if (!row) return;
    UI.lastFeedTrigger = row;
    selectStory(row.dataset.storyId);
    openReader();
  });

  document.getElementById('reader-pane').addEventListener('click', async event => {
    if (event.target.closest('[data-close-reader]')) return closeReader();
    const step = event.target.closest('[data-reader-step]');
    if (step) return stepStory(Number(step.dataset.readerStep), { restoreFocus: true });
    if (event.target.closest('[data-copy-story]')) {
      const copyButton = event.target.closest('[data-copy-story]');
      const copyButtonMarkup = copyButton.innerHTML;
      const item = UI.filteredItems.find(candidate => candidate.id === UI.selectedId);
      if (!item) return;
      const value = item.url || `${location.origin}${location.pathname}${location.hash}`;
      try {
        await navigator.clipboard.writeText(value);
        copyButton.classList.add('copied');
        copyButton.setAttribute('aria-label', 'Đã sao chép liên kết nguồn');
        copyButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Đã chép</span>';
        announce('Đã sao chép liên kết');
        setTimeout(() => {
          if (!copyButton.isConnected) return;
          copyButton.classList.remove('copied');
          copyButton.setAttribute('aria-label', 'Sao chép liên kết nguồn');
          copyButton.innerHTML = copyButtonMarkup;
        }, 1800);
      } catch (_) {
        copyButton.setAttribute('aria-label', 'Không thể sao chép liên kết');
        announce('Không thể sao chép liên kết');
      }
    }
  });

  search.addEventListener('input', () => {
    UI.query = search.value;
    applyFeedFilter({ resetScroll: true });
  });

  document.getElementById('mark-all-read').addEventListener('click', () => {
    UI.filteredItems.forEach(item => UI.readIds.add(item.id));
    persistReadIds();
    applyFeedFilter();
    announce(`Đã đánh dấu ${UI.filteredItems.length} tin là đã đọc`);
  });

  // Condense the masthead once the feed scrolls so it stops costing a quarter of the
  // viewport. Separate on/off thresholds keep it from flickering at the boundary.
  const feedList = document.getElementById('feed-list');
  const feedPane = document.getElementById('feed-pane');
  feedList.addEventListener('scroll', () => {
    const top = feedList.scrollTop;
    if (top > 48) feedPane.classList.add('condensed');
    else if (top < 8) feedPane.classList.remove('condensed');
  }, { passive: true });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // A real hash change (archive click, story open, back/forward) marks the reader as
  // having navigated — history.replaceState does NOT fire this event, so it cleanly
  // distinguishes intentional navigation from our own programmatic view syncing.
  window.addEventListener('hashchange', () => { userNavigated = true; renderActiveView(); });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) toggleArchive(false);
    syncResponsivePaneState();
  });

  document.addEventListener('keydown', event => {
    const typing = /INPUT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable;
    if (event.key === '/' && !typing) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape') {
      if (document.getElementById('reader-pane').classList.contains('open')) closeReader();
      else toggleArchive(false);
    }
    if (event.key === 'Tab') {
      const reader = document.getElementById('reader-pane');
      const archive = document.getElementById('archive-pane');
      if (reader.classList.contains('open')) trapOverlayFocus(event, reader);
      else if (archive.classList.contains('open') && window.innerWidth <= 1180) trapOverlayFocus(event, archive);
    }
    if (!typing && (event.key === 'j' || event.key === 'ArrowDown') && event.altKey) stepStory(1, { restoreFocus: true });
    if (!typing && (event.key === 'k' || event.key === 'ArrowUp') && event.altKey) stepStory(-1, { restoreFocus: true });
  });

  syncResponsivePaneState();
}

// ── Data loading: small "latest" file first, full archive in the background ──
// The pipeline writes two daily files: latest.json (newest 7 days, ~36 KB gzip) and
// cards.json (rolling 30 days, ~290 KB gzip). The page needs only the first to show
// today's digest, so it:
//   1) paints instantly from a localStorage copy of the last good latest.json,
//   2) revalidates latest.json with `cache: 'no-cache'` (If-None-Match → 304 when
//      unchanged) and re-renders only if the payload differs,
//   3) fetches cards.json when the browser is idle, purely to add the older weeks
//      to the archive — it never blocks or resets the feed being read.
// cards.json is not copied into localStorage (it would hold ~800 KB of the quota).
const DATA_CACHE_PREFIX = 'caman:data:';
const LATEST_PATH = 'latest.json';
const ARCHIVE_PATH = 'cards.json';

function readCache(path) {
  try {
    const raw = localStorage.getItem(DATA_CACHE_PREFIX + path);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function writeCache(path, data) {
  try {
    localStorage.setItem(DATA_CACHE_PREFIX + path, JSON.stringify(data));
  } catch (_) { /* quota exceeded / private mode — HTTP cache still applies */ }
}

async function fetchJson(path, { required = false, persist = true } = {}) {
  try {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const data = await response.json();
    if (persist) writeCache(path, data);
    return data;
  } catch (error) {
    const cached = readCache(path);
    if (cached) return cached;               // offline / transient error → last good copy
    if (required) throw new Error('Không thể kết nối tới dữ liệu bản tin.');
    console.warn(`Không tải được ${path}:`, error);
    return [];
  }
}

function applyConfig(config) {
  if (!config || Array.isArray(config)) return;
  CONFIG = config;
  TOPICS = {};
  Object.values(CONFIG.topics || {}).forEach(topic => {
    if (topic.output_field) TOPICS[topic.output_field] = topic;
  });
  const site = CONFIG.site || {};
  if (site.title) {
    const title = stripLeadingSymbols(site.title);
    const el = document.getElementById('site-title');
    if (el) el.textContent = title;
    document.title = title;
  }
}

// Cheap change signature — skips a redundant re-render (and its flicker/scroll reset)
// when revalidation returns data identical to what is already painted.
function dataSig(daily, weekly, monthly) {
  const first = (daily && daily[0]) || {};
  const firstItems = Object.values(first).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  return [
    (daily || []).length, first.date || '', firstItems, first.eveningNotified ? 1 : 0,
    (weekly || []).length, (monthly || []).length
  ].join('|');
}

// Set once the reader intentionally navigates (see hashchange listener), so a fresh
// page load can snap to the latest digest without ever yanking an active reader.
let userNavigated = false;

function sameItemIds(a, b) {
  return a.length === b.length && a.every((item, index) => item.id === b[index].id);
}

// soft: the data grew around the reader (older archive weeks, weekly/monthly rollups).
// If the view on screen still holds the same stories, refresh only the archive nav —
// a full re-render would rebuild the feed and throw away the scroll position.
function renderData(daily, weekly, monthly, { forceLatest = false, soft = false } = {}) {
  STATE = buildViews(daily, weekly || [], monthly || []);
  // Land on the newest card (today) when: the URL has no hash, OR this is a fresh load
  // (forceLatest) and the reader hasn't navigated yet — this overrides a stale day-hash
  // the browser carried over from a previous visit (e.g. .../morning/#card-2026-08-13).
  if (STATE.defaultId && (!location.hash || (forceLatest && !userNavigated))) {
    history.replaceState(null, '', `#${STATE.defaultId}`);
  }
  const view = activeViewFromHash();
  if (soft && view && UI.currentView && view.id === UI.currentView.id && sameItemIds(flattenView(view), UI.allItems)) {
    UI.currentView = view;
    renderArchiveNav();
  } else {
    renderActiveView();
  }
  return dataSig(daily, weekly, monthly);
}

// Newest-first union by date; cards already on screen (from latest.json) win.
function mergeDaily(current, archive) {
  const seen = new Set(current.map(card => card.date));
  return current.concat(archive.filter(card => card && card.date && !seen.has(card.date)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function whenIdle(task) {
  if (window.requestIdleCallback) window.requestIdleCallback(task, { timeout: 3000 });
  else setTimeout(task, 300);
}

const hasCards = value => Array.isArray(value) && value.length > 0;

async function init() {
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date());
  document.getElementById('today-label').textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  let savedTheme = 'light';
  try { savedTheme = localStorage.getItem(THEME_STORE) || 'light'; } catch (_) {}
  setTheme(savedTheme);
  bindEvents();

  // Earlier versions cached the whole 30-day archive here — give that quota back.
  try { localStorage.removeItem(DATA_CACHE_PREFIX + ARCHIVE_PATH); } catch (_) {}

  // Config: instant from cache, revalidate in the background (title / topic labels).
  applyConfig(readCache('config.json'));
  fetchJson('config.json').then(applyConfig).catch(() => {});

  const cachedLatest = readCache(LATEST_PATH);
  let daily = hasCards(cachedLatest) ? cachedLatest : [];
  let weekly = readCache('weekly.json');
  let monthly = readCache('monthly.json');
  let renderedSig = '';
  const paint = options => {
    if (dataSig(daily, weekly, monthly) !== renderedSig) renderedSig = renderData(daily, weekly, monthly, options);
  };

  // 1) Instant paint from the last good copy (if any) — zero network wait.
  if (daily.length) paint({ forceLatest: true });

  // Weekly + monthly only feed archive summaries / month views — fetch them alongside
  // the digest and fold them in once it is on screen.
  const rollups = Promise.all([fetchJson('weekly.json'), fetchJson('monthly.json')]);

  // 2) Revalidate the latest digest (critical path) and paint it as soon as it lands.
  //    If latest.json is unavailable, the full archive is the fallback source.
  let archiveLoaded = false;
  let fresh = await fetchJson(LATEST_PATH);
  if (!hasCards(fresh)) {
    fresh = await fetchJson(ARCHIVE_PATH, { required: !daily.length, persist: false });
    archiveLoaded = hasCards(fresh);
  }
  if (hasCards(fresh)) {
    daily = fresh;
    paint({ forceLatest: true });
  } else if (!daily.length) {
    throw new Error('Không thể kết nối tới dữ liệu bản tin.');
  }

  rollups.then(([freshWeekly, freshMonthly]) => {
    weekly = freshWeekly;
    monthly = freshMonthly;
    paint({ soft: true });
  }).catch(() => {});

  // 3) Older archive weeks: fetched once the page is idle, merged without touching
  //    the feed on screen.
  if (!archiveLoaded) {
    whenIdle(async () => {
      const archive = await fetchJson(ARCHIVE_PATH, { persist: false });
      if (!hasCards(archive)) return;
      daily = mergeDaily(daily, archive);
      paint({ soft: true });
    });
  }
}

init().catch(error => {
  document.getElementById('archive-nav').setAttribute('aria-busy', 'false');
  const feed = document.getElementById('feed-list');
  feed.setAttribute('aria-busy', 'false');
  feed.innerHTML = emptyStateHtml('error', error.message);
  document.getElementById('feed-title').textContent = 'Bản tin tạm gián đoạn';
  document.getElementById('feed-summary').textContent = 'Thử tải lại để tiếp tục phiên đọc.';
  announce('Không tải được bản tin');
});
