'use strict';

/* ==========================================================================
   Shared script for all pages. Each feature starts only on its own page
   (body[data-page]); the navigation runs everywhere.
   ========================================================================== */

/* ---------- Constants (edit data here) ---------- */

// Semester dates in ISO format (YYYY-MM-DD), both days are included.
const SEMESTER_START = '2026-09-14';
const SEMESTER_END = '2026-12-14';

const MAP_STORAGE_KEY = 'z1-kovac-map-points';

const SCHOOL = { id: 'school', name: 'FEI STU', lat: 48.1527, lng: 17.0733 };
const HOME = { id: 'home', name: 'Domov (približne)', lat: 48.2007, lng: 17.3019 };

// Hotspots on the workspace photo. The dot position is a percentage of the image size.
const HOTSPOTS = [
  {
    id: 'macbook',
    title: 'MacBook Pro (M4)',
    text: 'Môj hlavný pracovný nástroj. Používam ho aj mimo školy na úpravu fotiek a iné.',
    topic: 'Fotografovanie',
    x: 86.8, y: 49.5,
    placement: 'left'
  },
  {
    id: 'monitor',
    title: 'Monitor AOC 24", 144 Hz',
    text: 'Externý monitor mi dáva väčšie možnosti, keď potrebujem viac obrazoviek.',
    x: 46.1, y: 60.4,
    placement: 'bottom'
  },
  {
    id: 'keyboard',
    title: 'Mechanická klávesnica SPC Gear',
    text: 'Pri stole píšem na mechanickej klávesnici značky SPC Gear.',
    x: 33.6, y: 86.2,
    placement: 'right'
  },
  {
    id: 'mouse',
    title: 'Myš Eternico M500 Wireless',
    text: 'Bezdrôtová myš, ktorú používam pri práci s notebookom aj monitorom.',
    x: 77.9, y: 85.7,
    placement: 'left'
  },
  {
    id: 'clock',
    title: 'Budík TFA 60.2025.01',
    text: 'Digitálny budík na stole. Čas mám pri práci stále na očiach.',
    x: 7.9, y: 65.7,
    placement: 'right'
  }
];

/* ---------- Small helpers ---------- */

function parseLocalDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatShortDate(date) {
  return date.getDate() + '. ' + (date.getMonth() + 1) + '. ' + date.getFullYear();
}

