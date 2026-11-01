// Shared helper functions used by the parsers and by the page script.

const DAY_NAMES = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];
const WORK_DAYS = DAY_NAMES.slice(0, 5);

// Collapses all whitespace (spaces, tabs, line breaks, &nbsp;) into one space.
function cleanText(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

// Text of the first matching element, or "" when the element does not exist.
function textOf(element, selector) {
  return cleanText(element.querySelector(selector)?.textContent ?? "");
}

// "4,50 €" -> 4.5, "" or nonsense -> null ("price not listed" is not the same as 0).
function parsePrice(text) {
  if (!text) {
    return null;
  }
  const price = parseFloat(text.replace(",", "."));
  return Number.isNaN(price) ? null : price;
}

// Turns HTML text into a separate Document. Its scripts and styles never run on our page.
function parseHtml(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

// "PONDELOK 2.11." or "Sobota & Nedeľa" -> "Pondelok" / "Sobota", unknown -> null.
function findDayName(text) {
  const lower = cleanText(text).toLocaleLowerCase("sk");
  return DAY_NAMES.find((day) => lower.startsWith(day.toLocaleLowerCase("sk"))) ?? null;
}

// Finds a date like "2.11.2026" or "26.10." in a short text, returns "2. 11. 2026" / "26. 10." or "".
function findDate(text) {
  const match = cleanText(text).match(/(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?/);
  if (!match) {
    return "";
  }
  const [, day, month, year] = match;
  return year ? `${day}. ${month}. ${year}` : `${day}. ${month}.`;
}

// "A 1, 3, 7" or "(1,7)" -> ["1", "3", "7"]
function splitAllergens(text) {
  return cleanText(text)
    .split(/[^\d]+/)
    .filter((part) => part !== "");
}

// Index 0 = Monday ... 6 = Sunday (getDay() counts from Sunday).
function getTodayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

function isWeekend(date = new Date()) {
  return getTodayIndex(date) >= 5;
}

// Monday of the week whose menu is relevant: this week on workdays, next week on weekends.
function getRelevantMonday(date = new Date()) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - getTodayIndex(date) + (isWeekend(date) ? 7 : 0));
  return monday;
}

// "2. 11. 2026" -> true if this day and month falls in the relevant week (Monday to Sunday).
function isInRelevantWeek(dateText, today = new Date()) {
  const match = dateText.match(/(\d{1,2})\.\s?(\d{1,2})\./);
  if (!match) {
    return false;
  }
  const monday = getRelevantMonday(today);
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + offset);
    if (day.getDate() === Number(match[1]) && day.getMonth() + 1 === Number(match[2])) {
      return true;
    }
  }
  return false;
}

function formatPrice(price) {
  return `${price.toFixed(2).replace(".", ",")} €`;
}
