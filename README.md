# Miller Hoops

A static basketball training page. Serve this directory with any static web server
(for example, `python3 -m http.server 8000`) and open it over HTTP. No build step is required.

## File layout

- `index.html`: page sections and static controls.
- `styles.css`: shared styles and responsive layout.
- `js/app.js`: state, drill loading, favorites, timer, progress, daily plan, profile,
  owner operations, and event wiring, grouped into named sections.
- `js/templates.js`: escaped HTML templates for drill cards, daily plan items,
  and owner editing controls.
- `js/supabase.js`: the existing Supabase client configuration and owner session check.

Controls use `data-action` attributes and a delegated click listener in `app.js`.
This keeps newly rendered buttons functional without inline JavaScript or globals.
The existing browser storage keys and data shapes are preserved:
`millerHoopsStats`, `mhPlan`, and `mhProfile`.

Supabase still reads `drills` ordered by `created_at` and uses the existing password
login and insert/update/delete operations. The owner email check controls the UI;
Supabase database policies must enforce owner write permissions. This refactor does
not change database policies or the CDN dependency version.

## Verification

Install jsdom in your test environment, then run `node tests/dom-smoke.cjs`
(set `NODE_PATH` if jsdom is installed outside this project). The test loads the
real page markup, templates, and application logic into a DOM and replaces
Supabase with a mock. It covers loading and failure, search/sorting/filtering,
favorites, existing profile data, daily plans, timer completion and progress,
and owner login and CRUD. It does not write to the live database.

These checks do not verify visual layout or the live Supabase service.
