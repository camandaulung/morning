// Pure render helpers for the Morning Desk master-detail interface.

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (_) {
    return '';
  }
}

function stripLeadingSymbols(value) {
  return String(value || '')
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '')
    .trim();
}

function compactTag(value) {
  return stripLeadingSymbols(value).replace(/[^\p{L}\p{N}\s/-]/gu, '').trim();
}

function sourceParts(value) {
  const raw = String(value || '').trim();
  const parts = raw.split(/[·•]/).map(part => part.trim()).filter(Boolean);
  return {
    date: parts.length > 1 ? parts[0] : '',
    name: parts.length > 1 ? parts.slice(1).join(' · ') : raw || 'Nguồn tin'
  };
}

function shortHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function topicMeta(field) {
  const config = TOPICS[field] || {};
  return {
    field,
    label: stripLeadingSymbols(config.section_label || field.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()))
  };
}

function flattenCard(card, fallbackDate, context = {}) {
  const date = card.date || fallbackDate || card.fromDate || '';
  const items = [];
  Object.keys(card).forEach(field => {
    if (!Array.isArray(card[field])) return;
    const topic = topicMeta(field);
    card[field].forEach((entry, index) => {
      const source = sourceParts(entry.source);
      const title = stripLeadingSymbols(entry.title || entry.name || 'Tin chưa có tiêu đề');
      const identity = entry.url || `${title}-${index}`;
      const tag = compactTag(entry.tagLabel || entry.tag || '');
      items.push({
        id: `story-${shortHash(`${date}|${field}|${identity}`)}`,
        date,
        dateLabel: card.dateLabel || date,
        dayLabel: card.dayLabel || '',
        topicField: field,
        topicLabel: topic.label,
        title,
        desc: String(entry.desc || ''),
        detail: String(entry.detail || ''),
        image: safeUrl(entry.image || entry.image_url || entry.thumbnail || ''),
        reason: String(entry.reason || ''),
        stars: String(entry.stars || ''),
        verdict: String(entry.verdict || ''),
        viewType: context.viewType || '',
        isRepository: field === 'topRepos' || /^https:\/\/github\.com\//i.test(entry.url || ''),
        tag,
        sourceDate: source.date,
        sourceName: source.name,
        url: safeUrl(entry.url),
        isHot: /hot|viral|trending/i.test(`${entry.tag || ''} ${field}`),
        raw: entry
      });
    });
  });
  return items;
}

function flattenView(view) {
  if (!view) return [];
  if (view.type === 'weekgroup') {
    const summaryItems = view.summary ? flattenCard(view.summary, view.summary.fromDate, { viewType: 'weekly' }) : [];
    return summaryItems.concat(view.data.flatMap(card => flattenCard(card, '', { viewType: 'daily' })));
  }
  return flattenCard(view.data, view.data && view.data.fromDate, { viewType: view.type });
}

function storyMetaHtml(item) {
  return `<span class="story-meta"><span>${escapeHtml(item.topicLabel)}</span><span>•</span><span>${escapeHtml(item.sourceName)}</span>${item.sourceDate ? `<span>•</span><span>${escapeHtml(item.sourceDate)}</span>` : ''}</span>`;
}

// Two initials ("Thanh Niên" → "TN", "GameK" → "GK") keep fallback tiles from different
// sources apart.
function sourceMonogram(name) {
  const words = stripLeadingSymbols(name || '').split(/\s+/).filter(word => /^\p{L}/u.test(word));
  if (!words.length) return '';
  if (/^\p{Lu}{2,}$/u.test(words[0])) return words[0].slice(0, 3);
  if (words.length === 1) return (words[0].charAt(0) + (words[0].slice(1).match(/\p{Lu}/u) || [''])[0]).toUpperCase();
  return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
}

