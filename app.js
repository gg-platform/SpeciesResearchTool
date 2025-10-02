/* ====== Utilities ===== */
function googleLinkEl(text){
  const a = document.createElement('a');
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.href = 'https://www.google.com/search?q=' + encodeURIComponent(text);
  a.textContent = text;
  return a;
}

// Normalise species strings for matching
function normName(s){
  return String(s || "")
    .normalize("NFKD")          // strip accents
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g, " ")       // collapse spaces
    .trim()
    .toLowerCase();
}

function licenseInfo(code) {
  const c = String(code || "").toUpperCase().trim();
  switch (c) {
    case "CC0":
      return {
        code: "CC0",
        label: "CC0 (Public Domain)",
        href: "https://creativecommons.org/publicdomain/zero/1.0/",
        requiresAttribution: false,
        note: "Attribution appreciated but not required.",
      };
    case "CC-BY":
      return {
        code: "CC-BY",
        label: "CC-BY 4.0",
        href: "https://creativecommons.org/licenses/by/4.0/",
        requiresAttribution: true,
        note: "Attribution required.",
      };
    case "CC-BY-NC":
      return {
        code: "CC-BY-NC",
        label: "CC-BY-NC 4.0",
        href: "https://creativecommons.org/licenses/by-nc/4.0/",
        requiresAttribution: true,
        note: "Non-commercial use only; attribution required.",
      };
    case "OGL":
      return {
        code: "OGL",
        label: "OGL v3.0",
        href: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        requiresAttribution: true,
        note: "Attribution required.",
      };
    default:
      return {
        code: c || "Unknown",
        label: c || "Unknown licence",
        href: "#",
        requiresAttribution: true,
        note: "",
      };
  }
}

function renderAttribution(hostSel) {
  const host = document.querySelector(hostSel);
  if (!host) return;

  host.innerHTML = "";

  // Aggregate unique tuples (provider + dataset + licence)
  const key = (p, r, l) =>
    [p || "(unknown provider)", r || "(unknown dataset)", (l || "").toUpperCase()].join("||");
  const seen = new Map();

  state.rows.forEach((r) => {
    const k = key(r.provider, r.dataResourceName, r.license);
    if (!seen.has(k)) {
      seen.set(k, {
        provider: r.provider || "(unknown provider)",
        dataset: r.dataResourceName || "(unknown dataset)",
        license: (r.license || "").toUpperCase(),
      });
    }
  });

  if (!seen.size) {
    host.innerHTML = `<div class="muted">No attribution available (no results yet).</div>`;
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "attr-list";

  Array.from(seen.values())
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.dataset.localeCompare(b.dataset))
    .forEach(({ provider, dataset, license }) => {
      const li = document.createElement("li");
      const lic = licenseInfo(license);

      // Phrase attribution depending on licence
      // CC0: optional credit, others: required credit
      const creditPrefix =
        lic.code === "CC0"
          ? "Uses data"
          : "Contains data ©";

      const creditBody =
        lic.code === "CC0"
          ? `${escapeHtml(provider)} — <em>${escapeHtml(dataset)}</em>`
          : `${escapeHtml(provider)}, from <em>${escapeHtml(dataset)}</em>`;

      const licHtml =
        lic.href && lic.href !== "#"
          ? `<a href="${lic.href}" target="_blank" rel="noopener">${escapeHtml(lic.label)}</a>`
          : escapeHtml(lic.label);

      li.innerHTML = `${creditPrefix} ${creditBody}, licensed under ${licHtml}. <span class="muted">${escapeHtml(
        lic.note
      )}</span>`;
      ul.appendChild(li);
    });

  const note = document.createElement("div");
  note.className = "muted";
  note.style.marginTop = "0.5rem";
  note.textContent =
    "Licences and terms are set by NBN Atlas Data Partners; respect dataset-specific restrictions (e.g., CC-BY-NC is non-commercial).";

  host.appendChild(ul);
  host.appendChild(note);
}



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
    : "-";

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
        a.textContent = "-";
        a.removeAttribute("href");
        a.removeAttribute("title");
      }
    }
    if (t) t.textContent = timeStr;
  });
}


 /* ====== Modal helpers ====== */
