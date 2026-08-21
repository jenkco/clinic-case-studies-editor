# Clinic Case Studies Panel Editor

A companion tool to the [Clinic Pricing Table Editor](../clinic-pricing-editor), same
approach, same author, same site. It lets a Squarespace site owner edit a filterable case
studies / testimonials grid — filter tab labels, every card's content, and the accent
colors (including each category's badge color) — through a form UI, without hand-editing
HTML.

It does **not** save anything to Squarespace by itself. It regenerates the code block's
content and writes it into Squarespace's own CodeMirror editing box for you; you still
click Squarespace's native **Save** button.

## How it works (same platform lessons as the pricing tool, one new wrinkle)

- Panel data lives as an HTML comment (`CASE_STUDIES_DATA_START` / `_END`), not a
  `<script type="application/json">` tag — Squarespace disables all custom Code Injection
  scripts on a page whose code blocks contain a `<script>` tag, and separately locks that
  block behind a paid-plan notice. A comment triggers neither.
- The code block's editor is CodeMirror 6, reached the same way as the pricing tool: via
  `window.top`, reading/writing through `view.contentDOM` +
  `execCommand('insertText', ...)` rather than CodeMirror's own `dispatch()` (which hung
  the editor tab when tested against a whole-document replace).
- **The new wrinkle**: unlike the pricing table, this panel needs real JavaScript on the
  live site for the filter tabs to do anything when a visitor clicks them. That logic
  can't live inside the code block (any `<script>` there re-triggers the exact restriction
  above) — so it lives in this same script instead, running unconditionally on every page
  as a harmless no-op wherever the panel's markup isn't present. Only Footer Code
  Injection carries JavaScript at all; the code block itself never does.
- A small slice of the `<style>` block — the accent color variables and each category's
  badge colors — is tool-owned and regenerated on save, because those are derived from your
  data (filter keys, chosen colors), not just your own static styling. Everything else in
  `<style>` (fonts, spacing, layout, hover animations) is preserved exactly as written and
  never touched. Which filter is pre-selected on load isn't a CSS rule at all — it's a
  `data-default-filter` attribute read once by the live page's own script, so it applies
  consistently on desktop and mobile with only one mechanism ever controlling which tab
  looks selected.

## 1. One-time setup: create the case studies code block

Add a **Code Block** with this structure. Swap in your own header text, fonts, and
`<style>` details if you like — just keep the container id and the three marker pairs
exactly as shown: `CASE_STUDIES_GRID_START/END` and `CASE_STUDIES_DATA_START/END` are
regular HTML comments (`<!-- ... -->`), while `CASE_STUDIES_STYLE_START/END` sits inside
the `<style>` tag and must use CSS comment syntax instead (`/* ... */`) — `<!-- -->` isn't
valid CSS and can confuse the stylesheet parser. Never add a `<script>` tag anywhere in
this block.