function storyVisualHtml(item, compact = false, loadMode = 'lazy') {
  const topicClass = String(item.topicField || 'news').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const initial = sourceMonogram(item.sourceName) || stripLeadingSymbols(item.topicLabel || item.title).charAt(0) || 'M';
  // Real thumbnail (lazy-loaded) layered over the monogram tile. item.image is already
  // safeUrl()-filtered to http(s) in flattenCard. On load failure the onerror strips
  // `has-image` and removes the <img> so the monogram fallback shows — no broken icon,
  // no layout shift (the tile keeps its reserved min-height).
  // The hero image is the LCP element, so it loads eagerly with high priority.
  // Small thumbnails ('deferred') get their src only when near the viewport (see
  // observeDeferredImages): native lazy-loading fetches ~1250px ahead, and every CDN
  // image is a 1200px original.
  const source = loadMode === 'deferred' ? `data-src="${escapeHtml(item.image)}"` : `src="${escapeHtml(item.image)}"`;
  const loading = loadMode === 'eager' ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const img = item.image
    ? `<img class="visual-img" ${source} alt="" ${loading} decoding="async"
        onload="this.closest('.story-visual').classList.add('img-ready')"
        onerror="this.closest('.story-visual').classList.remove('has-image');this.remove();">`
    : '';
  // The fallback tile names the source; the card meta already names the topic.
  return `<span class="story-visual topic-${topicClass}${item.image ? ' has-image' : ''}${compact ? ' compact' : ''}" aria-hidden="true">
    ${img}
    <span class="visual-label">${escapeHtml(item.sourceName || item.topicLabel)}</span>
    <span class="visual-monogram">${escapeHtml(initial)}</span>
  </span>`;
}

function storyCardHtml(item, variant, selectedId, readIds) {
  const isRead = readIds.has(item.id);
  const summary = item.detail && item.detail.trim() !== item.desc.trim() ? item.detail : item.desc;
  const showSummary = variant === 'hero' || variant === 'primary' || (variant === 'compact' && !item.image);
  const showAction = variant === 'hero' || variant === 'primary' || variant === 'secondary';
  return `<button class="story-card story-${variant}${isRead ? ' read' : ''}${item.id === selectedId ? ' active' : ''}" type="button" data-story-id="${item.id}" aria-label="${escapeHtml(item.title)} · ${isRead ? 'Đã đọc' : 'Chưa đọc'}"${item.id === selectedId ? ' aria-current="true"' : ''}>
    ${storyVisualHtml(item, variant !== 'hero', variant === 'hero' ? 'eager' : variant === 'compact' || variant === 'headline' ? 'deferred' : 'lazy')}
    <span class="story-card-body">
      ${storyMetaHtml(item)}
      <span class="story-title">${escapeHtml(item.title)}</span>
      ${showSummary && summary ? `<span class="story-summary">${escapeHtml(summary)}</span>` : ''}
      ${showAction ? '<span class="story-action">Đọc nhanh <span aria-hidden="true">→</span></span>' : ''}
      <span class="read-flag" aria-hidden="true">${icon('check')}Đã đọc</span>
    </span>
  </button>`;
}

