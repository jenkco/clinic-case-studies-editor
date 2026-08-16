/*!
 * Clinic Case Studies Panel Editor
 * =============================================================================
 * WHAT THIS SCRIPT DOES
 * -----------------------------------------------------------------------------
 * This script is meant to be pasted into a Squarespace site's
 * Settings -> Advanced -> Code Injection -> Footer box, alongside (not instead
 * of) any other Footer Code Injection scripts you already have there.
 *
 * Unlike the companion pricing-table tool, this one has a small job to do on
 * the LIVE public site too: the case-studies panel has clickable filter tabs,
 * and that filtering behavior has to run somewhere. Rather than embed a
 * <script> tag inside the code block for it (which would immediately trigger
 * the exact Squarespace restriction described below), that click-wiring logic
 * lives right here instead and runs unconditionally, on every page, as a
 * harmless no-op wherever the panel's markup isn't present. It only ever
 * touches elements with the panel's own `.sqs-co-tab` / `.sqs-co-card`
 * classes -- nothing else on the page.
 *
 * The rest of this file -- the floating "Edit Case Studies" button and its
 * modal editor -- only ever activates when it detects that the current
 * browser tab's TOP-LEVEL window is Squarespace's own page editor app (a URL
 * under /config/), which only happens when the logged-in site owner is
 * actively editing a page. On the live public site that whole part does
 * nothing at all: no extra DOM changes, no globals, no console output.
 *
 * While in the editor, it polls (every ~700ms) for a specific "case studies"
 * Code Block's editing panel to be open. That block is identified purely by
 * its own content: it must contain a CASE_STUDIES_DATA_START/END HTML comment
 * holding the panel's data as JSON, a CASE_STUDIES_STYLE_START/END comment
 * wrapping a small regenerated CSS snippet, and a
 * CASE_STUDIES_GRID_START/END comment pair wrapping the generated filter
 * buttons + card grid markup. See README.md for the exact starter template.
 *
 * This shares its whole approach with the companion "Clinic Pricing Table
 * Editor" tool (same author, same site): pricing data lives as an HTML
 * comment rather than a <script type="application/json"> tag because
 * Squarespace disables all custom Code Injection scripts on any page whose
 * code blocks contain a <script> tag, and separately locks that block behind
 * a "Premium Feature" plan upgrade notice. Neither restriction fires for an
 * HTML comment. Squarespace's code block editor is CodeMirror 6, not a plain
 * <textarea>; this reaches it via window.top (same-origin with the page
 * being edited) and reads/writes the block's CodeMirror instance through
 * view.contentDOM + execCommand('insertText', ...) -- the same pipeline a
 * real paste or keystroke would use. Calling CodeMirror's view.dispatch()
 * directly to replace a whole document in one transaction was tried first
 * and reliably hung the editor tab, so this deliberately avoids it.
 *
 * Unlike the pricing tool, this one actually writes color values back (the
 * accent colors and each category's badge colors), not just reads them, and
 * a small slice of the <style> block (CSS custom properties and badge color
 * rules) is regenerated alongside the data and grid markup -- because those
 * rules are derived from the data (filter keys, badge colors) rather than
 * being purely the site owner's own static styling. Everything else in the
 * <style> block (fonts, spacing, layout, hover animations) is never
 * touched.
 *
 * IMPORTANT: This script cannot save anything to Squarespace by itself.
 * After using it, the site owner must still click Squarespace's own native
 * "Save" button in the block editor panel. The modal UI reminds of this.
 *
 * If the editor's content can't be safely reached, the tool falls back to
 * showing the regenerated code with a "Copy to clipboard" button.
 *
 * This script never touches any page content, cookies, or form field other
 * than the one specific case-studies code block's own editor.
 * =============================================================================
 */