function formatTime(time) {
  // "08:00" -> "8:00"
  return String(Number(time.split(':')[0])) + ':' + time.split(':')[1];
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

/* ---------- Navigation (hamburger menu on small screens) ---------- */

function initNavigation() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) {
    return;
  }

  const setOpen = (isOpen) => {
    nav.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ---------- Page 3: workspace hotspots (HTML is generated from HOTSPOTS) ---------- */

function renderHotspots() {
  const list = document.getElementById('hotspots');
  if (!list) {
    return;
  }

  HOTSPOTS.forEach((spot, index) => {
    const panelId = 'hotspot-panel-' + spot.id;

    const item = createElement('li', 'hotspot');
    item.dataset.placement = spot.placement;
    item.style.setProperty('--x', spot.x + '%');
    item.style.setProperty('--y', spot.y + '%');

    const trigger = createElement('button', 'hotspot__trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-describedby', panelId);

    const badge = createElement('span', 'hotspot__number', String(index + 1));
    badge.setAttribute('aria-hidden', 'true');
    const label = createElement('span', 'visually-hidden', spot.title);
    trigger.append(badge, label);

    const panel = createElement('div', 'hotspot__panel');
    panel.id = panelId;
    panel.append(
      createElement('h3', 'hotspot__panel-title', spot.title),
      createElement('p', 'hotspot__panel-text', spot.text)
    );
    if (spot.topic) {
      panel.append(createElement('p', 'hotspot__topic', 'Súvisí s: ' + spot.topic));
    }

    item.append(trigger, panel);
    list.append(item);
  });

  const stage = list.closest('.stage');
  if (stage) {
    stage.classList.add('stage--ready');
  }
}

/* ---------- Page 4: schedule ---------- */

const DAY_NAMES_AT = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
const TYPE_LABELS = { lecture: 'prednáška', exercise: 'cvičenie', pe: 'telesná výchova' };

function initSchedule() {
  const table = document.getElementById('schedule-table');
  if (!table) {
    return;
  }

  const lessons = Array.from(table.querySelectorAll('td[data-type]'));
  const status = document.getElementById('schedule-status');
  const wrap = document.getElementById('schedule-wrap');
  const emptyMessage = document.getElementById('schedule-empty');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));

  const lessonName = (cell) => cell.querySelector('.slot__title').textContent.replace(/\u00AD/g, '').trim();
  const lessonType = (cell) => TYPE_LABELS[cell.dataset.type];

  function applyFilter(filter) {
    let visibleCount = 0;
    lessons.forEach((cell) => {
      const isMatch = filter === 'all' || cell.dataset.type === filter;
      cell.classList.toggle('is-dimmed', !isMatch);
      if (isMatch) {
        visibleCount += 1;
      }
    });

    filterButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });

    const isEmpty = visibleCount === 0;
    wrap.hidden = isEmpty;
    emptyMessage.hidden = !isEmpty;
  }

  function isWithinSemester(now) {
    const start = parseLocalDate(SEMESTER_START);
    const end = parseLocalDate(SEMESTER_END);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  }

  function findNextLesson(now) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = (now.getDay() + offset) % 7;
      const candidates = lessons
        .filter((cell) => Number(cell.dataset.day) === day)
        .filter((cell) => offset > 0 || toMinutes(cell.dataset.start) > nowMinutes)
        .sort((a, b) => toMinutes(a.dataset.start) - toMinutes(b.dataset.start));
      if (candidates.length > 0) {
        return { cell: candidates[0], offset: offset, day: day };
      }
    }
    return null;
  }

  function describeNextLesson(now) {
    const next = findNextLesson(now);
    if (!next) {
      return 'V rozvrhu som nenašiel žiadnu ďalšiu hodinu.';
    }
    let when;
    if (next.offset === 0) {
      when = 'dnes';
    } else if (next.offset === 1) {
      when = 'zajtra';
    } else {
      when = DAY_NAMES_AT[next.day];
    }
    return 'Najbližšiu hodinu mám ' + when + ' o ' + formatTime(next.cell.dataset.start) +
      ': ' + lessonName(next.cell) + ' (' + lessonType(next.cell) + ').';
  }

  function updateCurrentLesson() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    lessons.forEach((cell) => {
      cell.classList.remove('is-current');
      cell.removeAttribute('aria-current');
    });

    status.replaceChildren();

    if (!isWithinSemester(now)) {
      const start = parseLocalDate(SEMESTER_START);
      const end = parseLocalDate(SEMESTER_END);
      const text = now < start
        ? 'Semester sa ešte nezačal, výučba začína ' + formatShortDate(start) + '.'
        : 'Semester sa skončil ' + formatShortDate(end) + ', momentálne nemám výučbu.';
      status.append(createElement('p', '', text));
      return;
    }

    const current = lessons.filter((cell) => {
      return Number(cell.dataset.day) === now.getDay() &&
        nowMinutes >= toMinutes(cell.dataset.start) &&
        nowMinutes <= toMinutes(cell.dataset.end);
    });

    if (current.length > 0) {
      current.forEach((cell) => {
        cell.classList.add('is-current');
        cell.setAttribute('aria-current', 'time');
      });
      const names = current
        .map((cell) => lessonName(cell) + ' (' + lessonType(cell) + ') do ' + formatTime(cell.dataset.end))
        .join(' a zároveň ');
      const paragraph = createElement('p');
      paragraph.append(createElement('strong', '', 'Práve prebieha: '), names + '.');
      status.append(paragraph);
      return;
    }

    const paragraph = createElement('p');
    paragraph.append(
      createElement('strong', '', 'Teraz nemám výučbu. '),
      describeNextLesson(now)
    );
    status.append(paragraph);
  }

  function updateSemesterProgress() {
    const bar = document.getElementById('semester-bar');
    const track = document.getElementById('semester-track');
    const label = document.getElementById('semester-label');
    if (!bar || !track || !label) {
      return;
    }

    const start = parseLocalDate(SEMESTER_START);
    const end = parseLocalDate(SEMESTER_END);
    end.setHours(23, 59, 59, 999);

    const ratio = (Date.now() - start.getTime()) / (end.getTime() - start.getTime());
    const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);

    bar.style.width = percent + '%';
    track.setAttribute('aria-valuenow', String(percent));
    label.textContent = 'Uplynulo ' + percent + ' % semestra (' +
      formatShortDate(start) + ' – ' + formatShortDate(end) + ').';
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter));
  });

  applyFilter('all');
  updateCurrentLesson();
  updateSemesterProgress();
  window.setInterval(() => {
    updateCurrentLesson();
    updateSemesterProgress();
  }, 30000);
}