function dashboardHtml(items, selectedId, readIds, isSearch = false) {
  if (!items.length) return emptyStateHtml('filter');
  if (isSearch) {
    return `<section class="search-results" aria-label="Kết quả tìm kiếm">${items.map(item => storyCardHtml(item, 'compact', selectedId, readIds)).join('')}</section>`;
  }

  const [hero, ...rest] = items;
  const primary = rest.slice(0, 2);
  const secondary = rest.slice(2, 5);
  const headlines = rest.slice(5, 9);
  const more = rest.slice(9);
  // Ranked order already bands stories by topic; label each consecutive run so the long
  // tail reads as sections. Order is unchanged.
  const moreGroups = [];
  more.forEach(item => {
    const last = moreGroups[moreGroups.length - 1];
    if (last && last.field === item.topicField) last.items.push(item);
    else moreGroups.push({ field: item.topicField, label: item.topicLabel, items: [item] });
  });
  const groupHtml = group => {
    const topicClass = String(group.field || 'news').replace(/[^a-z0-9-]/gi, '').toLowerCase();
    const head = moreGroups.length > 1
      ? `<div class="topic-group-head"><span class="topic-dot topic-${topicClass}" aria-hidden="true"></span><span>${escapeHtml(group.label)}</span><small>${group.items.length} tin</small></div>`
      : '';
    return `<div class="topic-group">${head}<div class="compact-grid">${group.items.map(item => storyCardHtml(item, 'compact', selectedId, readIds)).join('')}</div></div>`;
  };
  return `<div class="news-dashboard">
    <section class="lead-grid" aria-label="Tin nổi bật">
      ${storyCardHtml(hero, 'hero', selectedId, readIds)}
      <div class="primary-stack">${primary.map(item => storyCardHtml(item, 'primary', selectedId, readIds)).join('')}</div>
    </section>
    ${secondary.length ? `<section class="secondary-grid" aria-label="Tin đáng chú ý">${secondary.map(item => storyCardHtml(item, 'secondary', selectedId, readIds)).join('')}</section>` : ''}
    ${headlines.length ? `<section class="headline-panel" aria-labelledby="headline-panel-title"><div class="section-heading"><span class="eyebrow" id="headline-panel-title">Điểm nhanh</span><span>${headlines.length} tin</span></div><div class="headline-list">${headlines.map(item => storyCardHtml(item, 'headline', selectedId, readIds)).join('')}</div></section>` : ''}
    ${more.length ? `<section class="more-stories" aria-labelledby="more-stories-title"><div class="section-heading"><span class="eyebrow" id="more-stories-title">Còn trong bản tin</span><span>${more.length} tin</span></div>${moreGroups.map(groupHtml).join('')}</section>` : ''}
  </div>`;
}

function emptyStateHtml(kind = 'empty', message = '', link = null) {
  const states = {
    past: {
      title: 'Ngày này không có bản tin',
      copy: 'Không có tin nào được lưu cho ngày này.',
      action: link ? `<a class="state-action" href="#${escapeHtml(link.id)}">Xem bản tin ${escapeHtml(link.label)}</a>` : ''
    },
    filter: {
      title: 'Không thấy tin phù hợp',
      copy: 'Thử từ khóa khác hoặc quay về toàn bộ bản tin.',
      action: '<button class="state-action" type="button" data-reset-feed>Xem tất cả tin</button>'
    },
    error: {
      title: 'Chưa tải được bản tin',
      copy: message || 'Kết nối có thể đang gián đoạn. Dữ liệu của bạn không bị thay đổi.',
      action: '<button class="state-action" type="button" data-retry-load>Thử tải lại</button>'
    },
    empty: {
      title: 'Chưa có bản tin mới',
      copy: 'Bản tin sẽ xuất hiện sau lần cập nhật tiếp theo.',
      action: ''
    }
  };
  const state = states[kind] || states.empty;
  const glyph = kind === 'past' || kind === 'empty'
    ? icon('fish')
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14M5 12h9M5 16.5h6"/><rect x="3" y="4" width="18" height="16" rx="3"/></svg>';
  return `<div class="state-panel state-${kind}" role="status">
    ${glyph}
    <strong>${escapeHtml(state.title)}</strong>
    <span>${escapeHtml(state.copy)}</span>
    ${state.action}
  </div>`;
}

// Brand glyph (a salted fish); index.html repeats these paths in the static topbar mark.
const FISH_GLYPH_PATHS = '<path d="M6.5 12c2-3.7 5-5.6 8.4-5.6 3 0 5.3 1.9 6.6 5.6-1.3 3.7-3.6 5.6-6.6 5.6-3.4 0-6.4-1.9-8.4-5.6Z"/><path d="M6.5 12 2.5 8.2v7.6L6.5 12Z"/><path d="M11.2 9.3c.9 1.7.9 3.7 0 5.4"/><circle cx="17.4" cy="11" r=".6"/>';

