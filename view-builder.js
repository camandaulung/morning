// View registry and rendering orchestration for archive, feed, and reader panes.

function buildViews(daily, weekly, monthly) {
  const views = [];
  const byId = {};
  const dailyViews = [];
  const weekGroups = {};
  daily.forEach(card => {
    const key = monthWeekKey(card.date);
    (weekGroups[key] = weekGroups[key] || []).push(card);
  });

  const weeklyByKey = {};
  (weekly || []).forEach(summary => {
    if (summary.fromDate) weeklyByKey[monthWeekKey(summary.fromDate)] = summary;
  });

  const weekKeys = Object.keys(weekGroups).sort().reverse();
  const currentWeek = weekKeys[0] || monthWeekKey(todayStr());
  weekKeys.forEach(key => {
    const days = weekGroups[key].sort((a, b) => b.date.localeCompare(a.date));
    const view = {
      id: `weekgroup-${key}`,
      type: 'weekgroup',
      data: days,
      monthKey: key.slice(0, 7),
      weekKey: key,
      label: weekLabelText(key),
      summary: weeklyByKey[key] || null,
      isCurrent: key === currentWeek
    };
    views.push(view);
    byId[view.id] = view;
    days.forEach(card => {
      const dailyView = {
        id: `card-${card.date}`,
        type: 'daily',
        data: card,
        monthKey: card.date.slice(0, 7),
        label: `${card.dayLabel || ''} ${card.dateLabel || card.date}`.trim(),
        parentId: view.id
      };
      dailyViews.push(dailyView);
      byId[dailyView.id] = dailyView;
    });
  });

  (monthly || []).forEach(card => {
    if (!card.fromDate) return;
    const view = {
      id: `month-${card.fromDate}`,
      type: 'monthly',
      data: card,
      monthKey: monthKey(card.fromDate),
      label: card.monthLabel || monthLabelVi(monthKey(card.fromDate))
    };
    views.push(view);
    byId[view.id] = view;
  });

  dailyViews.sort((a, b) => b.data.date.localeCompare(a.data.date));
  const defaultId = dailyViews[0] ? dailyViews[0].id : (views[0] && views[0].id) || '';
  return { views, byId, dailyViews, currentWeek, defaultId };
}