/* ---------- Page 5: map ---------- */

// Great-circle distance in kilometers (Haversine formula, own implementation).
function haversineKm(from, to) {
  const EARTH_RADIUS_KM = 6371.0088;
  const toRadians = (degrees) => degrees * Math.PI / 180;

  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function formatDistance(km) {
  if (km < 1) {
    return Math.round(km * 1000) + ' m';
  }
  return km.toLocaleString('sk-SK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

function loadPoints() {
  try {
    const raw = window.localStorage.getItem(MAP_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) {
      return [];
    }
    return data.filter((point) => {
      return point && typeof point.id === 'string' && typeof point.name === 'string' &&
        Number.isFinite(point.lat) && Number.isFinite(point.lng);
    });
  } catch (error) {
    return [];
  }
}

function savePoints(points) {
  try {
    window.localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(points));
    return true;
  } catch (error) {
    return false;
  }
}

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    return;
  }

  const errorBox = document.getElementById('map-error');
  if (typeof L === 'undefined') {
    errorBox.hidden = false;
    return;
  }

  const emptyState = document.getElementById('map-empty');
  const pointList = document.getElementById('point-list');
  const form = document.getElementById('point-form');
  const nameInput = document.getElementById('point-name');
  const formError = document.getElementById('point-name-error');
  const formHint = document.getElementById('point-coords');
  const cancelButton = document.getElementById('point-cancel');
  const centerButton = document.getElementById('add-center');
  const clearButton = document.getElementById('clear-points');
  const targetInputs = Array.from(document.querySelectorAll('input[name="target"]'));
  const resultBox = document.getElementById('distance-result');
  const commuteText = document.getElementById('commute-distance');
  const storageNote = document.getElementById('storage-note');

  const state = {
    points: loadPoints(),
    selectedId: null,
    target: 'school',
    draft: null
  };
  const markers = new Map();
  let route = null;

  const map = L.map(mapElement);
  const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">prispievatelia OpenStreetMap</a>'
  });
  tileLayer.addTo(map);
  map.fitBounds([[SCHOOL.lat, SCHOOL.lng], [HOME.lat, HOME.lng]], { padding: [48, 48] });

  // OpenStreetMap refuses tile requests without a Referer header (e.g. a page opened from file://).
  const tileNote = document.getElementById('map-tile-note');
  tileLayer.on('tileerror', () => {
    tileNote.hidden = false;
  });

  function createIcon(kind, text) {
    return L.divIcon({
      className: 'map-pin-wrapper',
      html: '<span class="map-pin map-pin--' + kind + '">' + text + '</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  function setLabel(marker, text, isPermanent) {
    marker.unbindTooltip();
    marker.bindTooltip(text, { permanent: isPermanent, direction: 'top', offset: [0, -16] });
    if (isPermanent) {
      marker.openTooltip();
    }
  }

  const schoolMarker = L.marker([SCHOOL.lat, SCHOOL.lng], {
    icon: createIcon('school', 'Š'), title: SCHOOL.name, alt: SCHOOL.name
  }).addTo(map);
  const homeMarker = L.marker([HOME.lat, HOME.lng], {
    icon: createIcon('home', 'D'), title: HOME.name, alt: HOME.name
  }).addTo(map);

  const targetMarkers = { school: schoolMarker, home: homeMarker };
  const targetPlaces = { school: SCHOOL, home: HOME };

  commuteText.textContent = formatDistance(haversineKm(HOME, SCHOOL));

  function getSelectedPoint() {
    return state.points.find((point) => point.id === state.selectedId) || null;
  }

  function persist() {
    storageNote.hidden = savePoints(state.points);
  }

  function addPointMarker(point) {
    const marker = L.marker([point.lat, point.lng], {
      icon: createIcon('custom', '+'), title: point.name, alt: point.name
    }).addTo(map);
    marker.on('click', () => selectPoint(point.id));
    markers.set(point.id, marker);
  }

  function renderList() {
    pointList.replaceChildren();
    emptyState.hidden = state.points.length > 0;
    clearButton.hidden = state.points.length === 0;
    pointList.hidden = state.points.length === 0;

    state.points.forEach((point) => {
      const item = createElement('li', 'point-list__item');

      const selectButton = createElement('button', 'control point-list__select', point.name);
      selectButton.type = 'button';
      selectButton.setAttribute('aria-pressed', String(point.id === state.selectedId));
      selectButton.addEventListener('click', () => selectPoint(point.id));

      const deleteButton = createElement('button', 'control control--small', 'Odstrániť');
      deleteButton.type = 'button';
      deleteButton.setAttribute('aria-label', 'Odstrániť bod ' + point.name);
      deleteButton.addEventListener('click', () => removePoint(point.id));

      item.append(selectButton, deleteButton);
      pointList.append(item);
    });
  }

  function updateRoute() {
    if (route) {
      route.remove();
      route = null;
    }

    const selected = getSelectedPoint();
    const target = targetPlaces[state.target];

    setLabel(schoolMarker, SCHOOL.name, true);
    setLabel(homeMarker, HOME.name, true);
    state.points.forEach((point) => setLabel(markers.get(point.id), point.name, false));

    if (!selected) {
      resultBox.textContent = state.points.length > 0
        ? 'Vyberte bod zo zoznamu a cieľ (škola alebo domov), zobrazí sa vzdialenosť.'
        : '';
      return;
    }

    const km = haversineKm(selected, target);
    const distanceText = formatDistance(km);

    route = L.polyline([[selected.lat, selected.lng], [target.lat, target.lng]], {
      className: 'map-route'
    }).addTo(map);

    setLabel(markers.get(selected.id), selected.name + ' · ' + distanceText, true);
    setLabel(targetMarkers[state.target], target.name + ' · ' + distanceText, true);

    resultBox.textContent = 'Bod „' + selected.name + '“ je od cieľa „' + target.name +
      '“ vzdušnou čiarou ' + distanceText + '.';

    map.fitBounds(route.getBounds(), { padding: [64, 64], maxZoom: 15 });
  }

  function selectPoint(id) {
    state.selectedId = id;
    renderList();
    updateRoute();
  }

  function removePoint(id) {
    const marker = markers.get(id);
    if (marker) {
      marker.remove();
      markers.delete(id);
    }
    state.points = state.points.filter((point) => point.id !== id);
    if (state.selectedId === id) {
      state.selectedId = null;
    }
    persist();
    renderList();
    updateRoute();
  }

  function clearDraft() {
    if (state.draft) {
      state.draft.marker.remove();
      state.draft = null;
    }
    form.hidden = true;
    formError.hidden = true;
    nameInput.value = '';
  }

  function startDraft(latlng) {
    if (state.draft) {
      state.draft.marker.remove();
    }
    const marker = L.marker(latlng, {
      icon: createIcon('draft', '?'), title: 'Nový bod', alt: 'Nový bod', keyboard: false
    }).addTo(map);
    state.draft = { lat: latlng.lat, lng: latlng.lng, marker: marker };

    formHint.textContent = 'Súradnice: ' + latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5);
    formError.hidden = true;
    form.hidden = false;
    nameInput.focus();
  }

  function clearAllPoints() {
    if (!window.confirm('Naozaj odstrániť všetky vlastné body?')) {
      return;
    }
    markers.forEach((marker) => marker.remove());
    markers.clear();
    state.points = [];
    state.selectedId = null;
    persist();
    renderList();
    updateRoute();
  }

  map.on('click', (event) => startDraft(event.latlng));
  centerButton.addEventListener('click', () => startDraft(map.getCenter()));
  cancelButton.addEventListener('click', clearDraft);
  clearButton.addEventListener('click', clearAllPoints);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name === '') {
      formError.hidden = false;
      nameInput.focus();
      return;
    }
    if (!state.draft) {
      return;
    }

    const point = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.slice(0, 40),
      lat: state.draft.lat,
      lng: state.draft.lng
    };
    state.points.push(point);
    addPointMarker(point);
    persist();
    clearDraft();
    selectPoint(point.id);
  });

  targetInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) {
        state.target = input.value;
        updateRoute();
      }
    });
  });

  state.points.forEach(addPointMarker);
  renderList();
  updateRoute();
}

/* ---------- Start ---------- */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();

  const page = document.body.dataset.page;
  if (page === 'workspace') {
    renderHotspots();
  } else if (page === 'schedule') {
    initSchedule();
  } else if (page === 'map') {
    initMap();
  }
});