```html
<div id="sqs-clinic-outcomes-section">

  <div class="sqs-co-header">
    <span class="sqs-co-subtitle">Real Clinic Outcomes</span>
    <h2 class="sqs-co-title">Trusted by Over 100 Clinic Owners Across UK &amp; Ireland</h2>
    <p class="sqs-co-desc">Filter by clinic structure to see real transformations and measured commercial results.</p>
  </div>

  <!-- CASE_STUDIES_GRID_START -->
  <div class="sqs-co-filter-wrapper" data-default-filter="nurse">
    <button class="sqs-co-tab" data-filter="all">All Clinics</button>
    <button class="sqs-co-tab" data-filter="nurse">Solo Practitioner / Nurse</button>
  </div>
  <div class="sqs-co-grid">
    <div class="sqs-co-card" data-category="nurse">
      <div class="sqs-co-card-image">
        <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=80" alt="Skin by Sarah Connolly">
        <span class="sqs-co-badge" data-badge-cat="nurse">Nurse-Led Clinic</span>
      </div>
      <div class="sqs-co-card-body">
        <div>
          <div class="sqs-co-card-meta">Skin by Sarah Connolly</div>
          <h3 class="sqs-co-card-title">Sarah Connolly</h3>
          <div class="sqs-co-card-jobtitle">Aesthetic Nurse Prescriber</div>
          <p class="sqs-co-card-text">Solo nurse with a loyal client base but no digital presence.</p>
        </div>
        <div class="sqs-co-card-footer">
          <div class="sqs-co-card-location">Ireland</div>
          <div class="sqs-co-card-footer-row">
            <a href="#" class="sqs-co-read-more">Read More</a>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- CASE_STUDIES_GRID_END -->

</div>

<!-- CASE_STUDIES_DATA_START
{
  "accent": "#4A707C",
  "accentHover": "#3a5a65",
  "defaultFilter": "nurse",
  "filters": [
    { "key": "all", "label": "All Clinics" },
    { "key": "nurse", "label": "Solo Practitioner / Nurse", "badgeLabel": "Nurse-Led Clinic", "badgeBg": "#ecfdf5", "badgeText": "#065f46" }
  ],
  "cards": [
    {
      "category": "nurse",
      "image": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=80",
      "imageAlt": "Skin by Sarah Connolly",
      "title": "Sarah Connolly",
      "jobTitle": "Aesthetic Nurse Prescriber",
      "meta": "Skin by Sarah Connolly",
      "location": "Ireland",
      "description": "Solo nurse with a loyal client base but no digital presence.",
      "linkText": "Read More",
      "linkUrl": "#"
    }
  ]
}
CASE_STUDIES_DATA_END -->

<style>
  /* CASE_STUDIES_STYLE_START */
  :root { --csp-accent: #4A707C; --csp-accent-hover: #3a5a65; }
  .sqs-co-badge[data-badge-cat="nurse"] { background: #ecfdf5; color: #065f46; }
  /* CASE_STUDIES_STYLE_END */

  #sqs-clinic-outcomes-section { font-family: inherit; padding: 80px 40px; background: #ffffff; max-width: 1200px; margin: 0 auto; }
  .sqs-co-header { text-align: center; margin-bottom: 48px; }
  .sqs-co-subtitle { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--csp-accent); margin-bottom: 12px; }
  .sqs-co-title { font-family: inherit; font-size: clamp(28px, 4vw, 44px); font-weight: 700; color: #1a1a2e; margin: 0 0 16px; line-height: 1.2; }
  .sqs-co-desc { font-size: 16px; color: #6b7280; max-width: 560px; margin: 0 auto; line-height: 1.6; }
  .sqs-co-filter-wrapper { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 48px; }
  .sqs-co-tab { padding: 10px 22px; border-radius: 100px; border: 1.5px solid #d1d5db; background: transparent; font-family: inherit; font-size: 13px; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.25s ease; }
  .sqs-co-tab:hover { border-color: var(--csp-accent); color: var(--csp-accent); }
  .sqs-co-tab.active { background: var(--csp-accent); border-color: var(--csp-accent); color: #ffffff; }
  .sqs-co-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 28px; }
  .sqs-co-card { border-radius: 12px; overflow: hidden; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: transform 0.25s ease, box-shadow 0.25s ease; display: flex; flex-direction: column; }
  .sqs-co-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
  .sqs-co-card.hidden { display: none; }
  .sqs-co-card-image { position: relative; height: 150px; overflow: hidden; }
  .sqs-co-card-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
  .sqs-co-card:hover .sqs-co-card-image img { transform: scale(1.04); }
  .sqs-co-badge { position: absolute; top: 11px; left: 11px; padding: 3px 9px; border-radius: 100px; font-size: 8px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .sqs-co-card-body { padding: 18px; display: flex; flex-direction: column; justify-content: space-between; flex: 1; gap: 15px; }
  .sqs-co-card-meta { font-size: 16px; color: var(--csp-accent); font-weight: 700; text-align: center; margin: 0 0 11px; }
  .sqs-co-card-title { font-family: inherit; font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 0 0 3px; }
  .sqs-co-card-jobtitle { font-size: 10px; color: #6b7280; font-weight: 500; margin-bottom: 15px; }
  .sqs-co-card-text { font-size: 11px; color: #4b5563; line-height: 1.65; margin: 0; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .sqs-co-card-footer { display: flex; flex-direction: column; gap: 8px; }
  .sqs-co-card-location { font-size: 11px; color: #9ca3af; font-weight: 500; }
  .sqs-co-card-footer-row { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid #f3f4f6; }
  .sqs-co-read-more { display: inline-block; padding: 6px 15px; border-radius: 100px; background: var(--csp-accent); color: #ffffff; font-family: inherit; font-size: 10px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; }
  .sqs-co-read-more:hover { background: var(--csp-accent-hover); transform: translateY(-1px); }
  @media (max-width: 768px) {
    #sqs-clinic-outcomes-section { padding: 60px 20px; }
    .sqs-co-grid { grid-template-columns: 1fr; }
    .sqs-co-tab { font-size: 12px; padding: 8px 16px; }
  }
</style>
```

A few things worth noting about this template versus your original code:

- **No Google Fonts `@import`, and every `font-family` in the block's own `<style>` is
  `inherit`.** Headings and body text pick up whatever font the host page already uses,
  rather than loading Cormorant Garamond / Plus Jakarta Sans from a third-party CDN. Note
  this is only about the panel's own content — the editor tool's modal (the form you see
  when you click "Edit Case Studies") keeps its own font stack, since that's UI chrome for
  you, not part of the page visitors see.
- **No Font Awesome `<link>` tag, no `<i class="fa-solid ...">` icons, and no icon/logo
  badge in the card footer at all.** Earlier versions had one (first a single emoji, then
  a business logo image); both were removed. The footer now holds only the "Read More"
  link, right-aligned — this removes any third-party icon CDN dependency, matching the
  security posture of the pricing tool (no assets loaded from any domain but your own
  GitHub Pages for the tool itself).