function activeViewFromHash() {
  const raw = (location.hash || '').replace(/^#/, '').split('/')[0];
  return STATE.byId[raw] || STATE.byId[STATE.defaultId] || null;
}

function viewLabel(view) {
  if (!view) return { kicker: 'Bản tin', title: 'Chưa có dữ liệu', summary: '' };
  if (view.type === 'daily') {
    // An empty day leaves the summary blank; the state panel below explains it.
    const summary = flattenCard(view.data).length ? 'Tin chọn lọc trong ngày. Chọn một tin để đọc nhanh.' : '';
    return { kicker: view.data.date === todayStr() ? 'Hôm nay' : view.data.dayLabel, title: view.data.dateLabel || view.data.date, summary };
  }
  if (view.type === 'monthly') {
    return { kicker: 'Tổng kết tháng', title: view.label, summary: 'Các tin nổi bật được tổng hợp theo tháng.' };
  }
  const newest = view.data[0] || {};
  return { kicker: view.isCurrent ? 'Tuần hiện tại' : 'Kho lưu trữ', title: view.isCurrent ? (newest.dateLabel || 'Bản tin mới nhất') : view.label, summary: `${view.isCurrent ? `${view.label} · ` : ''}Chọn một tin để đọc mà không rời danh sách.` };
}

function renderArchiveNav() {
  const root = document.getElementById('archive-nav');
  root.setAttribute('aria-busy', 'false');
  const active = UI.currentView;
  const weekViews = STATE.views.filter(view => view.type === 'weekgroup');
  const monthViews = STATE.views.filter(view => view.type === 'monthly');
  // Past days with no stories leave the rail (it lists days to read) unless one is open.
  const listedDays = (STATE.dailyViews || [])
    .filter((view, index) => index === 0 || (active && active.id === view.id) || flattenCard(view.data).length)
    .slice(0, 7);
  const dayLinks = listedDays.map((view, index) => {
    const isToday = view.data.date === todayStr();
    const label = isToday ? 'Hôm nay' : escapeHtml(view.label);
    const isActive = active && active.id === view.id;
    const isEmpty = !flattenCard(view.data).length;
    const badge = index === 0 ? '<small>Mới</small>' : isEmpty ? '<small>Trống</small>' : '';
    return `<a class="archive-link${isActive ? ' active' : ''}${isEmpty ? ' empty' : ''}" href="#${escapeHtml(view.id)}" data-view-id="${escapeHtml(view.id)}"${isActive ? ' aria-current="page"' : ''}><span>${label}</span>${badge}</a>`;
  }).join('');
  const archiveLinks = weekViews.slice(0, 8).map((view, index, list) => `${index > 0 && list[index - 1].monthKey !== view.monthKey ? `<div class="archive-month">${escapeHtml(monthLabelVi(view.monthKey))}</div>` : ''}<a class="archive-link${active && active.id === view.id ? ' active' : ''}" href="#${escapeHtml(view.id)}" data-view-id="${escapeHtml(view.id)}"${active && active.id === view.id ? ' aria-current="page"' : ''}><span>${escapeHtml(view.label)}</span></a>`).join('');
  const monthLinks = monthViews.slice(0, 6).map(view => `<a class="archive-link${active && active.id === view.id ? ' active' : ''}" href="#${escapeHtml(view.id)}" data-view-id="${escapeHtml(view.id)}"${active && active.id === view.id ? ' aria-current="page"' : ''}><span>${escapeHtml(view.label)}</span></a>`).join('');
  const topicLinks = UI.topicCounts.map(topic => `<button class="topic-nav-link${UI.topic === topic.field ? ' active' : ''}" type="button" data-topic="${escapeHtml(topic.field)}" aria-pressed="${UI.topic === topic.field}"><span>${escapeHtml(topic.label)}</span><span class="topic-count">${topic.count}</span></button>`).join('');

  root.innerHTML = `<div class="archive-group"><div class="archive-group-title">Theo ngày</div>${dayLinks || '<div class="empty-state">Chưa có bản tin</div>'}</div>
    ${topicLinks ? `<div class="archive-group"><div class="archive-group-title">Chủ đề</div>${topicLinks}</div>` : ''}
    ${archiveLinks ? `<div class="archive-group"><div class="archive-group-title">Theo tuần</div>${archiveLinks}</div>` : ''}
    ${monthLinks ? `<div class="archive-group"><div class="archive-group-title">Tổng kết tháng</div>${monthLinks}</div>` : ''}`;
}

function renderTopicStrip() {
  const root = document.getElementById('topic-strip');
  const allCount = UI.allItems.length;
  if (!allCount) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = `<button class="topic-chip${UI.topic === 'all' ? ' active' : ''}" type="button" data-topic="all" aria-pressed="${UI.topic === 'all'}">Tất cả · ${allCount}</button>${UI.topicCounts.map(topic => `<button class="topic-chip${UI.topic === topic.field ? ' active' : ''}" type="button" data-topic="${escapeHtml(topic.field)}" aria-pressed="${UI.topic === topic.field}">${escapeHtml(topic.label)} · ${topic.count}</button>`).join('')}`;
}

function calculateTopicCounts(items) {
  const counts = new Map();
  items.forEach(item => {
    const current = counts.get(item.topicField) || { field: item.topicField, label: item.topicLabel, count: 0 };
    current.count += 1;
    counts.set(item.topicField, current);
  });
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function filteredItems() {
  const normalizeSearchText = value => String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
  const query = normalizeSearchText(UI.query.trim());
  return UI.allItems.filter(item => {
    const topicMatch = UI.topic === 'all' || item.topicField === UI.topic;
    const haystack = normalizeSearchText(`${item.title} ${item.desc} ${item.detail} ${item.sourceName} ${item.topicLabel}`);
    return topicMatch && (!query || haystack.includes(query));
  });
}

const EDITORIAL_TOPIC_PRIORITY = {
  vietnam: 70,
  finance: 60,
  tech: 50,
  trending: 45,
  lifestyle: 35,
  gaming: 25,
  entertainment: 20
};

function rankDashboardItems(items) {
  const ranked = items.map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const scoreA = (EDITORIAL_TOPIC_PRIORITY[a.item.topicField] || 10) + (a.item.isHot ? 4 : 0) + (a.item.detail ? 2 : 0);
      const scoreB = (EDITORIAL_TOPIC_PRIORITY[b.item.topicField] || 10) + (b.item.isHot ? 4 : 0) + (b.item.detail ? 2 : 0);
      return scoreB - scoreA || a.index - b.index;
    })
    .map(entry => entry.item);

  const distinctTopics = new Set(ranked.map(item => item.topicField));
  if (distinctTopics.size < 2) return ranked;

  const lead = [];
  const remainder = [...ranked];
  const topicCounts = new Map();
  const leadSize = Math.min(6, ranked.length);

  while (lead.length < leadSize) {
    const nextIndex = remainder.findIndex(item => (topicCounts.get(item.topicField) || 0) < 2);
    if (nextIndex < 0) break;
    const [next] = remainder.splice(nextIndex, 1);
    lead.push(next);
    topicCounts.set(next.topicField, (topicCounts.get(next.topicField) || 0) + 1);
  }

  while (lead.length < leadSize && remainder.length) lead.push(remainder.shift());
  return lead.concat(remainder);
}

