/* ====== Utilities ===== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const escapeHtml = (s) =>
  String(s ?? "").replace(
    /[&<>\"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );

function updateInfoBanners() {
  const url = state.sourceUrl || "";
  const timeStr = state.lastFetchedIso
    ? new Date(state.lastFetchedIso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";

  [
    { link: "#infoSrc_overview", time: "#infoTime_overview" },
    { link: "#infoSrc_bocc", time: "#infoTime_bocc" },
    { link: "#infoSrc_map", time: "#infoTime_map" },
  ].forEach((sel) => {
    const a = document.querySelector(sel.link);
    const t = document.querySelector(sel.time);
    if (a) {
      if (url) {
        a.textContent = url;
        a.href = url;
        a.title = url;
      } else {
        a.textContent = "–";
        a.removeAttribute("href");
        a.removeAttribute("title");
      }
    }
    if (t) t.textContent = timeStr;
  });
}

/* ====== State ====== */
const state = {
  aborter: null,
  rows: [],
  charts: {},
  bocc: null, // { listToSpecies: {List: [{name,annotation}]}, speciesToList: {lowerName: List}, lists: [...] }
  map: null,
  cluster: null,
  showTables: false,
  sourceUrl: "",
  lastFetchedIso: "",
};

/* ====== Tabs ====== */
function showTab(id) {
  $$("section").forEach((sec) => (sec.hidden = sec.id !== id));
  $$(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.target === id)
  );
  $$(".appbar .btn").forEach((b) =>
    b.classList.toggle("primary", b.dataset.goto === id)
  );
  // If user opens the Map tab, make sure the map is created & sized
  if (id === "map") {
    // Create map if needed
    ensureMap();
    // Defer to after layout so Leaflet can measure the visible container
    setTimeout(() => {
      try {
        state.map.invalidateSize();
      } catch (e) {}
    }, 0);
  }
  if (id === 'overview') {
  // If charts exist, just resize; if not yet built (first visit), build then resize
  if (Object.keys(state.charts).length) resizeAllCharts();
  else if (state.rows.length) { buildOverview(); }
}
  updateInfoBanners();
}

function wireTabs() {
  $$(".tab").forEach((t) =>
    t.addEventListener("click", () => showTab(t.dataset.target))
  );
  $$(".appbar .btn").forEach((b) =>
    b.addEventListener("click", () => showTab(b.dataset.goto))
  );
}