function icon(name) {
  const paths = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
    fish: FISH_GLYPH_PATHS
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function readerArticleHtml(item, slotIndex, isPrimary) {
  const copyLabelId = `reader-copy-label-${escapeHtml(item.id || slotIndex)}`;
  const sourceInitial = stripLeadingSymbols(item.sourceName).charAt(0) || 'N';
  const facts = [
    item.stars ? `<span data-reader-stars><strong>${escapeHtml(item.stars)}</strong> stars</span>` : '',
    item.verdict ? `<span data-reader-verdict><strong>Verdict</strong> ${escapeHtml(item.verdict)}</span>` : ''
  ].filter(Boolean).join('');
  const hasDetail = Boolean(item.detail && item.detail.trim() && item.detail.trim() !== item.desc.trim());
  const readerCopy = hasDetail ? item.detail : item.desc;
  const description = readerCopy ? `<section class="reader-copy" aria-labelledby="${copyLabelId}">
    <span class="reader-section-label" id="${copyLabelId}">${hasDetail ? 'Tóm lược mở rộng' : 'Tóm tắt nhanh'}</span>
    <p class="reader-dek" data-reader-copy data-content-kind="${hasDetail ? 'detail' : 'summary'}">${escapeHtml(readerCopy)}</p>
    ${hasDetail || !isPrimary ? '' : '<p class="reader-disclosure">Dữ liệu lịch sử chỉ lưu bản tóm tắt. Mở nguồn để đọc toàn bộ bài gốc.</p>'}
  </section>` : '';
  const reason = item.reason ? `<div class="reader-rule" aria-hidden="true"></div><p class="reader-note" data-reader-reason>${escapeHtml(item.reason)}</p>` : '';
  const heading = isPrimary
    ? `<h1 class="reader-article-title">${escapeHtml(item.title)}</h1>`
    : `<h2 class="reader-article-title">${escapeHtml(item.title)}</h2>`;

  const laneLabel = isPrimary ? `Tin đang chọn: ${item.title}` : `Tin xem thêm ${slotIndex}: ${item.title}`;
  return `<article class="reader-article reader-scroll${isPrimary ? ' primary' : ''}" data-reader-article${isPrimary ? ' data-reader-primary' : ''} tabindex="0" aria-label="${escapeHtml(laneLabel)}">
    <div class="reader-toolbar">
      <div class="reader-source"><span class="source-mark" aria-hidden="true">${escapeHtml(sourceInitial)}</span><span>${escapeHtml(item.sourceName)}${item.sourceDate ? ` · ${escapeHtml(item.sourceDate)}` : ''}</span></div>
      ${isPrimary ? `<div class="reader-actions">
        <button class="icon-button" type="button" data-copy-story aria-label="Sao chép liên kết nguồn">${icon('copy')}</button>
        <button class="icon-button reader-close" type="button" data-close-reader aria-label="Đóng bài đọc">${icon('close')}</button>
      </div>` : ''}
    </div>
    <div class="reader-topic${item.isHot ? ' hot' : ''}">${escapeHtml(item.topicLabel)}${item.tag ? ` · ${escapeHtml(item.tag)}` : ''}</div>
    ${heading}
    ${item.image ? `<figure class="reader-figure"><img src="${escapeHtml(item.image)}" alt="" decoding="async" onerror="this.closest('figure').remove();"></figure>` : ''}
    ${facts ? `<div class="reader-facts" data-reader-facts>${facts}</div>` : ''}
    ${description}
    ${reason}
    ${item.url ? `<a class="source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Đọc bài gốc ${icon('external')}</a>` : ''}
  </article>`;
}

function readerHtml(item, index, total) {
  if (!item) return `<div class="reader-empty"><span class="eyebrow">Morning desk</span><h2>Không tìm thấy tin phù hợp</h2><p>Thử đổi từ khóa hoặc chủ đề đang lọc.</p></div>`;
  return `<div class="reader-layout"><div class="reader-board">${readerArticleHtml(item, 0, true)}</div><div class="reader-nav" aria-label="Điều hướng tin" tabindex="-1">
    <button type="button" data-reader-step="-1"${index <= 0 ? ' disabled' : ''}>← Tin trước</button>
    <span class="eyebrow">${index + 1} / ${total}</span>
    <button type="button" data-reader-step="1"${index >= total - 1 ? ' disabled' : ''}>Tin sau →</button>
  </div></div>`;
}