(function () {
  'use strict';

  var DATA_START_MARKER = 'CASE_STUDIES_DATA_START';
  var DATA_END_MARKER = 'CASE_STUDIES_DATA_END';
  var STYLE_START_MARKER = 'CASE_STUDIES_STYLE_START';
  var STYLE_END_MARKER = 'CASE_STUDIES_STYLE_END';
  var GRID_START_MARKER = 'CASE_STUDIES_GRID_START';
  var GRID_END_MARKER = 'CASE_STUDIES_GRID_END';
  var ALL_KEY = 'all';
  var DEFAULT_ACCENT = '#4A707C';
  var DEFAULT_ACCENT_HOVER = '#3a5a65';
  var STYLE_EL_ID = 'csp-injected-styles';
  var POLL_MS = 700;

  var MODAL_CSS =
    '.csp-floating-wrap{position:fixed;top:64px;right:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
    '.csp-trigger-button{background:#dc2626;color:#fff;border:2px solid #dc2626;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(220,38,38,.4);}' +
    '.csp-trigger-button:hover{background:#b91c1c;border-color:#b91c1c;}' +
    '.csp-trigger-label{font-size:10px;color:#111827;background:#fff;padding:3px 7px;border-radius:5px;box-shadow:0 2px 6px rgba(0,0,0,.15);}' +
    '.csp-toast{position:fixed;bottom:24px;right:24px;max-width:340px;background:#111827;color:#fff;padding:14px 18px;border-radius:8px;font-size:13px;line-height:1.4;box-shadow:0 12px 32px rgba(0,0,0,.35);z-index:2147483002;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
    '.csp-overlay{position:fixed;inset:0;background:rgba(15,15,20,0.55);z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
    '.csp-modal{background:#fff;border-radius:10px;max-width:900px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);}' +
    '.csp-modal__header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px;border-bottom:1px solid #e5e7eb;}' +
    '.csp-modal__title{margin:0 0 4px;font-size:19px;color:#111827;}' +
    '.csp-modal__subtitle{margin:0;font-size:13px;color:#6b7280;max-width:640px;}' +
    '.csp-close-btn{background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:#6b7280;padding:0 4px;}' +
    '.csp-close-btn:hover{color:#111827;}' +
    '.csp-modal__body{padding:20px 24px;overflow-y:auto;flex:1;}' +
    '.csp-section{margin-bottom:28px;}' +
    '.csp-section__title{font-size:13px;font-weight:700;color:#111827;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.04em;}' +
    '.csp-global-row{display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:8px;}' +
    '.csp-field-label{font-size:12px;font-weight:600;color:#374151;display:flex;flex-direction:column;gap:6px;}' +
    '.csp-input{padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;box-sizing:border-box;font-weight:400;}' +
    '.csp-input--wide{width:100%;}' +
    '.csp-color-row{display:flex;align-items:center;gap:6px;}' +
    '.csp-color-swatch{width:32px;height:32px;padding:0;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;}' +
    '.csp-select{padding:7px 9px;border-radius:6px;border:1px solid #d1d5db;font-size:13px;font-weight:400;}' +
    '.csp-filter-card,.csp-card-card{border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa;margin-bottom:10px;}' +
    '.csp-card-card__header,.csp-filter-card__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}' +
    '.csp-card-card__header-title,.csp-filter-card__header-title{font-size:13px;font-weight:700;color:#374151;}' +
    '.csp-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}' +
    '.csp-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}' +
    '.csp-full{grid-column:1/-1;}' +
    '.csp-btn{padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;}' +
    '.csp-btn--small{padding:5px 10px;font-size:12px;}' +
    '.csp-btn--primary{background:var(--csp-accent,' + DEFAULT_ACCENT + ');border-color:var(--csp-accent,' + DEFAULT_ACCENT + ');color:#fff;}' +
    '.csp-btn--secondary{background:#fff;border-color:#d1d5db;color:#374151;}' +
    '.csp-icon-btn{background:none;border:1px solid transparent;border-radius:6px;padding:6px 8px;cursor:pointer;font-size:14px;}' +
    '.csp-icon-btn--danger:hover{background:#fee2e2;}' +
    '.csp-error-banner{margin-top:16px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;font-size:13px;}' +
    '.csp-error-banner ul{margin:6px 0 0;padding-left:18px;}' +
    '.csp-modal__footer{border-top:1px solid #e5e7eb;padding:14px 24px;display:flex;flex-direction:column;gap:10px;}' +
    '.csp-footer-note{margin:0;font-size:12px;color:#6b7280;}' +
    '.csp-footer-buttons{display:flex;justify-content:flex-end;gap:10px;}' +
    '.csp-fallback-textarea{width:100%;height:320px;font-family:Menlo,Consolas,monospace;font-size:12px;padding:12px;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;}';

  // ---------------------------------------------------------------------
  // 0. Live filter click-wiring. Runs unconditionally, everywhere,
  //    including inside the Squarespace editor's own preview (so filter
  //    clicks work there too). A safe no-op on any page that doesn't have
  //    this panel's markup.
  // ---------------------------------------------------------------------

  function wireLiveFilters(doc) {
    var tabs = doc.querySelectorAll('.sqs-co-tab');
    var cards = doc.querySelectorAll('.sqs-co-card');
    if (!tabs.length || !cards.length) return;

    function applyFilter(filter) {
      tabs.forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-filter') === filter);
      });
      cards.forEach(function (card) {
        var match = filter === ALL_KEY || card.getAttribute('data-category') === filter;
        card.classList.toggle('hidden', !match);
      });
    }

    tabs.forEach(function (tab) {
      if (tab.getAttribute('data-csp-wired') === 'true') return;
      tab.setAttribute('data-csp-wired', 'true');
      tab.addEventListener('click', function () {
        applyFilter(tab.getAttribute('data-filter'));
      });
    });

    // Pre-select the configured default filter on load, on every screen
    // size -- through the exact same applyFilter() a click would use, so
    // there is only ever one mechanism controlling which tab looks
    // selected. (An earlier version of this tool did this with a CSS rule
    // targeting the default tab directly, which tied in specificity with
    // the .active class rule and could leave the default tab looking
    // selected even after a different one was clicked. Routing it through
    // applyFilter() instead makes that class of bug structurally
    // impossible: whichever tab last called applyFilter is the only one
    // that can have .active.)
    var wrapper = doc.querySelector('.sqs-co-filter-wrapper');
    var defaultFilter = wrapper ? wrapper.getAttribute('data-default-filter') : null;
    if (defaultFilter && wrapper.getAttribute('data-csp-default-applied') !== 'true') {
      wrapper.setAttribute('data-csp-default-applied', 'true');
      applyFilter(defaultFilter);
    }
  }

  function startLiveFilters() {
    function run() {
      wireLiveFilters(document);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
    // Re-wire if Squarespace's own editor re-renders the preview (new tab
    // buttons/cards get created); harmless elsewhere since it's a quick,
    // cheap query that no-ops without matching elements.
    setInterval(run, POLL_MS);
  }

  startLiveFilters();

  // ---------------------------------------------------------------------
  // 1. Context gate. Only the editor tool below this point needs
  //    Squarespace's own /config app; the live filter wiring above already
  //    ran regardless.
  // ---------------------------------------------------------------------

  var T;
  try {
    T = window.top;
    if (!T || !T.location || !/\/config(\/|$|\?)/.test(T.location.pathname + T.location.search)) return;
    if (!T.document) return;
  } catch (e) {
    return;
  }
  var D = T.document;

  var currentButton = null;
  var currentView = null;

  // ---------------------------------------------------------------------
  // 2. Finding the case-studies block's live CodeMirror 6 editor, if open.
  // ---------------------------------------------------------------------

  function looksLikeCaseStudiesBlock(text) {
    return (
      !!text &&
      text.indexOf(DATA_START_MARKER) !== -1 &&
      text.indexOf(GRID_START_MARKER) !== -1 &&
      text.indexOf(GRID_END_MARKER) !== -1
    );
  }

  function findMatchingEditorView() {
    var candidates;
    try {
      candidates = D.querySelectorAll('.cm-content');
    } catch (e) {
      return null;
    }
    for (var i = 0; i < candidates.length; i++) {
      var tile = candidates[i].cmTile;
      var view = tile && tile.view;
      if (!view || !view.state || !view.state.doc) continue;
      if (looksLikeCaseStudiesBlock(view.state.doc.toString())) return view;
    }
    return null;
  }

  function tick() {
    var view = findMatchingEditorView();
    if (view) {
      currentView = view;
      if (!currentButton || !D.body.contains(currentButton)) {
        showButton();
      }
    } else {
      removeButton();
    }
  }

  setInterval(tick, POLL_MS);
  tick();

  // ---------------------------------------------------------------------
  // 3. Trigger button (floating, clearly custom -- not Squarespace chrome)
  // ---------------------------------------------------------------------

  function showButton() {
    removeButton();
    ensureStylesInjected();

    var wrap = D.createElement('div');
    wrap.id = 'csp-launch-wrap';
    wrap.className = 'csp-floating-wrap';

    var btn = D.createElement('button');
    btn.type = 'button';
    btn.className = 'csp-trigger-button';
    btn.textContent = '✎ Edit Case Studies';
    btn.addEventListener('click', function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      openEditor();
    });

    var label = D.createElement('span');
    label.className = 'csp-trigger-label';
    label.textContent = 'Custom tool (not part of Squarespace)';

    wrap.appendChild(btn);
    wrap.appendChild(label);
    (D.body || D.documentElement).appendChild(wrap);
    currentButton = wrap;
  }

  function removeButton() {
    if (currentButton && currentButton.parentNode) currentButton.parentNode.removeChild(currentButton);
    currentButton = null;
  }

  // ---------------------------------------------------------------------
  // 4. Parsing block content
  // ---------------------------------------------------------------------

  function extractJson(sourceText) {
    var match = sourceText.match(
      new RegExp('<!--\\s*' + DATA_START_MARKER + '([\\s\\S]*?)' + DATA_END_MARKER + '\\s*-->')
    );
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // 5. Regenerating block content from form state
  // ---------------------------------------------------------------------

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isHexColor(value) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || '').trim());
  }

  function filterByKey(state, key) {
    for (var i = 0; i < state.filters.length; i++) {
      if (state.filters[i].key === key) return state.filters[i];
    }
    return null;
  }

  function buildGridHtml(state) {
    var parts = [];

    // data-default-filter carries which filter the live page's own script
    // (see wireLiveFilters near the top of this file) should pre-select on
    // load, on every screen size -- read once at page load, not baked into
    // CSS, so there is only one code path that can ever mark a tab
    // "selected".
    parts.push('<div class="sqs-co-filter-wrapper" data-default-filter="' + escapeHtml(state.defaultFilter) + '">');
    state.filters.forEach(function (f) {
      parts.push(
        '<button class="sqs-co-tab" data-filter="' + escapeHtml(f.key) + '">' + escapeHtml(f.label) + '</button>'
      );
    });
    parts.push('</div>');

    parts.push('<div class="sqs-co-grid">');
    state.cards.forEach(function (card) {
      var filter = filterByKey(state, card.category) || {};
      parts.push('<div class="sqs-co-card" data-category="' + escapeHtml(card.category) + '">');
      parts.push('<div class="sqs-co-card-image">');
      parts.push('<img src="' + escapeHtml(card.image) + '" alt="' + escapeHtml(card.imageAlt) + '">');
      parts.push(
        '<span class="sqs-co-badge" data-badge-cat="' + escapeHtml(card.category) + '">' +
          escapeHtml(filter.badgeLabel || filter.label || card.category) +
          '</span>'
      );
      parts.push('</div>');
      parts.push('<div class="sqs-co-card-body">');
      parts.push('<div>');
      parts.push('<div class="sqs-co-card-meta">' + escapeHtml(card.meta) + '</div>');
      parts.push('<h3 class="sqs-co-card-title">' + escapeHtml(card.title) + '</h3>');
      parts.push('<div class="sqs-co-card-jobtitle">' + escapeHtml(card.jobTitle || '') + '</div>');
      // description is inserted raw (not escaped) so inline markup like <strong> survives.
      parts.push('<p class="sqs-co-card-text">' + card.description + '</p>');
      parts.push('</div>');
      parts.push('<div class="sqs-co-card-footer">');
      if (card.location) {
        parts.push('<div class="sqs-co-card-location">' + escapeHtml(card.location) + '</div>');
      }
      parts.push('<div class="sqs-co-card-footer-row">');
      // An empty src attribute makes browsers re-request the current page as
      // an image (a real HTML quirk), producing a broken-image glyph -- so
      // the <img> is only emitted when a logo URL is actually set.
      parts.push(
        '<span class="sqs-co-result">' +
          (card.logo ? '<img src="' + escapeHtml(card.logo) + '" alt="' + escapeHtml(card.meta) + ' logo">' : '') +
          '</span>'
      );
      parts.push(
        '<a href="' + escapeHtml(card.linkUrl) + '" class="sqs-co-read-more">' + escapeHtml(card.linkText) + '</a>'
      );
      parts.push('</div>');
      parts.push('</div></div></div>');
    });
    parts.push('</div>');

    return parts.join('\n');
  }

  function buildStyleSnippet(state) {
    var parts = [];

    parts.push(
      ':root{--csp-accent:' + state.accent + ';--csp-accent-hover:' + state.accentHover + ';}'
    );

    state.filters.forEach(function (f) {
      if (f.key === ALL_KEY) return;
      parts.push(
        '.sqs-co-badge[data-badge-cat="' + f.key + '"]{background:' + (f.badgeBg || '#eef2f2') + ';color:' + (f.badgeText || '#374151') + ';}'
      );
    });

    // Default filtering (desktop and mobile) is applied by wireLiveFilters()
    // at runtime (via the data-default-filter attribute on
    // .sqs-co-filter-wrapper), using the exact same .active/.hidden class
    // toggling a click uses --
    // deliberately not a CSS rule here. A CSS rule that forces one tab's
    // colors by its data-filter value ties in specificity with the
    // .sqs-co-tab.active rule elsewhere in this stylesheet, and CSS breaks
    // that tie by source order, not by which one is "supposed" to win --
    // so the default tab could stay visually highlighted after a visitor
    // picks a different one. Keeping exactly one mechanism (JS toggling
    // .active) in charge of what "selected" looks like avoids that class of
    // bug entirely.

    return parts.join('\n');
  }

  function regenerateSourceText(sourceText, state) {
    var jsonText = JSON.stringify(state, null, 2);
    var withData = sourceText.replace(
      new RegExp('(<!--\\s*' + DATA_START_MARKER + ')([\\s\\S]*?)(' + DATA_END_MARKER + '\\s*-->)'),
      function (full, open, _inner, close) {
        return open + '\n' + jsonText + '\n' + close;
      }
    );

    // The style markers live inside a <style> tag, so they use CSS comment
    // syntax (/* ... */), not HTML comment syntax -- <!-- --> is not valid
    // CSS and could confuse the browser's stylesheet parser.
    var styleSnippet = buildStyleSnippet(state);
    var withStyle = withData.replace(
      new RegExp('(/\\*\\s*' + STYLE_START_MARKER + '\\s*\\*/)([\\s\\S]*?)(/\\*\\s*' + STYLE_END_MARKER + '\\s*\\*/)'),
      function (full, open, _inner, close) {
        return open + '\n' + styleSnippet + '\n' + close;
      }
    );

    var gridHtml = buildGridHtml(state);
    var withGrid = withStyle.replace(
      new RegExp('(<!--\\s*' + GRID_START_MARKER + '\\s*-->)([\\s\\S]*?)(<!--\\s*' + GRID_END_MARKER + '\\s*-->)'),
      function (full, open, _inner, close) {
        return open + '\n' + gridHtml + '\n' + close;
      }
    );

    return withGrid;
  }

  // ---------------------------------------------------------------------
  // 6. Writing back into Squarespace's CodeMirror 6 editor.
  //
  // Same lesson learned building the companion pricing-table tool:
  // view.dispatch() to replace a whole document in one transaction hung
  // Squarespace's editor. Going through the native contenteditable input
  // pipeline instead -- select all, then execCommand('insertText', ...) --
  // is what Squarespace's own change-tracking is built to handle.
  // ---------------------------------------------------------------------

  function writeToEditor(view, newText) {
    var contentEl = view.contentDOM;
    contentEl.focus();
    var range = D.createRange();
    range.selectNodeContents(contentEl);
    var sel = T.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return D.execCommand('insertText', false, newText);
  }

  // ---------------------------------------------------------------------
  // 7. Modal UI
  // ---------------------------------------------------------------------

  function ensureStylesInjected() {
    if (D.getElementById(STYLE_EL_ID)) return;
    var style = D.createElement('style');
    style.id = STYLE_EL_ID;
    style.textContent = MODAL_CSS;
    D.head.appendChild(style);
  }

  function cloneState(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function showToast(message) {
    ensureStylesInjected();
    var toast = D.createElement('div');
    toast.className = 'csp-toast';
    toast.textContent = message;
    (D.body || D.documentElement).appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5000);
  }

  function openEditor() {
    var view = currentView;
    if (!view) return;
    var sourceText = view.state.doc.toString();
    var data = extractJson(sourceText);
    if (!data) {
      showToast(
        'Case Studies Editor: could not read the panel data from this code block. ' +
          'Check that the block still contains a valid CASE_STUDIES_DATA_START / CASE_STUDIES_DATA_END comment.'
      );
      return;
    }
    var state = cloneState(data);
    renderModal(state, sourceText);
  }

  function renderModal(state, originalSourceText) {
    var overlay = D.createElement('div');
    overlay.className = 'csp-overlay';
    overlay.style.setProperty('--csp-accent', state.accent || DEFAULT_ACCENT);

    var modal = D.createElement('div');
    modal.className = 'csp-modal';
    overlay.appendChild(modal);

    // Header
    var header = D.createElement('div');
    header.className = 'csp-modal__header';
    header.innerHTML =
      '<div><h2 class="csp-modal__title">Edit Clinic Case Studies</h2>' +
      '<p class="csp-modal__subtitle">Manage filter tabs, case study cards, and accent colors.</p></div>';
    var closeBtn = D.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'csp-close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    var body = D.createElement('div');
    body.className = 'csp-modal__body';
    modal.appendChild(body);

    // --- Global settings section ---
    var globalSection = D.createElement('div');
    globalSection.className = 'csp-section';
    var globalTitle = D.createElement('div');
    globalTitle.className = 'csp-section__title';
    globalTitle.textContent = 'Global Settings';
    globalSection.appendChild(globalTitle);

    var globalRow = D.createElement('div');
    globalRow.className = 'csp-global-row';

    function colorField(labelText, key) {
      var label = D.createElement('label');
      label.className = 'csp-field-label';
      label.textContent = labelText;
      var row = D.createElement('div');
      row.className = 'csp-color-row';
      var swatch = D.createElement('input');
      swatch.type = 'color';
      swatch.className = 'csp-color-swatch';
      swatch.value = isHexColor(state[key]) && state[key].length === 7 ? state[key] : '#4a707c';
      var text = D.createElement('input');
      text.type = 'text';
      text.className = 'csp-input';
      text.style.width = '90px';
      text.value = state[key];
      swatch.addEventListener('input', function () {
        state[key] = swatch.value;
        text.value = swatch.value;
      });
      text.addEventListener('input', function () {
        state[key] = text.value;
        if (isHexColor(text.value) && text.value.length === 7) swatch.value = text.value;
      });
      row.appendChild(swatch);
      row.appendChild(text);
      label.appendChild(row);
      return label;
    }

    globalRow.appendChild(colorField('Accent Color', 'accent'));
    globalRow.appendChild(colorField('Accent Hover Color', 'accentHover'));

    var defaultFilterLabel = D.createElement('label');
    defaultFilterLabel.className = 'csp-field-label';
    defaultFilterLabel.textContent = 'Default Filter (Desktop & Mobile)';
    var defaultFilterSelect = D.createElement('select');
    defaultFilterSelect.className = 'csp-select';
    function renderDefaultFilterOptions() {
      defaultFilterSelect.innerHTML = '';
      state.filters
        .filter(function (f) { return f.key !== ALL_KEY; })
        .forEach(function (f) {
          var opt = D.createElement('option');
          opt.value = f.key;
          opt.textContent = f.label;
          if (f.key === state.defaultFilter) opt.selected = true;
          defaultFilterSelect.appendChild(opt);
        });
    }
    renderDefaultFilterOptions();
    defaultFilterSelect.addEventListener('change', function () {
      state.defaultFilter = defaultFilterSelect.value;
    });
    defaultFilterLabel.appendChild(defaultFilterSelect);
    globalRow.appendChild(defaultFilterLabel);

    globalSection.appendChild(globalRow);
    body.appendChild(globalSection);

    // --- Filters section ---
    var filtersSection = D.createElement('div');
    filtersSection.className = 'csp-section';
    var filtersTitleRow = D.createElement('div');
    filtersTitleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
    var filtersTitle = D.createElement('div');
    filtersTitle.className = 'csp-section__title';
    filtersTitle.style.margin = '0';
    filtersTitle.textContent = 'Filter Tabs';
    var addFilterBtn = D.createElement('button');
    addFilterBtn.type = 'button';
    addFilterBtn.className = 'csp-btn csp-btn--secondary csp-btn--small';
    addFilterBtn.textContent = '+ Add Filter';
    addFilterBtn.addEventListener('click', function () {
      var n = 1;
      var newKey = 'category-' + n;
      while (filterByKey(state, newKey)) {
        n += 1;
        newKey = 'category-' + n;
      }
      state.filters.push({
        key: newKey,
        label: 'New Category',
        badgeLabel: 'New Category',
        badgeBg: '#eef2f2',
        badgeText: '#374151'
      });
      renderFilters();
    });
    filtersTitleRow.appendChild(filtersTitle);
    filtersTitleRow.appendChild(addFilterBtn);
    filtersSection.appendChild(filtersTitleRow);

    var filtersWrap = D.createElement('div');
    filtersSection.appendChild(filtersWrap);
    body.appendChild(filtersSection);

    function renderFilters() {
      filtersWrap.innerHTML = '';
      state.filters.forEach(function (f, idx) {
        filtersWrap.appendChild(renderFilterCard(f, idx));
      });
      renderDefaultFilterOptions();
      renderCards();
    }

    function renderFilterCard(f, idx) {
      var isAll = f.key === ALL_KEY;
      var card = D.createElement('div');
      card.className = 'csp-filter-card';

      var headerRow = D.createElement('div');
      headerRow.className = 'csp-filter-card__header';
      var headerTitle = D.createElement('div');
      headerTitle.className = 'csp-filter-card__header-title';
      headerTitle.textContent = isAll ? '"Show all" tab (always first)' : 'Filter';
      headerRow.appendChild(headerTitle);
      if (!isAll) {
        var deleteBtn = D.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'csp-icon-btn csp-icon-btn--danger';
        deleteBtn.title = 'Delete filter (cards using it will need reassigning)';
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', function () {
          state.filters.splice(idx, 1);
          renderFilters();
        });
        headerRow.appendChild(deleteBtn);
      }
      card.appendChild(headerRow);

      var grid = D.createElement('div');
      grid.className = isAll ? 'csp-grid-2' : 'csp-grid-3';

      var keyLabel = D.createElement('label');
      keyLabel.className = 'csp-field-label';
      keyLabel.textContent = 'Key (used internally, no spaces)';
      var keyInput = D.createElement('input');
      keyInput.type = 'text';
      keyInput.className = 'csp-input csp-input--wide';
      keyInput.value = f.key;
      keyInput.disabled = isAll;
      keyInput.addEventListener('input', function () {
        var oldKey = f.key;
        f.key = keyInput.value.trim();
        state.cards.forEach(function (c) {
          if (c.category === oldKey) c.category = f.key;
        });
        if (state.defaultFilter === oldKey) state.defaultFilter = f.key;
      });
      keyLabel.appendChild(keyInput);
      grid.appendChild(keyLabel);

      var labelLabel = D.createElement('label');
      labelLabel.className = 'csp-field-label';
      labelLabel.textContent = 'Tab Label';
      var labelInput = D.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'csp-input csp-input--wide';
      labelInput.value = f.label;
      labelInput.addEventListener('input', function () {
        f.label = labelInput.value;
      });
      labelLabel.appendChild(labelInput);
      grid.appendChild(labelLabel);

      if (!isAll) {
        var badgeLabelLabel = D.createElement('label');
        badgeLabelLabel.className = 'csp-field-label';
        badgeLabelLabel.textContent = 'Badge Text';
        var badgeLabelInput = D.createElement('input');
        badgeLabelInput.type = 'text';
        badgeLabelInput.className = 'csp-input csp-input--wide';
        badgeLabelInput.value = f.badgeLabel || '';
        badgeLabelInput.addEventListener('input', function () {
          f.badgeLabel = badgeLabelInput.value;
        });
        badgeLabelLabel.appendChild(badgeLabelInput);
        grid.appendChild(badgeLabelLabel);

        var badgeBgLabel = D.createElement('label');
        badgeBgLabel.className = 'csp-field-label';
        badgeBgLabel.textContent = 'Badge Background';
        var badgeBgRow = D.createElement('div');
        badgeBgRow.className = 'csp-color-row';
        var badgeBgSwatch = D.createElement('input');
        badgeBgSwatch.type = 'color';
        badgeBgSwatch.className = 'csp-color-swatch';
        badgeBgSwatch.value = isHexColor(f.badgeBg) && f.badgeBg.length === 7 ? f.badgeBg : '#eef2f2';
        var badgeBgText = D.createElement('input');
        badgeBgText.type = 'text';
        badgeBgText.className = 'csp-input';
        badgeBgText.style.width = '90px';
        badgeBgText.value = f.badgeBg || '';
        badgeBgSwatch.addEventListener('input', function () {
          f.badgeBg = badgeBgSwatch.value;
          badgeBgText.value = badgeBgSwatch.value;
        });
        badgeBgText.addEventListener('input', function () {
          f.badgeBg = badgeBgText.value;
        });
        badgeBgRow.appendChild(badgeBgSwatch);
        badgeBgRow.appendChild(badgeBgText);
        badgeBgLabel.appendChild(badgeBgRow);
        grid.appendChild(badgeBgLabel);

        var badgeTextLabel = D.createElement('label');
        badgeTextLabel.className = 'csp-field-label';
        badgeTextLabel.textContent = 'Badge Text Color';
        var badgeTextRow = D.createElement('div');
        badgeTextRow.className = 'csp-color-row';
        var badgeTextSwatch = D.createElement('input');
        badgeTextSwatch.type = 'color';
        badgeTextSwatch.className = 'csp-color-swatch';
        badgeTextSwatch.value = isHexColor(f.badgeText) && f.badgeText.length === 7 ? f.badgeText : '#374151';
        var badgeTextText = D.createElement('input');
        badgeTextText.type = 'text';
        badgeTextText.className = 'csp-input';
        badgeTextText.style.width = '90px';
        badgeTextText.value = f.badgeText || '';
        badgeTextSwatch.addEventListener('input', function () {
          f.badgeText = badgeTextSwatch.value;
          badgeTextText.value = badgeTextSwatch.value;
        });
        badgeTextText.addEventListener('input', function () {
          f.badgeText = badgeTextText.value;
        });
        badgeTextRow.appendChild(badgeTextSwatch);
        badgeTextRow.appendChild(badgeTextText);
        badgeTextLabel.appendChild(badgeTextRow);
        grid.appendChild(badgeTextLabel);
      }

      card.appendChild(grid);
      return card;
    }

    // --- Cards section ---
    var cardsSection = D.createElement('div');
    cardsSection.className = 'csp-section';
    var cardsTitleRow = D.createElement('div');
    cardsTitleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
    var cardsTitle = D.createElement('div');
    cardsTitle.className = 'csp-section__title';
    cardsTitle.style.margin = '0';
    cardsTitle.textContent = 'Case Study Cards';
    var addCardBtn = D.createElement('button');
    addCardBtn.type = 'button';
    addCardBtn.className = 'csp-btn csp-btn--secondary csp-btn--small';
    addCardBtn.textContent = '+ Add Card';
    addCardBtn.addEventListener('click', function () {
      var firstRealFilter = state.filters.filter(function (f) { return f.key !== ALL_KEY; })[0];
      state.cards.push({
        category: firstRealFilter ? firstRealFilter.key : ALL_KEY,
        image: '',
        imageAlt: '',
        title: 'New Case Study',
        jobTitle: '',
        meta: '',
        location: '',
        description: '',
        logo: '',
        linkText: 'Read More',
        linkUrl: '#'
      });
      renderCards();
    });
    cardsTitleRow.appendChild(cardsTitle);
    cardsTitleRow.appendChild(addCardBtn);
    cardsSection.appendChild(cardsTitleRow);

    var cardsWrap = D.createElement('div');
    cardsSection.appendChild(cardsWrap);
    body.appendChild(cardsSection);

    function renderCards() {
      cardsWrap.innerHTML = '';
      state.cards.forEach(function (c, idx) {
        cardsWrap.appendChild(renderCardCard(c, idx));
      });
    }

    function renderCardCard(c, idx) {
      var card = D.createElement('div');
      card.className = 'csp-card-card';

      var headerRow = D.createElement('div');
      headerRow.className = 'csp-card-card__header';
      var headerTitle = D.createElement('div');
      headerTitle.className = 'csp-card-card__header-title';
      headerTitle.textContent = 'Card ' + (idx + 1);
      var deleteBtn = D.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'csp-icon-btn csp-icon-btn--danger';
      deleteBtn.title = 'Delete card';
      deleteBtn.textContent = '🗑';
      deleteBtn.addEventListener('click', function () {
        state.cards.splice(idx, 1);
        renderCards();
      });
      headerRow.appendChild(headerTitle);
      headerRow.appendChild(deleteBtn);
      card.appendChild(headerRow);

      var grid = D.createElement('div');
      grid.className = 'csp-grid-3';

      var catLabel = D.createElement('label');
      catLabel.className = 'csp-field-label';
      catLabel.textContent = 'Category';
      var catSelect = D.createElement('select');
      catSelect.className = 'csp-select csp-input--wide';
      state.filters
        .filter(function (f) { return f.key !== ALL_KEY; })
        .forEach(function (f) {
          var opt = D.createElement('option');
          opt.value = f.key;
          opt.textContent = f.label;
          if (f.key === c.category) opt.selected = true;
          catSelect.appendChild(opt);
        });
      catSelect.addEventListener('change', function () {
        c.category = catSelect.value;
      });
      catLabel.appendChild(catSelect);
      grid.appendChild(catLabel);

      function textField(labelText, key, full) {
        var label = D.createElement('label');
        label.className = 'csp-field-label' + (full ? ' csp-full' : '');
        label.textContent = labelText;
        var input = D.createElement('input');
        input.type = 'text';
        input.className = 'csp-input csp-input--wide';
        input.value = c[key] || '';
        input.addEventListener('input', function () {
          c[key] = input.value;
        });
        label.appendChild(input);
        return label;
      }

      grid.appendChild(textField('Name', 'title'));
      grid.appendChild(textField('Job Title', 'jobTitle'));
      grid.appendChild(textField('Business Name', 'meta'));
      grid.appendChild(textField('Location', 'location'));
      grid.appendChild(textField('Logo Image URL', 'logo', true));
      grid.appendChild(textField('Image URL', 'image', true));
      grid.appendChild(textField('Image alt text', 'imageAlt', true));

      var descLabel = D.createElement('label');
      descLabel.className = 'csp-field-label csp-full';
      descLabel.textContent = 'Description (HTML like <strong> is preserved)';
      var descInput = D.createElement('input');
      descInput.type = 'text';
      descInput.className = 'csp-input csp-input--wide';
      descInput.value = c.description;
      descInput.addEventListener('input', function () {
        c.description = descInput.value;
      });
      descLabel.appendChild(descInput);
      grid.appendChild(descLabel);

      grid.appendChild(textField('Link Button Text', 'linkText'));
      grid.appendChild(textField('Link URL', 'linkUrl'));

      card.appendChild(grid);
      return card;
    }

    renderFilters();

    // Error banner
    var errorBanner = D.createElement('div');
    errorBanner.className = 'csp-error-banner';
    errorBanner.style.display = 'none';
    body.appendChild(errorBanner);

    // Footer
    var footer = D.createElement('div');
    footer.className = 'csp-modal__footer';

    var footerNote = D.createElement('p');
    footerNote.className = 'csp-footer-note';
    footerNote.textContent =
      'Saving here updates the code editor box only. You still need to click Squarespace’s own Save button afterwards.';
    footer.appendChild(footerNote);

    var footerButtons = D.createElement('div');
    footerButtons.className = 'csp-footer-buttons';

    var cancelBtn = D.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'csp-btn csp-btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });

    var saveBtn = D.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'csp-btn csp-btn--primary';
    saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', function () {
      var errors = validateState(state);
      if (errors.length > 0) {
        errorBanner.style.display = 'block';
        errorBanner.innerHTML =
          '<strong>Please fix the following before saving:</strong><ul>' +
          errors.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') +
          '</ul>';
        return;
      }
      errorBanner.style.display = 'none';
      commitSave(state, originalSourceText, overlay);
    });

    footerButtons.appendChild(cancelBtn);
    footerButtons.appendChild(saveBtn);
    footer.appendChild(footerButtons);
    modal.appendChild(footer);

    (D.body || D.documentElement).appendChild(overlay);
  }

  function validateState(state) {
    var errors = [];

    if (!isHexColor(state.accent)) errors.push('Accent color must be a valid hex color (e.g. #4A707C).');
    if (!isHexColor(state.accentHover)) errors.push('Accent hover color must be a valid hex color.');

    var realFilters = state.filters.filter(function (f) { return f.key !== ALL_KEY; });
    if (realFilters.length === 0) {
      errors.push('There must be at least one filter besides "Show all".');
    }

    var seenKeys = {};
    state.filters.forEach(function (f) {
      if (!f.key || !f.key.trim()) {
        errors.push('Every filter needs a non-empty key.');
      } else if (seenKeys[f.key]) {
        errors.push('Filter key "' + f.key + '" is used more than once -- keys must be unique.');
      }
      seenKeys[f.key] = true;
      if (!f.label || !f.label.trim()) {
        errors.push('Filter "' + f.key + '" needs a tab label.');
      }
    });

    if (!filterByKey(state, state.defaultFilter) || state.defaultFilter === ALL_KEY) {
      errors.push('Default filter must reference one of the real filters (not "Show all").');
    }

    state.cards.forEach(function (c, idx) {
      if (!c.title || !c.title.trim()) {
        errors.push('Card ' + (idx + 1) + ' needs a title.');
      }
      if (!filterByKey(state, c.category) || c.category === ALL_KEY) {
        errors.push('Card ' + (idx + 1) + ' ("' + (c.title || 'untitled') + '") has an invalid category.');
      }
    });

    return errors;
  }

  function commitSave(state, originalSourceText, overlay) {
    var liveView = findMatchingEditorView();
    var newSourceText = regenerateSourceText(originalSourceText, state);

    if (liveView) {
      writeToEditor(liveView, newSourceText);
      overlay.parentNode.removeChild(overlay);
      showToast(
        'Case studies panel updated in the code editor box. Now click Squarespace’s own Save button to publish the change.'
      );
    } else {
      overlay.parentNode.removeChild(overlay);
      showFallbackPanel(newSourceText);
    }
  }

  function showFallbackPanel(newSourceText) {
    var overlay = D.createElement('div');
    overlay.className = 'csp-overlay';

    var modal = D.createElement('div');
    modal.className = 'csp-modal';
    overlay.appendChild(modal);

    var header = D.createElement('div');
    header.className = 'csp-modal__header';
    header.innerHTML =
      '<div><h2 class="csp-modal__title">Copy Updated Code</h2>' +
      '<p class="csp-modal__subtitle">This tool could not reach the Squarespace code editor box directly. ' +
      'Copy the code below and paste it in manually, replacing the current contents of the case studies code block, ' +
      'then click Squarespace’s own Save button.</p></div>';
    var closeBtn = D.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'csp-close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var body = D.createElement('div');
    body.className = 'csp-modal__body';

    var textarea = D.createElement('textarea');
    textarea.className = 'csp-fallback-textarea';
    textarea.readOnly = true;
    textarea.value = newSourceText;
    body.appendChild(textarea);

    modal.appendChild(body);

    var footer = D.createElement('div');
    footer.className = 'csp-modal__footer';
    var footerButtons = D.createElement('div');
    footerButtons.className = 'csp-footer-buttons';

    var copyBtn = D.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'csp-btn csp-btn--primary';
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.addEventListener('click', function () {
      textarea.select();
      var copied = false;
      try {
        copied = D.execCommand('copy');
      } catch (e) {
        copied = false;
      }
      if (T.navigator.clipboard && T.navigator.clipboard.writeText) {
        T.navigator.clipboard.writeText(newSourceText).catch(function () {});
      }
      copyBtn.textContent = copied ? 'Copied!' : 'Select all text above and copy';
      setTimeout(function () {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    });

    var closeFooterBtn = D.createElement('button');
    closeFooterBtn.type = 'button';
    closeFooterBtn.className = 'csp-btn csp-btn--secondary';
    closeFooterBtn.textContent = 'Close';
    closeFooterBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });

    footerButtons.appendChild(closeFooterBtn);
    footerButtons.appendChild(copyBtn);
    footer.appendChild(footerButtons);
    modal.appendChild(footer);

    (D.body || D.documentElement).appendChild(overlay);
  }
})();