/* ====== Fetch & pagination ====== */
function upsertQueryParam(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}
function normalizeUrl(url) {
  return url.trim().replace(/^htts:\/\//i, "https://");
}
async function httpJson(url, signal) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    mode: "cors",
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fetchAll(url, statusCb) {
  const aborter = new AbortController();
  state.aborter = aborter;
  try {
    let startIndex = 0,
      pageSize = 500,
      pages = 0,
      total = Infinity;
    url = upsertQueryParam(normalizeUrl(url), "pageSize", String(pageSize));
    url = upsertQueryParam(url, "startIndex", String(startIndex));

    const out = [];
    while (startIndex < total) {
      const pageUrl = upsertQueryParam(url, "startIndex", String(startIndex));
      statusCb?.(`Fetching… startIndex=${startIndex}`);
      const j = await httpJson(pageUrl, aborter.signal);
      const occ = Array.isArray(j.occurrences) ? j.occurrences : [];
      out.push(...occ);

      const t = Number(j.totalRecords);
      const ps = Number(j.pageSize);
      total = Number.isFinite(t) ? t : out.length;
      pageSize = Number.isFinite(ps) && ps > 0 ? ps : pageSize;
      startIndex += pageSize;
      pages++;
      statusCb?.(`Fetched page ${pages} (${out.length}/${total})`);
      if (pages > 200) throw new Error("Safety cap reached (200 pages)");
    }
    statusCb?.(`Done. ${out.length} records.`);
    return out;
  } finally {
    state.aborter = null;
  }
}
function cancelFetch() {
  if (state.aborter) {
    state.aborter.abort();
    state.aborter = null;
    $("#status").textContent = "Cancelled.";
  }
}

/* ====== Transform rows ====== */
function toDateString(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds()
  )}`;
}
function mapRows(occ) {
  return occ.map((o) => ({
    vernacularName: o.vernacularName || "",
    scientificName: o.scientificName || "",
    classs: o.classs || "",
    basisOfRecord: o.basisOfRecord || "",
    provider: o.dataProviderName || "",
    eventDateStr: toDateString(o.eventDate),
    occurrenceYearStr: toDateString(o.occurrenceYear),
    lat: Number(o.decimalLatitude),
    lon: Number(o.decimalLongitude),
  }));
}
function parseDateFromStrings(a, b) {
  const s = (a || b || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(m[1] + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

/* ====== Data table helpers ====== */
function renderTable(hostSel, headers, rows) {
  const host = $(hostSel);
  host.innerHTML = "";
  const tbl = document.createElement("table");
  const thead = document.createElement("thead");
  thead.appendChild(tr(headers, true));
  const tbody = document.createElement("tbody");
  if (!rows.length) {
    const td = document.createElement("td");
    td.colSpan = headers.length;
    td.textContent = "(no data)";
    const trr = document.createElement("tr");
    trr.appendChild(td);
    tbody.appendChild(trr);
  } else {
    rows.forEach((r) => tbody.appendChild(tr(r, false)));
  }
  tbl.append(thead, tbody);
  host.appendChild(tbl);

  function tr(arr, head) {
    const row = document.createElement("tr");
    arr.forEach((cell) => {
      const el = document.createElement(head ? "th" : "td");
      el.textContent = cell;
      row.appendChild(el);
    });
    return row;
  }
}

/* ====== Charts (Chart.js) ====== */
function destroyCharts() {
  Object.values(state.charts).forEach((c) => c?.destroy());
  state.charts = {};
}

function buildOverview() {
  const rows = state.rows;
  $("#totalRecords").textContent = String(rows.length);

  // by month
  const monthMap = {};
  rows.forEach((r) => {
    const d = parseDateFromStrings(r.eventDateStr, r.occurrenceYearStr);
    if (!d) return;
    const k = d.toISOString().slice(0, 7);
    monthMap[k] = (monthMap[k] || 0) + 1;
  });
  const months = Object.keys(monthMap).sort();
  const monthCounts = months.map((m) => monthMap[m]);

  // top species
  const spMap = {};
  rows.forEach((r) => {
    const n = (r.vernacularName || r.scientificName || "(unknown)").trim();
    spMap[n] = (spMap[n] || 0) + 1;
  });
  const spTop = Object.entries(spMap)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v || a.k.localeCompare(b.k))
    .slice(0, 10);

  // by class
  const clMap = {};
  rows.forEach((r) => {
    const c = (r.classs || "(unknown)").trim();
    clMap[c] = (clMap[c] || 0) + 1;
  });
  const clLabels = Object.keys(clMap).sort((a, b) => a.localeCompare(b));
  const clCounts = clLabels.map((k) => clMap[k]);

  // basis
  const bsMap = {};
  rows.forEach((r) => {
    const b = (r.basisOfRecord || "(unknown)").trim();
    bsMap[b] = (bsMap[b] || 0) + 1;
  });
  const bsLabels = Object.keys(bsMap).sort((a, b) => a.localeCompare(b));
  const bsCounts = bsLabels.map((k) => bsMap[k]);

  // providers
  const pvMap = {};
  rows.forEach((r) => {
    const p = (r.provider || "(unknown)").trim();
    pvMap[p] = (pvMap[p] || 0) + 1;
  });
  const pvTop = Object.entries(pvMap)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v || a.k.localeCompare(b.k))
    .slice(0, 10);

  // NEW: species richness by month
  const richnessMap = {}; // month -> set of species
  rows.forEach((r) => {
    const d = parseDateFromStrings(r.eventDateStr, r.occurrenceYearStr);
    if (!d) return;
    const m = d.toISOString().slice(0, 7);
    const nm = (r.vernacularName || r.scientificName || "").trim();
    if (!nm) return;
    (richnessMap[m] = richnessMap[m] || new Set()).add(nm);
  });
  const rMonths = Object.keys(richnessMap).sort();
  const richnessCounts = rMonths.map((m) =>
    richnessMap[m] ? richnessMap[m].size : 0
  );

  // NEW: classs per month (stacked)
  const monthClass = {}; // month -> class -> count
  const classSet = new Set();
  rows.forEach((r) => {
    const d = parseDateFromStrings(r.eventDateStr, r.occurrenceYearStr);
    if (!d) return;
    const m = d.toISOString().slice(0, 7);
    const c = (r.classs || "(unknown)").trim();
    classSet.add(c);
    monthClass[m] = monthClass[m] || {};
    monthClass[m][c] = (monthClass[m][c] || 0) + 1;
  });
  const mcMonths = Object.keys(monthClass).sort();
  const mcClasses = Array.from(classSet).sort((a, b) => a.localeCompare(b));
  const mcDatasets = mcClasses.map((c) => ({
    label: c,
    data: mcMonths.map((m) => monthClass[m][c] || 0),
    stack: "stack1",
  }));
  const mk = (ctx, type, labels, data) =>
    new Chart(ctx, {
      type,
      data: { labels, datasets: [{ label: "Count", data }] },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cfe4d6" } },
          y: { ticks: { color: "#cfe4d6" } },
        },
      },
    });
  destroyCharts();
  state.charts.months = mk($("#chartMonths"), "line", months, monthCounts);
  state.charts.species = mk(
    $("#chartSpecies"),
    "bar",
    spTop.map((x) => x.k),
    spTop.map((x) => x.v)
  );
  state.charts.classs = mk($("#chartClass"), "bar", clLabels, clCounts);
  state.charts.basis = new Chart($("#chartBasis"), {
    type: "pie",
    data: { labels: bsLabels, datasets: [{ data: bsCounts }] },
    options: { responsive: true, maintainAspectRatio: false },
  });
  state.charts.providers = mk(
    $("#chartProviders"),
    "bar",
    pvTop.map((x) => x.k),
    pvTop.map((x) => x.v)
  );
  state.charts.richness = mk(
    $("#chartRichness"),
    "line",
    rMonths,
    richnessCounts
  );
  state.charts.classMonthly = new Chart($("#chartClassMonthly"), {
    type: "bar",
    data: { labels: mcMonths, datasets: mcDatasets },
    options: {
      responsive: true,
       maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { stacked: true, ticks: { color: "#cfe4d6" } },
        y: { stacked: true, ticks: { color: "#cfe4d6" } },
      },
    },
  });

  // Render or hide data tables under each chart
  renderTable(
    "#tableMonths",
    ["Month", "Count"],
    months.map((m, i) => [m, String(monthCounts[i])])
  );
  renderTable(
    "#tableSpecies",
    ["Species", "Count"],
    spTop.map((x) => [x.k, String(x.v)])
  );
  renderTable(
    "#tableClass",
    ["Class", "Count"],
    clLabels.map((c, i) => [c, String(clCounts[i])])
  );
  renderTable(
    "#tableBasis",
    ["Basis of record", "Count"],
    bsLabels.map((b, i) => [b, String(bsCounts[i])])
  );
  renderTable(
    "#tableProviders",
    ["Provider", "Count"],
    pvTop.map((x) => [x.k, String(x.v)])
  );
  renderTable(
    "#tableRichness",
    ["Month", "Distinct species"],
    rMonths.map((m, i) => [m, String(richnessCounts[i])])
  );
  // class/month wide table for stacked chart
  const classMonthlyRows = mcMonths.map((m, ri) => [
    m,
    ...mcClasses.map((c) => String(monthClass[m][c] || 0)),
  ]);
  renderTable("#tableClassMonthly", ["Month", ...mcClasses], classMonthlyRows);
  setTablesVisible(state.showTables);
  resizeAllCharts();   
}

function setTablesVisible(show) {
  $$(".data-table").forEach((div) => {
    div.hidden = !show;
  });
  $("#btnToggleTables").textContent = show
    ? "Hide data tables"
    : "Show data tables";
}

function resizeAllCharts() {
  // Resize after layout settles
  setTimeout(() => {
    Object.values(state.charts).forEach((c) => {
      try {
        c.resize();
      } catch (_) {}
    });
  }, 0);
}

/* ====== BoCC JSON ====== */
async function loadBoccJson() {
  const res = await fetch("./bocc.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load bocc.json (${res.status})`);
  const j = await res.json();
  const listToSpecies = {};
  const speciesToList = {};
  const lists = [];
  (j.lists || []).forEach((entry) => {
    const L = entry.list;
    lists.push(L);
    listToSpecies[L] = (entry.species || []).map((s) => ({
      name: s.name,
      annotation: s.annotation || "",
    }));
    (entry.species || []).forEach((s) => {
      if (s?.name) {
        speciesToList[s.name.trim().toLowerCase()] = L;
      }
    });
  });
  state.bocc = { listToSpecies, speciesToList, lists };
}

