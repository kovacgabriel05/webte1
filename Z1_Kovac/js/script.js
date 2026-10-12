'use strict';

/* ==========================================================================
   One script for all pages. Each part starts only on its own page,
   which is chosen by <body data-page="...">.
   ========================================================================== */

// Semester dates (YYYY-MM-DD), both days are included.
const SEMESTER_START = '2026-09-14';
const SEMESTER_END = '2026-12-14';

const STORAGE_KEY = 'z1-kovac-map-points';

const SCHOOL = { name: 'FEI STU', lat: 48.1527, lng: 17.0733 };
const HOME = { name: 'Domov (približne)', lat: 48.2007, lng: 17.3019 };

// Hotspots on the workspace photo. x and y are percentages of the image size.
const HOTSPOTS = [
  {
    title: 'MacBook Pro (M4)',
    text: 'Môj hlavný pracovný nástroj. Používam ho aj mimo školy na úpravu fotiek a iné.',
    topic: 'Fotografovanie',
    x: 86.8, y: 49.5, placement: 'left'
  },
  {
    title: 'Monitor AOC 24", 144 Hz',
    text: 'Externý monitor mi dáva väčšie možnosti, keď potrebujem viac obrazoviek.',
    x: 46.1, y: 60.4, placement: 'bottom'
  },
  {
    title: 'Mechanická klávesnica SPC Gear',
    text: 'Pri stole píšem na mechanickej klávesnici značky SPC Gear.',
    x: 33.6, y: 86.2, placement: 'right'
  },
  {
    title: 'Myš Eternico M500 Wireless',
    text: 'Bezdrôtová myš, ktorú používam pri práci s notebookom aj monitorom.',
    x: 77.9, y: 85.7, placement: 'left'
  },
  {
    title: 'Budík TFA 60.2025.01',
    text: 'Digitálny budík na stole. Čas mám pri práci stále na očiach.',
    x: 7.9, y: 65.7, placement: 'right'
  }
];

const DAY_NAMES = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
const TYPE_NAMES = { lecture: 'prednáška', exercise: 'cvičenie', pe: 'telesná výchova' };

/* ---------- Helpers ---------- */

function parseDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDate(date) {
  return date.getDate() + '. ' + (date.getMonth() + 1) + '. ' + date.getFullYear();
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text || '';
  return element;
}

/* ---------- Page 3: workspace (hotspots are generated from HOTSPOTS) ---------- */

function renderHotspots() {
  const list = document.getElementById('hotspots');

  HOTSPOTS.forEach((spot) => {
    const item = createElement('li', 'hotspot');
    item.dataset.placement = spot.placement;
    item.style.setProperty('--x', spot.x + '%');
    item.style.setProperty('--y', spot.y + '%');

    const trigger = createElement('button', 'hotspot__trigger', '+');
    trigger.type = 'button';
    trigger.title = spot.title;

    const panel = createElement('div', 'hotspot__panel');
    panel.append(createElement('h3', '', spot.title), createElement('p', '', spot.text));
    if (spot.topic) {
      panel.append(createElement('p', '', 'Súvisí s: ' + spot.topic));
    }

    item.append(trigger, panel);
    list.append(item);
  });
}

/* ---------- Page 4: schedule ---------- */

function initSchedule() {
  const lessons = Array.from(document.querySelectorAll('.lesson'));
  const status = document.getElementById('schedule-status');
  const emptyMessage = document.getElementById('schedule-empty');
  const tableWrap = document.getElementById('schedule-wrap');
  const buttons = Array.from(document.querySelectorAll('[data-filter]'));

  const start = parseDate(SEMESTER_START);
  const end = parseDate(SEMESTER_END);
  end.setHours(23, 59, 59, 999);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  function lessonText(cell) {
    return cell.querySelector('strong').textContent + ' (' + TYPE_NAMES[cell.dataset.type] + ')';
  }

  // Filter buttons: dim cells that do not match, show a message if nothing matches.
  function applyFilter(filter) {
    let matches = 0;
    lessons.forEach((cell) => {
      const isMatch = filter === 'all' || cell.dataset.type === filter;
      cell.classList.toggle('is-dimmed', !isMatch);
      if (isMatch) {
        matches += 1;
      }
    });
    buttons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.filter === filter);
    });
    tableWrap.hidden = matches === 0;
    emptyMessage.hidden = matches > 0;
  }

  // Looks at today and the next 7 days and returns the first lesson that starts after now.
  function findNextLesson() {
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = (now.getDay() + offset) % 7;
      const candidates = lessons
        .filter((cell) => Number(cell.dataset.day) === day)
        .filter((cell) => offset > 0 || toMinutes(cell.dataset.start) > nowMinutes)
        .sort((a, b) => toMinutes(a.dataset.start) - toMinutes(b.dataset.start));
      if (candidates.length > 0) {
        const when = offset === 0 ? 'dnes' : offset === 1 ? 'zajtra' : DAY_NAMES[day];
        return when + ' o ' + candidates[0].dataset.start + ': ' + lessonText(candidates[0]);
      }
    }
    return '';
  }

  function showStatus() {
    if (now < start || now > end) {
      status.textContent = 'Semester práve neprebieha. Výučba trvá od ' + formatDate(start) +
        ' do ' + formatDate(parseDate(SEMESTER_END)) + '.';
      return;
    }

    const current = lessons.filter((cell) => {
      return Number(cell.dataset.day) === now.getDay() &&
        nowMinutes >= toMinutes(cell.dataset.start) &&
        nowMinutes <= toMinutes(cell.dataset.end);
    });

    if (current.length === 0) {
      status.textContent = 'Teraz nemám výučbu. Najbližšia hodina: ' + findNextLesson() + '.';
      return;
    }

    current.forEach((cell) => cell.classList.add('is-current'));
    status.textContent = 'Práve prebieha: ' + current.map(lessonText).join(' a ') + '.';
  }

  function showProgress() {
    const ratio = (now - start) / (end - start);
    const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    document.getElementById('semester-progress').value = percent;
    document.getElementById('semester-label').textContent = 'Uplynulo ' + percent + ' % semestra.';
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter));
  });

  applyFilter('all');
  showStatus();
  showProgress();
}