function applyFeedFilter(options = {}) {
  const matches = filteredItems();
  UI.filteredItems = UI.query.trim() ? matches : rankDashboardItems(matches);
  const firstUnread = UI.filteredItems.find(item => !UI.readIds.has(item.id));
  const selectedStillVisible = UI.filteredItems.some(item => item.id === UI.selectedId);
  if (!selectedStillVisible) UI.selectedId = (firstUnread || UI.filteredItems[0] || {}).id || '';

  const list = document.getElementById('feed-list');
  list.setAttribute('aria-busy', 'false');
  list.classList.toggle('reveal', Boolean(options.reveal));
  list.innerHTML = UI.filteredItems.length
    ? dashboardHtml(UI.filteredItems, UI.selectedId, UI.readIds, Boolean(UI.query.trim()))
    : emptyFeedHtml();
  observeDeferredImages(list);
  updateMarkAllButton();
  if (UI.query.trim()) announce(`${UI.filteredItems.length} kết quả tìm kiếm`);
  renderTopicStrip();
  renderArchiveNav();
  renderSelectedReader();
  if (options.resetScroll) document.getElementById('feed-pane').scrollTop = 0;
}

let deferredImageObserver = null;

function observeDeferredImages(root) {
  if (deferredImageObserver) deferredImageObserver.disconnect();
  const images = root.querySelectorAll('img[data-src]');
  const load = img => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  };
  if (!('IntersectionObserver' in window)) return images.forEach(load);
  deferredImageObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    deferredImageObserver.unobserve(entry.target);
    load(entry.target);
  }), { root: document.getElementById('feed-pane'), rootMargin: '120px 0px' });
  images.forEach(img => deferredImageObserver.observe(img));
}

function updateMarkAllButton() {
  const markAll = document.getElementById('mark-all-read');
  const unreadCount = UI.filteredItems.filter(item => !UI.readIds.has(item.id)).length;
  markAll.hidden = !UI.filteredItems.length;
  markAll.disabled = unreadCount === 0;
  markAll.textContent = unreadCount ? `Đánh dấu đã đọc · ${unreadCount}` : 'Đã đọc tất cả';
}

function emptyFeedHtml() {
  if (UI.query.trim() || UI.topic !== 'all') return emptyStateHtml('filter');
  const view = UI.currentView;
  if (!view || view.type !== 'daily' || view.data.date >= todayStr()) return emptyStateHtml('empty');
  const distance = candidate => Math.abs(Date.parse(candidate.data.date) - Date.parse(view.data.date));
  const nearest = (STATE.dailyViews || [])
    .filter(candidate => candidate.id !== view.id && flattenCard(candidate.data).length)
    .sort((a, b) => distance(a) - distance(b))[0];
  return emptyStateHtml('past', '', nearest ? { id: nearest.id, label: nearest.data.dateLabel || nearest.data.date } : null);
}

function renderSelectedReader() {
  const item = UI.filteredItems.find(candidate => candidate.id === UI.selectedId) || null;
  const index = item ? UI.filteredItems.indexOf(item) : -1;
  document.getElementById('reader-content').innerHTML = readerHtml(item, index, UI.filteredItems.length);
  document.querySelectorAll('[data-story-id]').forEach(row => {
    const selected = row.dataset.storyId === UI.selectedId;
    const candidate = UI.filteredItems.find(item => item.id === row.dataset.storyId);
    const isRead = UI.readIds.has(row.dataset.storyId);
    row.classList.toggle('active', selected);
    row.classList.toggle('read', isRead);
    row.toggleAttribute('aria-current', selected);
    if (candidate) row.setAttribute('aria-label', `${candidate.title} · ${isRead ? 'Đã đọc' : 'Chưa đọc'}`);
  });
}

function renderActiveView() {
  const view = activeViewFromHash();
  UI.currentView = view;
  UI.allItems = flattenView(view);
  UI.topicCounts = calculateTopicCounts(UI.allItems);
  if (UI.topic !== 'all' && !UI.topicCounts.some(topic => topic.field === UI.topic)) UI.topic = 'all';
  const labels = viewLabel(view);
  document.getElementById('feed-kicker').textContent = labels.kicker;
  document.getElementById('feed-title').textContent = labels.title;
  document.getElementById('feed-summary').textContent = labels.summary;
  applyFeedFilter({ resetScroll: true, reveal: true });
}

function selectStory(id, options = {}) {
  if (!UI.filteredItems.some(item => item.id === id)) return;
  UI.selectedId = id;
  UI.readIds.add(id);
  persistReadIds();
  renderSelectedReader();
  updateMarkAllButton();
  UI.lastFeedTrigger = document.querySelector(`[data-story-id="${CSS.escape(id)}"]`) || UI.lastFeedTrigger;
  if (options.openMobile && window.innerWidth <= 900) openReader();
}

function stepStory(delta, options = {}) {
  const current = UI.filteredItems.findIndex(item => item.id === UI.selectedId);
  const next = Math.max(0, Math.min(UI.filteredItems.length - 1, current + delta));
  if (!UI.filteredItems[next] || next === current) return;
  selectStory(UI.filteredItems[next].id);
  if (options.restoreFocus) {
    const selector = `[data-reader-step="${delta > 0 ? 1 : -1}"]`;
    const preferred = document.querySelector(selector);
    const fallback = document.querySelector(`[data-reader-step="${delta > 0 ? -1 : 1}"]:not(:disabled)`) || document.querySelector('.reader-nav');
    (preferred && !preferred.disabled ? preferred : fallback)?.focus({ preventScroll: true });
  }
}