- **No filter-wiring `<script>` at the bottom of the block.** That logic now lives in
  `case-studies-editor.js` itself (loaded via Footer Code Injection) and runs on every
  page automatically — see "How it works" above for why.
- **No `.sqs-co-badge-nurse` / `-medical` / `-rebrand` classes.** Badge colors are now
  driven by `data-badge-cat="KEY"` plus a regenerated CSS rule per filter, so adding a new
  category and giving it a color happens once, in the editor, rather than needing a new
  hardcoded CSS class.
- **No CSS rule hardcoding the default filter's look.** Which filter is pre-selected on
  load — on both desktop and mobile — is carried as a `data-default-filter="KEY"` attribute
  on `.sqs-co-filter-wrapper`, read once at page load by the same script that handles
  clicks. An earlier version of this tool used a CSS media-query rule instead
  (`.sqs-co-tab[data-filter="X"]`), which ties in specificity with the `.sqs-co-tab.active`
  rule everything else uses — and when two rules tie, CSS picks whichever comes later in
  the stylesheet, not whichever one is "supposed" to win. That let the default tab stay
  visually highlighted after a visitor picked a different one, even though the correct
  cards were showing underneath. Routing it through the same JS that handles clicks means
  there's only ever one thing in charge of what "selected" looks like.
- **The grid itself already resizes for whatever's showing.** Filtering works by putting
  `display: none` on non-matching cards, which removes them from layout entirely — the
  CSS grid reflows the remaining cards and the section's height shrinks to fit, with no
  fixed height or `min-height` anywhere holding old empty space open. No extra work needed
  here; it falls out of how the filtering was already built.

## 2. Install the editor script

Go to **Settings → Advanced → Code Injection → Footer** and add this as an *additional*
line — don't remove anything already there (e.g. the pricing tool's script tag):

```html
<script src="PASTE_YOUR_HOSTED_URL_HERE/case-studies-editor.js" defer></script>
```

Save.

## 3. Editing the panel

1. Open the page with the case studies code block in Squarespace's editor.
2. A red **"✎ Edit Case Studies"** button appears floating near the top right as soon as
   that block's code editor panel is open (a different color from the pricing tool's
   button, so you can tell them apart at a glance).
3. Click it. A form opens with three sections:
   - **Global Settings**: accent color, accent hover color, and which filter is shown by
     default on page load (desktop and mobile both).
   - **Filter Tabs**: the "Show all" tab (label only, always first) plus your real
     categories — each with a key, a tab label, and its own badge text + colors.
   - **Case Study Cards**: one entry per card — category, name, job title, business name,
     location, image URL + alt text, description, and the "Read More" button's text and
     link.
4. Click **Save Changes**. The tool writes the regenerated code into Squarespace's code
   editor box and shows a brief confirmation.
5. **You must still click Squarespace's own native Save button** to publish the change.

If the tool can't reach the code editor directly, it shows the regenerated code with a
**Copy to Clipboard** button instead — paste that over the existing block content, then
click Squarespace's Save.

## Notes on card fields

- Each card shows, in order below the photo: **Business Name** (centered, larger, dark
  text), the person's **Name**, and their **Job Title** — stored as `meta`, `title`, and
  `jobTitle` respectively in the data JSON, for backward compatibility with the field
  names the tool has always used internally.
- **Location** (stored as `location`) shows in the card's footer, above the divider line
  that separates it from the "Read More" row. Leave it blank to omit that line entirely.
- **Description** is inserted as raw HTML, not escaped, so `<strong>...</strong>` and
  similar inline markup survive if you type them directly into that field. Name, job
  title, business name, and image alt text are treated as plain text.
- **Category** must match one of your filter keys (the dropdown only offers valid ones).
  Renaming a filter's key automatically updates every card using it.
- Deleting a filter does **not** delete cards that used it — reassign them to another
  category in the editor, or the block will fail validation on save until you do.

## Manual test checklist

- [ ] On the **live public page**: filter tabs actually filter cards when clicked, no
      console errors, and no "Edit Case Studies" button appears.
- [ ] In the Squarespace editor, opening any **other** page's code block does not show
      the button.
- [ ] Opening the case studies block shows the button, and it's clearly a custom tool
      (red, labelled "Custom tool (not part of Squarespace)").
- [ ] Editing filters/cards/colors and clicking Save Changes updates the code editor box
      with correctly regenerated data, the tool-owned style snippet, and grid markup —
      and your header text, fonts, and layout rules are untouched.
- [ ] Renaming a filter's key updates every card that referenced it. Deleting a filter
      used by an existing card blocks saving with a clear validation error.
- [ ] After a successful save inside the tool, Squarespace's own Save button still has to
      be clicked to actually publish.
