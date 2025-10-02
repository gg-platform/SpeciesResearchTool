# Copilot Instructions for AI Agents

## Project Overview
- **Species Research Tool** is a client-side web app for exploring biodiversity records from the NBN Atlas API.
- The app fetches, processes, and visualizes wildlife occurrence data, with special analysis for Birds of Conservation Concern (BoCC).
- All data processing is done in-browser; no backend/server code exists.

## Architecture & Key Files
- `index.html`: Main entry point, loads UI and external libraries (Chart.js, Leaflet, MarkerCluster).
- `app.js`: Core logic for data fetching, transformation, charting, map rendering, and BoCC analysis. All state and UI logic is here.
- `bocc.json`: Reference data for BoCC lists (Red, Amber, Former breeding) used for species status analysis.
- `styles.css`: Custom styles for UI components and charts.

## Data Flow
- User pastes an NBN Atlas API URL; app fetches JSON occurrence records in paginated batches (500 per page, up to ~200,000 records).
- Records are normalized and stored in a global `state` object.
- Data is visualized in charts (Chart.js) and a map (Leaflet + MarkerCluster).
- BoCC analysis cross-references fetched bird species with `bocc.json`.

## Developer Workflows
- **No build step required**: All code is plain JS/HTML/CSS, loaded directly in browser.
- **Debugging**: Use browser DevTools (console, network tab) to inspect state, API requests, and UI updates.
- **Testing**: Manual, via UI. No automated tests or test runner present.
- **External dependencies**: Chart.js, Leaflet, MarkerCluster loaded via CDN in `index.html`.

## Project-Specific Patterns & Conventions
- All UI state and logic is managed in `app.js` using a single `state` object.
- Data tables and charts are dynamically generated from the fetched data; no static markup for results.
- All links to species names use Google search for quick lookup.
- License attribution for datasets is handled via the `licenseInfo` and `renderAttribution` functions in `app.js`.
- BoCC analysis uses normalized species names for matching (see `normName`).
- Map rendering is triggered automatically when switching to the Map tab if data is present.
- No persistent storage; all data is lost on page reload.

## Integration Points
- **NBN Atlas API**: User-provided URL, must be a valid JSON web service endpoint.
- **BoCC Reference**: `bocc.json` is loaded at startup for bird status analysis.
- **Map**: Uses OpenStreetMap tiles via Leaflet; clusters large datasets for performance.

## Example: Adding a New Chart
- Add a new chart in `buildOverview()` in `app.js`.
- Use Chart.js via CDN (already loaded in `index.html`).
- Update the UI by appending a new `<canvas>` element in the relevant section of `index.html`.

## Example: Extending BoCC Analysis
- Update `bocc.json` with new species or lists.
- Adjust BoCC logic in `buildBoccAnalysis()` and `loadBoccJson()` in `app.js`.

---

For questions or unclear patterns, review `README.md` and `app.js` for implementation details. Ask for feedback if any workflow or convention is ambiguous.