function openModalWithRows(title, rows) {
  const modal = $("#modal");
  const host  = $("#modalTableHost");
  $("#modalTitle").textContent = title;
  host.innerHTML = "";

  // Build table
  const tbl = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Name</th><th>Date</th><th>Provider</th><th>Dataset</th><th>Record</th></tr>";
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.textContent = "(no matching records)";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach(r => {
      const tr = document.createElement("tr");

      const nm = (r.vernacularName || r.scientificName || "(unknown)").trim();

      const tdName = document.createElement("td");
      tdName.appendChild(googleLinkEl(nm));

      const tdDate = document.createElement("td");
      tdDate.textContent = r.eventDateStr || r.occurrenceYearStr || "";

      const tdProv = document.createElement("td");
      tdProv.textContent = r.provider || "";

      const tdDs = document.createElement("td");
      tdDs.textContent = r.dataResourceName || "";

      const tdRec = document.createElement("td");
      if (r.uuid) {
        const a = document.createElement("a");
        a.href = `https://records.nbnatlas.org/occurrences/${encodeURIComponent(r.uuid)}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Open";
        tdRec.appendChild(a);
      } else {
        tdRec.innerHTML = `<span class="muted">no uuid</span>`;
      }

      tr.append(tdName, tdDate, tdProv, tdDs, tdRec);
      tbody.appendChild(tr);
    });
  }

  tbl.appendChild(tbody);
  host.appendChild(tbl);

  modal.setAttribute("aria-hidden", "false");
  // focus close
  setTimeout(() => $("#modalClose")?.focus(), 0);
}

function closeModal() {
  $("#modal")?.setAttribute("aria-hidden", "true");
}

(function wireModal() {
  $("#modalClose")?.addEventListener("click", closeModal);
  $("#modal")?.addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();


/* ====== Filters used by chart clicks ====== */
// monthStr format: "YYYY-MM"
function filterByMonth(monthStr) {
  const out = [];
  state.rows.forEach(r => {
    const d = parseDateFromStrings(r.eventDateStr, r.occurrenceYearStr);
    if (!d) return;
    if (d.toISOString().slice(0,7) === monthStr) out.push(r);
  });
  return out;
}
function filterBySpecies(name) {
  const target = normName(name);
  return state.rows.filter(r =>
    normName(r.vernacularName || "") === target || normName(r.scientificName || "") === target
  );
}
function filterByClass(cls) {
  const t = (cls || "").trim().toLowerCase();
  return state.rows.filter(r => (r.classs || "").trim().toLowerCase() === t);
}
function filterByBasis(basis) {
  const t = (basis || "").trim().toLowerCase();
  return state.rows.filter(r => (r.basisOfRecord || "").trim().toLowerCase() === t);
}
function filterByProvider(provider) {
  const t = (provider || "").trim().toLowerCase();
  return state.rows.filter(r => (r.provider || "").trim().toLowerCase() === t);
}
function filterByMonthAndClass(monthStr, cls) {
  const t = (cls || "").trim().toLowerCase();
  const out = [];
  state.rows.forEach(r => {
    const d = parseDateFromStrings(r.eventDateStr, r.occurrenceYearStr);
    if (!d) return;
    if (d.toISOString().slice(0,7) !== monthStr) return;
    if ((r.classs || "").trim().toLowerCase() !== t) return;
    out.push(r);
  });
  return out;
}

function attachChartClick(chart, getTitleAndRowsForClick) {
  const canvas = chart?.canvas;
  if (!canvas) return;
  canvas.style.cursor = "pointer";
  canvas.addEventListener("click", (evt) => {
    const points = chart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
    if (!points.length) return;
    const el = points[0];
    const dsIndex = el.datasetIndex;
    const i = el.index;
    const { title, rows } = getTitleAndRowsForClick({ chart, dsIndex, index: i }) || {};
    if (rows) openModalWithRows(title || "Results", rows);
  });
}

(function ensureModalWrapper(){
  const dlg = document.querySelector('.sr-dialog');
  const bd  = document.querySelector('.sr-backdrop');
  const wrap = document.getElementById('modal');
  if (dlg && bd && !wrap) {
    const w = document.createElement('div');
    w.id = 'modal';
    w.setAttribute('aria-hidden','true');
    w.setAttribute('role','dialog');
    w.setAttribute('aria-modal','true');
    bd.parentNode.insertBefore(w, bd);
    w.appendChild(bd);
    w.appendChild(dlg);
    document.body.appendChild(w);
  }
})();


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

  if (id === "map") {
    ensureMap();
    setTimeout(() => {
      try { state.map.invalidateSize(); } catch (e) {}
      // NEW: auto-render when entering the map tab if we have rows
      if (state.rows.length) renderMap();
    }, 0);
  }

  if (id === "overview") {
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
      maxPages = 400,
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
      if (pages > maxPages) throw new Error(`Safety cap reached (${maxPages} pages)`);
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
    uuid: o.uuid || "",                       
    occurrenceID: o.occurrenceID || "", 
    vernacularName: o.vernacularName || "",
    scientificName: o.scientificName || "",
    classs: o.classs || "",
    basisOfRecord: o.basisOfRecord || "",
    provider: o.dataProviderName || "",
    dataResourceName: o.dataResourceName || "",
    license: (o.license || "").toUpperCase(),   // e.g. CC-BY, CC-BY-NC
    eventDateStr: toDateString(o.eventDate),
    occurrenceYearStr: toDateString(o.occurrenceYear),
    lat: Number(o.decimalLatitude),
    lon: Number(o.decimalLongitude),
  }));
}

// If user is currently on the Map tab, render right away
const current = $$(".tab").find(t => t.classList.contains("active"))?.dataset.target;
if (current === "map") {
  ensureMap();
  renderMap();
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
function renderTable(hostSel, headers, rows, linkColsByName = []) {
  const host = $(hostSel);
  host.innerHTML = "";

  // Map header names -> indexes for linkifying
  const linkIdx = new Set(
    linkColsByName
      .map(name => headers.findIndex(h => String(h).toLowerCase() === String(name).toLowerCase()))
      .filter(i => i >= 0)
  );

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
    arr.forEach((cell, idx) => {
      const el = document.createElement(head ? "th" : "td");
      if (!head && linkIdx.has(idx) && cell) {
        el.appendChild(googleLinkEl(String(cell)));
      } else {
        el.textContent = cell;
      }
      row.appendChild(el);
    });
    return row;
  }
}

function renderProviderRecordTables(hostSel) {
  const host = document.querySelector(hostSel);
  if (!host) return;
  host.innerHTML = "";

  if (!state.rows.length) {
    host.innerHTML = `<div class="muted">(no data)</div>`;
    return;
  }

  // -------- Group by provider --------
  const byProvider = new Map();
  state.rows.forEach((r) => {
    const prov = (r.provider || "(unknown provider)").trim();
    if (!byProvider.has(prov)) byProvider.set(prov, []);
    byProvider.get(prov).push(r);
  });

  const providers = Array.from(byProvider.keys()).sort((a, b) => a.localeCompare(b));

  providers.forEach((prov) => {
    const rows = byProvider.get(prov) || [];

    // Distinct (dataset, licence) for this provider (mini summary under summary)
    const dsLic = new Map();
    rows.forEach((r) => {
      const k = `${r.dataResourceName || "(unknown dataset)"}||${r.license || ""}`;
      if (!dsLic.has(k)) dsLic.set(k, { dataset: r.dataResourceName || "(unknown dataset)", license: r.license || "" });
    });

    const wrap = document.createElement("details");
    wrap.open = providers.length <= 3;

    const summary = document.createElement("summary");
    summary.innerHTML = `${escapeHtml(prov)} <span class="muted">(${rows.length} records)</span>`;
    wrap.appendChild(summary);

    // Per-provider dataset/licence bullets
    const ul = document.createElement("ul");
    ul.className = "muted";
    dsLic.forEach(({ dataset, license }) => {
      const li = document.createElement("li");
      const lic = licenseInfo(license);
      li.innerHTML =
        `<em>${escapeHtml(dataset)}</em> — ` +
        (lic.href && lic.href !== "#"
          ? `<a target="_blank" rel="noopener" href="${lic.href}">${escapeHtml(lic.label)}</a>`
          : escapeHtml(lic.label));
      ul.appendChild(li);
    });
    wrap.appendChild(ul);

    // Records table
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Species</th><th>Scientific</th><th>Date</th><th>Dataset</th><th>Licence</th><th>Record</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");

      const nm = (r.vernacularName || r.scientificName || "(unknown)").trim();

      const tdSpecies = document.createElement("td");
      tdSpecies.appendChild(googleLinkEl(nm));

      const tdSci = document.createElement("td");
      tdSci.textContent = r.scientificName || "";

      const tdDate = document.createElement("td");
      tdDate.textContent = r.eventDateStr || r.occurrenceYearStr || "";

      const tdDataset = document.createElement("td");
      tdDataset.textContent = r.dataResourceName || "";

      const tdLicence = document.createElement("td");
      const lic = licenseInfo(r.license);
      if (lic.href && lic.href !== "#") {
        const a = document.createElement("a");
        a.href = lic.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = lic.label;
        tdLicence.appendChild(a);
      } else {
        tdLicence.textContent = lic.label;
      }

      const tdLink = document.createElement("td");
      if (r.uuid) {
        const a = document.createElement("a");
        a.href = `https://records.nbnatlas.org/occurrences/${encodeURIComponent(r.uuid)}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "View record";
        tdLink.appendChild(a);
      } else {
        tdLink.innerHTML = `<span class="muted">no uuid</span>`;
      }

      tr.append(tdSpecies, tdSci, tdDate, tdDataset, tdLicence, tdLink);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    host.appendChild(wrap);
  });

  // -------- DISTINCT DATASETS + LICENCES SUMMARY (bottom of section) --------
  const distinct = new Map(); // key = dataset||lic
  state.rows.forEach((r) => {
    const dataset = r.dataResourceName || "(unknown dataset)";
    const license = (r.license || "").toUpperCase();
    const prov = (r.provider || "(unknown provider)").trim();
    const k = `${dataset}||${license}`;
    if (!distinct.has(k)) {
      distinct.set(k, { dataset, license, providers: new Set(), records: 0 });
    }
    const entry = distinct.get(k);
    entry.providers.add(prov);
    entry.records += 1;
  });

  const summaryWrap = document.createElement("div");
  summaryWrap.className = "dataset-summary";
  summaryWrap.style.marginTop = "1rem";

  const h3 = document.createElement("h3");
  h3.textContent = "Datasets & licences (distinct)";
  summaryWrap.appendChild(h3);

  const tbl = document.createElement("table");
  const th = document.createElement("thead");
  th.innerHTML = "<tr><th>Dataset</th><th>Licence</th><th>Providers</th><th>Records</th></tr>";
  tbl.appendChild(th);

  const tb = document.createElement("tbody");
  Array.from(distinct.values())
    .sort((a, b) => a.dataset.localeCompare(b.dataset) || a.license.localeCompare(b.license))
    .forEach(({ dataset, license, providers, records }) => {
      const tr = document.createElement("tr");

      const tdD = document.createElement("td");
      tdD.textContent = dataset;

      const tdL = document.createElement("td");
      const lic = licenseInfo(license);
      if (lic.href && lic.href !== "#") {
        const a = document.createElement("a");
        a.href = lic.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = lic.label;
        tdL.appendChild(a);
      } else {
        tdL.textContent = lic.label;
      }

      const tdP = document.createElement("td");
      tdP.textContent = String(providers.size);

      const tdR = document.createElement("td");
      tdR.textContent = String(records);

      tr.append(tdD, tdL, tdP, tdR);
      tb.appendChild(tr);
    });

  tbl.appendChild(tb);
  summaryWrap.appendChild(tbl);
  host.appendChild(summaryWrap);
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

  // species richness by month
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

  // classs per month (stacked)
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
    // Months (line)
  state.charts.months = mk($("#chartMonths"), "line", months, monthCounts);
  attachChartClick(state.charts.months, ({ index }) => {
    const monthStr = months[index];
    return { title: `Records in ${monthStr}`, rows: filterByMonth(monthStr) };
  });

  // Species (bar)
  state.charts.species = mk($("#chartSpecies"), "bar", spTop.map(x=>x.k), spTop.map(x=>x.v));
  attachChartClick(state.charts.species, ({ index }) => {
    const name = spTop[index]?.k;
    return { title: `Records for ${name}`, rows: filterBySpecies(name) };
  });

  // Class (bar)
  state.charts.classs = mk($("#chartClass"), "bar", clLabels, clCounts);
  attachChartClick(state.charts.classs, ({ index }) => {
    const cls = clLabels[index];
    return { title: `Records in class: ${cls}`, rows: filterByClass(cls) };
  });

  // Basis (pie)
  state.charts.basis = new Chart($("#chartBasis"), {
    type: "pie",
    data: { labels: bsLabels, datasets: [{ data: bsCounts }] },
    options: { responsive: true, maintainAspectRatio: false },
  });
  attachChartClick(state.charts.basis, ({ index }) => {
    const label = bsLabels[index];
    return { title: `Records with basis: ${label}`, rows: filterByBasis(label) };
  });

  // Providers (bar)
  state.charts.providers = mk($("#chartProviders"), "bar", pvTop.map(x=>x.k), pvTop.map(x=>x.v));
  attachChartClick(state.charts.providers, ({ index }) => {
    const prov = pvTop[index]?.k;
    return { title: `Records from provider: ${prov}`, rows: filterByProvider(prov) };
  });

  // Richness (line) -> click shows month’s records
  state.charts.richness = mk($("#chartRichness"), "line", rMonths, richnessCounts);
  attachChartClick(state.charts.richness, ({ index }) => {
    const monthStr = rMonths[index];
    return { title: `Records in ${monthStr}`, rows: filterByMonth(monthStr) };
  });

  // Class per month (stacked bar) – need both the month and the class from dataset label
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
  // Click handler for stacked bars
  attachChartClick(state.charts.classMonthly, ({ dsIndex, index }) => {
    const monthStr = mcMonths[index];
    const cls = mcDatasets[dsIndex]?.label;
    return { title: `Records in ${monthStr} — ${cls}`, rows: filterByMonthAndClass(monthStr, cls) };
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
  spTop.map((x) => [x.k, String(x.v)]),
  ["Species"]  // <- linkify this column
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
  const speciesToList = {};        // normName(species) -> List
  const speciesLowerToName = {};   // normName(species) -> original display name
  const lists = [];

  (j.lists || []).forEach((entry) => {
    const L = entry.list;
    lists.push(L);
    listToSpecies[L] = (entry.species || []).map((s) => ({
      name: s.name,
      annotation: s.annotation || "",
    }));
    (entry.species || []).forEach((s) => {
      if (!s?.name) return;
      const key = normName(s.name);
      speciesToList[key] = L;
      speciesLowerToName[key] = s.name; // keep original spelling for display
    });
  });

  state.bocc = { listToSpecies, speciesToList, speciesLowerToName, lists };
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
      tdS.appendChild(googleLinkEl(s.name)); // <- hyperlink to Google

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
  const redHost      = $("#boccRed .tbl");
  const amberHost    = $("#boccAmber .tbl");
  const formerHost   = $("#boccFormer .tbl");
  // const byClassHost  = $("#boccByClass .tbl");
  const distinctHost = $("#boccDistinct .tbl");

  [redHost, amberHost, formerHost, distinctHost].forEach(h => { if (h) h.innerHTML = ""; });

  if (!state.bocc) {
    // if (byClassHost)   byClassHost.innerHTML   = '<div class="muted">BoCC reference not loaded.</div>';
    if (distinctHost)  distinctHost.innerHTML  = '<div class="muted">BoCC reference not loaded.</div>';
    return;
  }

  // Totals
  const occCount = Object.create(null);   // normName(species) -> occurrence count
  const classOccByList = {};              // list -> class -> total occurrences
  const distinctByListClass = {};         // list -> class -> Set(canonical species names)

  const ensure = (obj, key, def) => (obj[key] ??= def);
  const safeClass = (c) => (c || "(unknown)").trim();

  state.rows.forEach(r => {
    const cls = safeClass(r.classs);
    const names = [r.vernacularName, r.scientificName].filter(Boolean).map(s => s.trim());
    names.forEach(n => {
      const key  = normName(n);                        // ✅ use normalized key
      const list = state.bocc.speciesToList[key];
      if (!list) return;

      occCount[key] = (occCount[key] || 0) + 1;

      ensure(classOccByList, list, {});
      classOccByList[list][cls] = (classOccByList[list][cls] || 0) + 1;

      ensure(distinctByListClass, list, {});
      ensure(distinctByListClass[list], cls, new Set()).add(n);
    });
  });

  const lists = ["Red", "Amber", "Former breeding"].filter(L => state.bocc.lists.includes(L));

  // Species tables + counts in H2
  function renderSpeciesTable(listName, host, headingSel) {
    const spec = state.bocc.listToSpecies[listName] || [];
    const rows = spec
      .map(s => {
        const key = normName(s.name);                  // ✅ normalized lookup
        const count = occCount[key] || 0;
        return { name: s.name, annotation: s.annotation || "", count };
      })
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    renderTableEl(
      host,
      ["Species", "Annotation", "Occurrences"],
      rows.map(r => [r.name, r.annotation, String(r.count)]),
      ["Species"]
    );

    const h2 = $(headingSel);
    if (h2) {
      const base = h2.textContent.replace(/\s*\(\d+\)\s*$/, "");
      h2.textContent = `${base} (${rows.length})`;
    }
  }

  renderSpeciesTable("Red",            redHost,    "#boccRed h2");
  renderSpeciesTable("Amber",          amberHost,  "#boccAmber h2");
  renderSpeciesTable("Former breeding",formerHost, "#boccFormer h2");

  // // Occurrences by classs
  // const classSetOcc = new Set();
  // lists.forEach(L => Object.keys(classOccByList[L] || {}).forEach(c => classSetOcc.add(c)));
  // const classColsOcc = Array.from(classSetOcc).sort((a,b)=>a.localeCompare(b));

  // const bodyOcc = lists.map(L => {
  //   const cc = classOccByList[L] || {};
  //   const total = classColsOcc.reduce((a,c)=> a + (cc[c] || 0), 0);
  //   return [L, String(total), ...classColsOcc.map(c => String(cc[c] || 0))];
  // });
  // renderTableEl(byClassHost, ["List", "Total", ...classColsOcc], bodyOcc);

  // Distinct species by classs (counts of unique species)
  const classSetDistinct = new Set();
  lists.forEach(L => Object.keys(distinctByListClass[L] || {}).forEach(c => classSetDistinct.add(c)));
  const classColsDistinct = Array.from(classSetDistinct).sort((a,b)=>a.localeCompare(b));

  const bodyDistinct = lists.map(L => {
    const rowObj = distinctByListClass[L] || {};
    const totalDistinct = classColsDistinct.reduce((a,c) => a + ((rowObj[c]?.size) || 0), 0);
    return [L, String(totalDistinct), ...classColsDistinct.map(c => String((rowObj[c]?.size) || 0))];
  });
  renderTableEl(distinctHost, ["List", "Distinct total", ...classColsDistinct], bodyDistinct);

  // table builder
  function renderTableEl(hostDiv, headers, rows, linkColsByName = []) {
    if (!hostDiv) return;
    const linkIdx = new Set(
      linkColsByName
        .map(name => headers.findIndex(h => String(h).toLowerCase() === String(name).toLowerCase()))
        .filter(i => i >= 0)
    );

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
      rows.forEach(r => tbody.appendChild(tr(r, false)));
    }

    tbl.append(thead, tbody);
    hostDiv.appendChild(tbl);

    function tr(arr, head) {
      const row = document.createElement("tr");
      arr.forEach((cell, idx) => {
        const el = document.createElement(head ? "th" : "td");
        if (!head && linkIdx.has(idx) && cell) {
          el.appendChild(googleLinkEl(String(cell)));
        } else {
          el.textContent = cell;
        }
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
  `<strong><a href="https://www.google.com/search?q=${encodeURIComponent(p.name)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.name)}</a></strong>` +
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
    renderProviderRecordTables("#tableProviderRecords");

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
      '#tableProviderRecords',
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
  updateInfoBanners(); // shows blank until first fetch
})();

