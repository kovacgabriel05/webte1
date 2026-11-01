// Main page script: loading, saving, filtering and rendering of the menus.
// Restaurants are described only in SOURCES. A new restaurant = one new object here + one parser in parsers.js.

const SOURCES = [
  {
    id: "eatandmeet",
    name: "Eat & Meet",
    address: "Staré Grunty 36 (internáty Mlyny), Bratislava",
    website: "https://eatandmeet.sk/tyzdenne-menu",
    localUrl: "data/eatandmeet.html",
    parse: parseEatAndMeet,
  },
  {
    id: "zlatybazant",
    name: "U Zlatého Bažanta",
    address: "Dunajská 4, Bratislava",
    website: "https://uzlatehobazanta.sk/denne-menu/",
    localUrl: "data/zlatybazant.html",
    parse: parseZlatyBazant,
  },
  {
    id: "cafedevin",
    name: "Café Devín",
    address: "Hotel Devín, Riečna 4, Bratislava",
    website: "https://www.cafedevin.sk/menu/denne-business-menu/",
    localUrl: "data/cafedevin.html",
    parse: parseCafeDevin,
  },
];

const STORAGE_KEY = "lunch-menu";
const HIDDEN_KEY = "lunch-menu-hidden";
const WEEK_VIEW = "week";

const statusText = document.getElementById("status");
const refreshButton = document.getElementById("refresh");
const clearButton = document.getElementById("clear");
const dayTabs = document.getElementById("day-tabs");
const filters = document.getElementById("filters");
const cards = document.getElementById("cards");
const menuTitle = document.getElementById("menu-title");
const weekendNote = document.getElementById("weekend-note");

// State. The page is always drawn from these values, never the other way round.
const results = {}; // id -> { state: "loading" | "ok" | "error" | "empty", days, updatedAt, fromStorage, error }
const hiddenSources = new Set(readJson(HIDDEN_KEY, []));
let selectedView = isWeekend() ? 0 : getTodayIndex(); // 0-4 = Monday-Friday, or WEEK_VIEW