/* ---------- Page 5: map ---------- */

// Haversine formula: distance between two points on a sphere, in kilometers.
function getDistanceKm(from, to) {
  const radius = 6371;
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function formatDistance(km) {
  return km.toLocaleString('sk-SK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

function initMap() {
  const emptyState = document.getElementById('map-empty');
  const form = document.getElementById('point-form');
  const nameInput = document.getElementById('point-name');
  const list = document.getElementById('point-list');
  const result = document.getElementById('distance-result');

  const map = L.map('map');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">prispievatelia OpenStreetMap</a>'
  }).addTo(map);
  map.fitBounds([[SCHOOL.lat, SCHOOL.lng], [HOME.lat, HOME.lng]], { padding: [40, 40] });

  // School and home are always on the map.
  const schoolMarker = L.marker([SCHOOL.lat, SCHOOL.lng]).addTo(map).bindTooltip(SCHOOL.name, { permanent: true });
  const homeMarker = L.marker([HOME.lat, HOME.lng]).addTo(map).bindTooltip(HOME.name, { permanent: true });

  let points = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let selected = null;
  let draft = null;
  let route = null;

  function savePoints() {
    // The marker object is not saved, only name and coordinates.
    const data = points.map((point) => ({ name: point.name, lat: point.lat, lng: point.lng }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function renderList() {
    list.replaceChildren();
    emptyState.hidden = points.length > 0;

    points.forEach((point, index) => {
      const item = document.createElement('li');
      const button = createElement('button', 'control', point.name);
      button.type = 'button';
      button.classList.toggle('is-active', index === selected);
      button.addEventListener('click', () => {
        selected = index;
        renderList();
        showDistance();
      });
      const deleteButton = createElement('button', 'control', 'Odstrániť');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', () => removePoint(index));
      item.append(button, deleteButton);
      list.append(item);
    });
  }

  // Draws the line and shows the distance for the selected point and the chosen target.
  function showDistance() {
    if (route) {
      route.remove();
    }
    // Reset all labels, then show distances only for the selected point and the target.
    schoolMarker.bindTooltip(SCHOOL.name, { permanent: true });
    homeMarker.bindTooltip(HOME.name, { permanent: true });
    points.forEach((point) => point.marker.bindTooltip(point.name));
    if (selected === null) {
      return;
    }

    const point = points[selected];
    const targetName = document.querySelector('input[name="target"]:checked').value;
    const target = targetName === 'school' ? SCHOOL : HOME;
    const targetMarker = targetName === 'school' ? schoolMarker : homeMarker;
    const text = formatDistance(getDistanceKm(point, target));

    route = L.polyline([[point.lat, point.lng], [target.lat, target.lng]], { className: 'map-route' }).addTo(map);
    point.marker.bindTooltip(point.name + ': ' + text, { permanent: true }).openTooltip();
    targetMarker.bindTooltip(target.name + ': ' + text, { permanent: true }).openTooltip();
    result.textContent = 'Bod „' + point.name + '“ je od cieľa „' + target.name + '“ vzdušnou čiarou ' + text + '.';
  }

  function removePoint(index) {
    points[index].marker.remove();
    points.splice(index, 1);
    selected = null;
    if (route) {
      route.remove();
    }
    result.textContent = '';
    showDistance();
    savePoints();
    renderList();
  }

  function addMarker(point) {
    point.marker = L.marker([point.lat, point.lng]).addTo(map).bindTooltip(point.name);
  }

  // Click on the map starts a new point, the form asks for its name.
  map.on('click', (event) => {
    if (draft) {
      draft.remove();
    }
    draft = L.marker(event.latlng).addTo(map);
    form.hidden = false;
    nameInput.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const point = { name: nameInput.value.trim(), lat: draft.getLatLng().lat, lng: draft.getLatLng().lng };
    draft.remove();
    draft = null;
    addMarker(point);
    points.push(point);
    savePoints();
    form.reset();
    form.hidden = true;
    selected = points.length - 1;
    renderList();
    showDistance();
  });

  document.getElementById('point-cancel').addEventListener('click', () => {
    if (draft) {
      draft.remove();
      draft = null;
    }
    form.reset();
    form.hidden = true;
  });

  document.querySelectorAll('input[name="target"]').forEach((input) => {
    input.addEventListener('change', showDistance);
  });

  points.forEach(addMarker);
  renderList();
}

/* ---------- Start ---------- */

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'workspace') {
    renderHotspots();
  } else if (page === 'schedule') {
    initSchedule();
  } else if (page === 'map') {
    initMap();
  }
});