/* ====== BoCC Analysis & Reference ====== */
function buildBoccReference() {
  const host = $("#boccRefTable");
  host.innerHTML = "";
  if (!state.bocc) {
    host.innerHTML = '<div class="muted">BoCC reference not loaded.</div>';
    return;
  }
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>List</th><th>Species</th><th>Annotation</th></tr>";
  table.appendChild(thead);
  const tb = document.createElement("tbody");
  (state.bocc.lists || []).forEach((L) => {
    (state.bocc.listToSpecies[L] || []).forEach((s) => {
      const tr = document.createElement("tr");
      const tdL = document.createElement("td");
      tdL.textContent = L;
      const tdS = document.createElement("td");
      tdS.textContent = s.name;
      const tdA = document.createElement("td");
      tdA.textContent = s.annotation || "";
      tr.append(tdL, tdS, tdA);
      tb.appendChild(tr);
    });
  });
  table.appendChild(tb);
  host.appendChild(table);
}

function buildBoccAnalysis() {
  const redHost = $("#boccRed .tbl");
  const amberHost = $("#boccAmber .tbl");
  const formHost = $("#boccFormer .tbl");
  const byClassHost = $("#boccByClass .tbl");
  redHost.innerHTML =
    amberHost.innerHTML =
    formHost.innerHTML =
    byClassHost.innerHTML =
      "";

  if (!state.bocc) {
    byClassHost.innerHTML =
      '<div class="muted">BoCC reference not loaded.</div>';
    return;
  }

  // Occurrence counts per species (case-insensitive match to either vernacular or scientific)
  const occCount = Object.create(null); // lowerName -> count
  const classCountsByList = {}; // List -> class -> count
  const speciesLowerToCanonical = Object.create(null);

  state.rows.forEach((r) => {
    const names = [r.vernacularName, r.scientificName]
      .filter(Boolean)
      .map((s) => s.trim());
    const cls = (r.classs || "(unknown)").trim();
    names.forEach((n) => {
      const key = n.toLowerCase();
      speciesLowerToCanonical[key] = speciesLowerToCanonical[key] || n;
      const list = state.bocc.speciesToList[key];
      if (!list) return;
      occCount[key] = (occCount[key] || 0) + 1;
      classCountsByList[list] = classCountsByList[list] || {};
      classCountsByList[list][cls] = (classCountsByList[list][cls] || 0) + 1;
    });
  });

  // Helper to render a species table for a given list
  function renderSpeciesTable(listName, host) {
    const spec = state.bocc.listToSpecies[listName] || [];
    const rows = spec
      .map((s) => {
        const key = s.name.toLowerCase();
        const count = occCount[key] || 0;
        return { name: s.name, annotation: s.annotation || "", count };
      })
      .filter((r) => r.count > 0) // show only matched species
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    renderTableEl(
      host,
      ["Species", "Annotation", "Occurrences"],
      rows.map((r) => [r.name, r.annotation, String(r.count)])
    );
  }
  renderSpeciesTable("Red", redHost);
  renderSpeciesTable("Amber", amberHost);
  renderSpeciesTable("Former breeding", formHost);

  // Classs breakdown table (lists as rows, classes as columns)
  const lists = ["Red", "Amber", "Former breeding"].filter((L) =>
    state.bocc.lists.includes(L)
  );
  const classSet = new Set();
  lists.forEach((L) => {
    const cc = classCountsByList[L] || {};
    Object.keys(cc).forEach((k) => classSet.add(k));
  });
  const classes = Array.from(classSet).sort((a, b) => a.localeCompare(b));
  const body = lists.map((L) => {
    const cc = classCountsByList[L] || {};
    const total = classes.reduce((a, c) => a + (cc[c] || 0), 0);
    return [L, String(total), ...classes.map((c) => String(cc[c] || 0))];
  });
  renderTableEl(byClassHost, ["List", "Total", ...classes], body);

  function renderTableEl(hostDiv, headers, rows) {
    const tbl = document.createElement("table");
    const thead = document.createElement("thead");
    thead.appendChild(tr(headers, true));
    const tbody = document.createElement("tbody");
    if (!rows.length) {
      const td = document.createElement("td");
      td.colSpan = headers.length;
      td.textContent = "(no matches)";
      const trr = document.createElement("tr");
      trr.appendChild(td);
      tbody.appendChild(trr);
    } else {
      rows.forEach((r) => tbody.appendChild(tr(r, false)));
    }
    tbl.append(thead, tbody);
    hostDiv.appendChild(tbl);

    function tr(arr, head) {
      const row = document.createElement("tr");
      arr.forEach((cell) => {
        const el = document.createElement(head ? "th" : "td");
        el.textContent = cell;
        row.appendChild(el);
      });
      return row;
    }
  }
}