// ---------------------------------------------------------------------------
// Loading and storage
// ---------------------------------------------------------------------------

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveDays(sourceId, days, savedAt) {
  const data = readJson(STORAGE_KEY, {});
  data[sourceId] = { savedAt: savedAt.toISOString(), days };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Saved data of one restaurant, but only if it was saved today.
function loadSavedDays(sourceId) {
  const entry = readJson(STORAGE_KEY, {})[sourceId];
  if (!entry) {
    return null;
  }
  const savedAt = new Date(entry.savedAt);
  if (savedAt.toDateString() !== new Date().toDateString()) {
    return null;
  }
  return { savedAt, days: entry.days };
}

// Downloads the local copy with the Fetch API and parses it with DOMParser + the restaurant's parser.
async function loadSource(source) {
  let response;
  try {
    response = await fetch(source.localUrl, { cache: "no-store" });
  } catch {
    // fetch throws only when the server cannot be reached at all
    throw new Error("stránka je nedostupná");
  }
  // 404 or 500 is a valid response for fetch, we have to check it ourselves
  if (!response.ok) {
    throw new Error(`stránka je nedostupná (HTTP ${response.status})`);
  }
  const html = await response.text();

  let days;
  try {
    days = source.parse(parseHtml(html));
  } catch (error) {
    console.error(`Parser ${source.name}:`, error);
    throw new Error("stránku sa nepodarilo spracovať, možno sa zmenila jej štruktúra");
  }
  if (days.length === 0) {
    throw new Error("na stránke sa nenašlo menu, možno sa zmenila jej štruktúra");
  }
  return days;
}

async function loadOne(source, forceRefresh = false) {
  const saved = forceRefresh ? null : loadSavedDays(source.id);
  if (saved) {
    results[source.id] = { state: "ok", days: saved.days, updatedAt: saved.savedAt, fromStorage: true };
    render();
    return;
  }

  const previous = results[source.id];
  results[source.id] = { state: "loading", updatedAt: previous?.updatedAt };
  render();
  try {
    const days = await loadSource(source);
    const now = new Date();
    results[source.id] = { state: "ok", days, updatedAt: now, fromStorage: false };
    saveDays(source.id, days, now);
  } catch (error) {
    console.error(`${source.name}:`, error);
    results[source.id] = { state: "error", error, updatedAt: previous?.updatedAt };
    throw error;
  } finally {
    render();
  }
}

async function loadAll(forceRefresh = false) {
  refreshButton.disabled = true;
  setStatus("Načítavam menu…", true);
  const outcomes = await Promise.allSettled(SOURCES.map((source) => loadOne(source, forceRefresh)));
  const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
  const fromStorage = SOURCES.filter((source) => results[source.id]?.fromStorage).length;

  let message = `Načítané ${SOURCES.length - failed} z ${SOURCES.length} reštaurácií.`;
  if (fromStorage === SOURCES.length) {
    message += " Použité sú dnes uložené dáta, na nové načítanie kliknite na Aktualizovať menu.";
  }
  setStatus(message, false);
  refreshButton.disabled = false;
}

// ---------------------------------------------------------------------------
// Rendering (only createElement + textContent, nothing from the source pages is inserted as HTML)
// ---------------------------------------------------------------------------

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function setStatus(text, loading) {
  statusText.replaceChildren();
  if (loading) {
    const spinner = element("span", "spinner-border spinner-border-sm me-2");
    spinner.setAttribute("aria-hidden", "true");
    statusText.append(spinner);
  }
  statusText.append(text);
}

function createTime(date) {
  const time = element("time", "", date.toLocaleString("sk-SK"));
  time.dateTime = date.toISOString();
  return time;
}

// soup / main: soups and main dishes look different, everything that is not a soup is shown as a main dish
function itemKind(item) {
  return item.type === "polievka" ? "soup" : "main";
}

function createPrice(item) {
  const box = element("div", "menu-item__price");
  if (item.price !== null) {
    box.append(element("strong", "price-tag", formatPrice(item.price)));
  } else {
    box.append(element("span", "price-tag price-tag--muted", item.priceNote || "cena neuvedená"));
  }
  if (item.priceStudent !== null) {
    box.append(element("span", "price-extra", `s ISIC ${formatPrice(item.priceStudent)}`));
  }
  if (item.price !== null && item.priceNote) {
    box.append(element("span", "price-extra", item.priceNote));
  }
  return box;
}

function createMenuItem(item) {
  const li = element("li", `menu-item menu-item--${itemKind(item)}`);

  const text = element("div", "menu-item__text");
  // "Polievka 1" already says it is a soup, "MENU 1" or "A" does not
  let typeText = item.type;
  if (item.label) {
    const labelRepeatsType = item.label.toLocaleLowerCase("sk").startsWith(item.type.slice(0, 5).toLocaleLowerCase("sk"));
    typeText = labelRepeatsType ? item.label : `${item.type} · ${item.label}`;
  }
  text.append(element("span", "menu-item__type", typeText));
  text.append(element("span", "menu-item__name", item.name));

  const details = [];
  if (item.weight) {
    details.push(item.weight);
  }
  if (item.allergens.length > 0) {
    details.push(`alergény: ${item.allergens.join(", ")}`);
  }
  if (details.length > 0) {
    text.append(element("span", "menu-item__meta", details.join(" · ")));
  }

  li.append(text, createPrice(item));
  return li;
}

function createDayMenu(days, dayName, showHeading) {
  const wrapper = element("div", "day-menu");
  const day = days.find((item) => item.day === dayName);

  if (showHeading) {
    const heading = element("h4", "day-menu__title", dayName);
    if (day?.date) {
      heading.append(" ", element("span", "day-menu__date", day.date));
    }
    wrapper.append(heading);
  } else if (day?.date) {
    wrapper.append(element("p", "day-menu__date mb-2", day.date));
  }

  if (!day || day.items.length === 0) {
    wrapper.append(element("p", "empty-day", "Menu na tento deň nie je k dispozícii."));
    return wrapper;
  }
  const list = element("ul", "menu-list");
  list.append(...day.items.map(createMenuItem));
  wrapper.append(list);
  return wrapper;
}

// Warns when the menu on the page comes from a different week (e.g. not yet updated by the restaurant).
function createStaleWarning(days) {
  const dates = days.map((day) => day.date).filter(Boolean);
  if (dates.length === 0 || dates.some((date) => isInRelevantWeek(date))) {
    return null;
  }
  return element(
    "p",
    "alert alert-warning small py-2 mb-3",
    `Menu na stránke reštaurácie je zrejme z iného týždňa (od ${dates[0]}). Reštaurácia ho ešte neaktualizovala.`
  );
}

function createCard(source) {
  const result = results[source.id] ?? { state: "empty" };

  const column = element("div", selectedView === WEEK_VIEW ? "col-12 col-lg-6 col-xxl-4" : "col-12 col-md-6 col-xl-4");
  const card = element("article", "card restaurant-card h-100");

  const header = element("header", "card-header restaurant-card__header");
  const titleRow = element("div", "d-flex justify-content-between align-items-start gap-2");
  const title = element("h3", "restaurant-card__name");
  const link = element("a", "", source.name);
  link.href = source.website;
  link.target = "_blank";
  link.rel = "noopener";
  title.append(link);
  titleRow.append(title);
  if (result.state === "loading") {
    const spinner = element("div", "spinner-border spinner-border-sm text-light flex-shrink-0");
    spinner.setAttribute("role", "status");
    spinner.append(element("span", "visually-hidden", "Načítava sa…"));
    titleRow.append(spinner);
  }
  header.append(titleRow, element("p", "restaurant-card__address", source.address));

  const body = element("div", "card-body");
  if (result.state === "loading") {
    body.append(element("p", "text-body-secondary mb-0", "Načítavam menu…"));
  } else if (result.state === "error") {
    body.append(element("p", "text-danger", `Menu sa nepodarilo načítať: ${result.error.message}.`));
    const retry = element("button", "btn btn-sm btn-outline-danger", "Skúsiť znova");
    retry.type = "button";
    retry.addEventListener("click", () => loadOne(source, true).catch(() => {}));
    body.append(retry);
  } else if (result.state === "empty") {
    body.append(element("p", "text-body-secondary mb-0", "Dáta nie sú načítané. Kliknite na Aktualizovať menu."));
  } else {
    const warning = createStaleWarning(result.days);
    if (warning) {
      body.append(warning);
    }
    if (selectedView === WEEK_VIEW) {
      body.append(...WORK_DAYS.map((dayName) => createDayMenu(result.days, dayName, true)));
    } else {
      body.append(createDayMenu(result.days, WORK_DAYS[selectedView], false));
    }
  }

  const footer = element("footer", "card-footer small text-body-secondary");
  if (result.updatedAt) {
    footer.append("Posledná aktualizácia: ", createTime(result.updatedAt));
    if (result.fromStorage) {
      footer.append(" (uložené dáta)");
    }
  } else {
    footer.append("Zatiaľ nenačítané");
  }

  card.append(header, body, footer);
  column.append(card);
  return column;
}

function renderTabs() {
  const views = [...WORK_DAYS.map((day, index) => ({ value: index, label: day })), { value: WEEK_VIEW, label: "Celý týždeň" }];
  dayTabs.replaceChildren(
    ...views.map((view) => {
      const li = element("li");
      const button = element("button", "day-tab", view.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(view.value === selectedView));
      if (view.value === getTodayIndex()) {
        button.append(element("span", "day-tab__today", "dnes"));
      }
      button.addEventListener("click", () => {
        selectedView = view.value;
        render();
      });
      li.append(button);
      return li;
    })
  );
}

function renderCards() {
  menuTitle.textContent = selectedView === WEEK_VIEW ? "Menu na celý týždeň" : `Menu – ${WORK_DAYS[selectedView]}`;
  const visible = SOURCES.filter((source) => !hiddenSources.has(source.id));
  if (visible.length === 0) {
    const empty = element("div", "col-12");
    empty.append(element("p", "alert alert-secondary", "Všetky reštaurácie sú skryté. Zapnite aspoň jednu vo filtri vyššie."));
    cards.replaceChildren(empty);
    return;
  }
  cards.replaceChildren(...visible.map(createCard));
}

function render() {
  renderTabs();
  renderCards();
}

function renderFilters() {
  for (const source of SOURCES) {
    const wrapper = element("div", "form-check form-check-inline");
    const checkbox = element("input", "form-check-input");
    checkbox.type = "checkbox";
    checkbox.id = `filter-${source.id}`;
    checkbox.checked = !hiddenSources.has(source.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        hiddenSources.delete(source.id);
      } else {
        hiddenSources.add(source.id);
      }
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenSources]));
      renderCards();
    });
    const label = element("label", "form-check-label", source.name);
    label.htmlFor = checkbox.id;
    wrapper.append(checkbox, label);
    filters.append(wrapper);
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

refreshButton.addEventListener("click", () => loadAll(true));

clearButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  for (const source of SOURCES) {
    results[source.id] = { state: "empty" };
  }
  render();
  setStatus("Uložené dáta sú vymazané. Na nové načítanie kliknite na Aktualizovať menu.", false);
});

weekendNote.hidden = !isWeekend();
renderFilters();
render();
loadAll();