/* ====== Map (Leaflet) ====== */
function ensureMap() {
  if (state.map) return;
  const m = L.map("mapCanvas", { preferCanvas: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(m);
  const cluster = L.markerClusterGroup({ chunkedLoading: true });
  m.addLayer(cluster);
  state.map = m;
  state.cluster = cluster;
  m.setView([54.5, -3], 5); // UK default
}

function renderMap() {
  ensureMap();
  const maxPoints = Math.min(
    Math.max(Number($("#maxPoints").value) || 5000, 100),
    20000
  );
  const pts = [];
  for (let i = 0; i < state.rows.length && pts.length < maxPoints; i++) {
    const r = state.rows[i];
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
    if (r.lat < -90 || r.lat > 90 || r.lon < -180 || r.lon > 180) continue;
    pts.push({
      lat: r.lat,
      lon: r.lon,
      name: r.vernacularName || r.scientificName || "(unknown)",
      sci: r.scientificName || "",
      cls: r.classs || "(unknown)",
      date: r.eventDateStr || "",
      provider: r.provider || "",
    });
  }
  state.cluster.clearLayers();
  if (!pts.length) return;
  const markers = [],
    bounds = [];
  pts.forEach((p) => {
    const m = L.marker([p.lat, p.lon]);
    m.bindPopup(
      `<strong>${escapeHtml(p.name)}</strong>` +
        (p.sci ? `<div><em>${escapeHtml(p.sci)}</em></div>` : "") +
        `<div>Class: ${escapeHtml(p.cls)}</div>` +
        `<div>Date: ${escapeHtml(p.date)}</div>` +
        `<div>Provider: ${escapeHtml(p.provider)}</div>`
    );
    markers.push(m);
    bounds.push([p.lat, p.lon]);
  });
  state.cluster.addLayers(markers);
  try {
    state.map.fitBounds(bounds, { padding: [20, 20] });
  } catch (e) {}
}

/* ====== Rebuild ====== */
function rebuildAll() {
  if (state.rows.length) {
    buildOverview();
    if (state.bocc) {
      buildBoccAnalysis();
      buildBoccReference();
    }
  } else {
    // Clear Overview tables if no data
    [
      "#tableMonths",
      "#tableSpecies",
      "#tableClass",
      "#tableBasis",
      "#tableProviders",
      "#tableRichness",
      "#tableClassMonthly",
    ].forEach((sel) => {
      const el = $(sel);
      if (el) el.innerHTML = "";
    });
  }
}

/* ====== Event wiring ====== */
function wireControls() {
  $("#btnFetch").addEventListener("click", async () => {
    const url = $("#apiUrl").value.trim();
    if (!url) {
      $("#status").textContent = "Please enter an API URL.";
      return;
    }
    $("#btnFetch").disabled = true;
    $("#btnCancel").disabled = true;
    $("#status").textContent = "Starting…";
    try {
      const occ = await fetchAll(
        url,
        (msg) => ($("#status").textContent = msg)
      );
      state.rows = mapRows(occ);

      // NEW: record and show source + time
      state.sourceUrl = $("#apiUrl").value.trim();
      state.lastFetchedIso = new Date().toISOString();
      updateInfoBanners();
      $(
        "#status"
      ).textContent = `Loaded ${state.rows.length} rows. Open Overview/BoCC/Map.`;
      rebuildAll();
      showTab("overview");
    } catch (e) {
      if (e.name === "AbortError") {
        $("#status").textContent = "Cancelled.";
      } else {
        $("#status").textContent = `Error: ${e.message || e}`;
      }
    } finally {
      $("#btnFetch").disabled = false;
      $("#btnCancel").disabled = false;
    }
  });
  $("#btnCancel").addEventListener("click", cancelFetch);
  $("#btnRenderMap").addEventListener("click", renderMap);

  // Toggle data tables for Overview charts
  $("#btnToggleTables").addEventListener("click", () => {
    state.showTables = !state.showTables;
    setTablesVisible(state.showTables);
  });
}

// ---- Post height to parent (Wix) so the iframe can auto-resize ----
(function initAutoHeightMessaging(){
  const post = () => {
    // total document height
    const h = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0
    );
    // Tell any parent listening (Wix) our height
    window.parent?.postMessage({ type: 'APP_HEIGHT', height: h }, '*');
  };

  // Post on load and after layout changes
  window.addEventListener('load', post);
  // Observe body size changes (charts/tables/map)
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => post());
    ro.observe(document.body);
  }
  // Also post on navigation/tab changes & window resizes
  window.addEventListener('resize', () => setTimeout(post, 0));

  // Expose a manual trigger if parent asks
  window.addEventListener('message', (ev) => {
    if (ev?.data?.type === 'REQUEST_HEIGHT') post();
  });
})();





/* ====== Init ====== */
(async function init() {
  wireTabs();
  wireControls();
  showTab("home");
  try {
    await loadBoccJson();
    buildBoccReference(); // show reference even before fetching results
  } catch (e) {
    console.warn("BoCC JSON load failed:", e);
    $(
      "#boccRefTable"
    ).innerHTML = `<div class="muted">Failed to load bocc.json (${escapeHtml(
      e.message || String(e)
    )}).</div>`;
  }
  updateInfoBanners(); // shows “–” until first fetch
})();

