// One parser per restaurant. Every parser gets a Document (from DOMParser)
// and returns the same structure, so the rest of the page does not care where the data came from:
//
// [{ day: "Pondelok", date: "2. 11. 2026", items: [MenuItem, ...] }, ...]
//
// MenuItem = { type, label, name, price, priceStudent, priceNote, allergens, weight }
//   type          "polievka", "hlavné jedlo", "stála ponuka", ...
//   label         short label from the source page ("MENU 1", "A", "2."), may be ""
//   price         number in euros, or null when the page does not list it
//   priceStudent  discounted price (Eat & Meet with ISIC), otherwise null
//   priceNote     extra text about the price, e.g. "polievka a nápoj v cene"
//   allergens     array of allergen numbers as strings, may be empty
//   weight        e.g. "80 g", or null

function createItem(fields) {
  return {
    type: "hlavné jedlo",
    label: "",
    name: "",
    price: null,
    priceStudent: null,
    priceNote: "",
    allergens: [],
    weight: null,
    ...fields,
  };
}

// "Kuracie soté (80g) v omáčke" -> "80 g"
function findWeight(text) {
  const match = text.match(/(\d+)\s?g\b/);
  return match ? `${match[1]} g` : null;
}

// ---------------------------------------------------------------------------
// U Zlatého Bažanta (WordPress): <h3><strong>Pondelok 2.11.2026</strong></h3>
// followed by <div class="wp-block-group"> with <p>Polievka:</p><p>soup / soup</p> and <ol><li>dish 9,00€ (...)</li></ol>
// ---------------------------------------------------------------------------

// "Pizza quattro formaggi (...) 9,50€ (polievka a nápoj v cene)" -> item
function parseZlatyBazantDish(text, type, label) {
  const clean = cleanText(text);
  const priceMatch = clean.match(/(\d+[.,]\d{1,2})\s*€/);
  const name = cleanText(priceMatch ? clean.slice(0, priceMatch.index) : clean).replace(/,$/, "");
  if (!name) {
    return null;
  }
  const note = priceMatch ? clean.slice(priceMatch.index + priceMatch[0].length) : "";
  return createItem({
    type,
    label,
    name,
    price: parsePrice(priceMatch?.[1]),
    priceNote: cleanText(note.replace(/[()]/g, "")),
    weight: findWeight(name),
  });
}

function parseZlatyBazantGroup(group) {
  const items = [];
  const paragraphs = [...group.querySelectorAll("p")];
  const soupLabelIndex = paragraphs.findIndex((p) => cleanText(p.textContent).startsWith("Polievka"));
  const soupText = soupLabelIndex === -1 ? "" : cleanText(paragraphs[soupLabelIndex + 1]?.textContent);

  // "Paradajková so syrom / Slepačí vývar" = two soups to choose from
  for (const soup of soupText.split("/").map(cleanText).filter(Boolean)) {
    items.push(createItem({ type: "polievka", name: soup, priceNote: "v cene menu", weight: findWeight(soup) }));
  }

  group.querySelectorAll("ol > li").forEach((li, index) => {
    const item = parseZlatyBazantDish(li.textContent, "hlavné jedlo", `${index + 1}.`);
    if (item) {
      items.push(item);
    }
  });
  return items;
}

function parseZlatyBazant(doc) {
  const headings = [...doc.querySelectorAll(".entry-content h3")];

  // "Stála ponuka (pondelok-piatok)": dishes available every workday
  const standingHeading = headings.find((h) => cleanText(h.textContent).toLowerCase().startsWith("stála ponuka"));
  const standing = [];
  if (standingHeading?.nextElementSibling?.matches("ul")) {
    for (const li of standingHeading.nextElementSibling.querySelectorAll("li")) {
      const item = parseZlatyBazantDish(li.textContent, "stála ponuka", "");
      if (item) {
        standing.push(item);
      }
    }
  }

  const days = [];
  for (const heading of headings) {
    const title = cleanText(heading.textContent);
    const day = findDayName(title);
    if (!day) {
      continue;
    }
    const items = [];
    // everything between this heading and the next <h3> belongs to this day
    let element = heading.nextElementSibling;
    while (element && element.tagName !== "H3") {
      if (element.matches(".wp-block-group")) {
        items.push(...parseZlatyBazantGroup(element));
      }
      element = element.nextElementSibling;
    }
    if (WORK_DAYS.includes(day)) {
      items.push(...standing.map((item) => ({ ...item })));
    }
    days.push({ day, date: findDate(title), items });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Café Devín (Elementor): <h3 class="menu-category-title">Pondelok 26.10.</h3>
// followed by <div class="menu-items-container"> with rows .menu-item-grid
// (.menu-item-title, .menu-item-desc "A: dish A 1, 3, 7", .menu-item-price)
// ---------------------------------------------------------------------------

// "A: Plnená paprika, parená knedľa A 1, 3, 7" -> { label: "A", name: "...", allergens: [...] }
function splitDevinDescription(text) {
  let name = cleanText(text);
  let label = "";
  let allergens = [];

  const allergenMatch = name.match(/\sA\s+([\d,\s]+)$/);
  if (allergenMatch) {
    allergens = splitAllergens(allergenMatch[1]);
    name = cleanText(name.slice(0, allergenMatch.index));
  }
  const labelMatch = name.match(/^([A-Z]):\s*/);
  if (labelMatch) {
    label = labelMatch[1];
    name = name.slice(labelMatch[0].length);
  }
  return { label, name, allergens };
}

function parseDevinRows(container, defaultType) {
  const rows = [];
  let lastTitle = "";
  for (const row of container.querySelectorAll(".menu-item-grid")) {
    // Only the first dish of a group has a title, the following rows have an empty one.
    const title = textOf(row, ".menu-item-title") || lastTitle;
    lastTitle = title;
    const { label, name, allergens } = splitDevinDescription(textOf(row, ".menu-item-desc"));
    if (!name) {
      continue;
    }
    const lower = title.toLowerCase();
    const type = lower.startsWith("polievka") ? "polievka" : lower.startsWith("hlavn") ? "hlavné jedlo" : defaultType;
    const priceText = textOf(row, ".menu-item-price");
    rows.push({
      item: createItem({ type, label, name, allergens }),
      price: parsePrice(priceText),
      priceNote: cleanText(priceText.replace(/^[\d.,\s]+€/, "").replace(/[()]/g, "")),
    });
  }
  return rows;
}

function parseCafeDevin(doc) {
  const days = [];
  const specials = [];

  for (const heading of doc.querySelectorAll("h3.menu-category-title")) {
    const title = cleanText(heading.textContent);
    const container = heading.nextElementSibling;
    if (!container?.matches(".menu-items-container")) {
      continue;
    }

    if (title.toLowerCase().startsWith("týždenný špeciál")) {
      for (const row of parseDevinRows(container, "týždenný špeciál")) {
        row.item.type = "týždenný špeciál";
        specials.push({ ...row.item, price: row.price, priceNote: row.priceNote });
      }
      continue;
    }

    const day = findDayName(title);
    if (!day) {
      continue;
    }
    // The price is shown once per day (on the soup row) and covers soup + main dish.
    const rows = parseDevinRows(container, "hlavné jedlo");
    const menuRow = rows.find((row) => row.price !== null);
    const items = rows.map(({ item }) => {
      if (item.type === "polievka") {
        return { ...item, priceNote: "v cene menu" };
      }
      return { ...item, price: menuRow?.price ?? null, priceNote: menuRow ? "s polievkou" : "" };
    });
    days.push({ day, date: findDate(title), items });
  }

  for (const day of days) {
    day.items.push(...specials.map((item) => ({ ...item })));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Eat & Meet (Bootstrap tabs): <a href="#day-1">Pondelok</a> and <div class="tab-pane" id="day-1">
// with .menu-details: <h4>MENU 1</h4> <span class="price">4,50 € / <span>2,10 €</span></span>
// <p class="desc">Dish name <span>(1,7)</span></p>. No dates on the page.
// ---------------------------------------------------------------------------

function eatAndMeetType(label) {
  const lower = label.toLocaleLowerCase("sk");
  if (lower.startsWith("polievka")) return "polievka";
  if (lower.startsWith("menu")) return "hlavné jedlo";
  if (lower.startsWith("sladk")) return "sladké jedlo";
  if (lower.startsWith("múčn")) return "múčne jedlo";
  if (lower.startsWith("vegetarián")) return "vegetariánske jedlo";
  if (lower.startsWith("šalát")) return "šalát";
  return "iné";
}

// This parser uses jQuery selectors. Note: .each() gets (index, element) as parameters,
// because an arrow function has no own `this`. jQuery never throws when nothing is found,
// it returns an empty collection and .text() of it is "", so missing data is checked explicitly.
function parseEatAndMeet(doc) {
  const days = [];
  const $doc = $(doc);

  $doc.find(".tab-content .tab-pane[id^='day-']").each((index, pane) => {
    // The day name is not inside the pane, only in the tab link pointing to it.
    const day = findDayName($doc.find(`a[href="#${pane.id}"]`).text());
    if (!day) {
      return; // like `continue` in .each()
    }
    const items = [];
    $(pane)
      .find(".menu-details")
      .each((itemIndex, details) => {
        const $details = $(details);
        const label = cleanText($details.find("h4").text());
        const $description = $details.find(".desc");
        // dish name = text nodes directly in <p>, allergens = the <span> inside it
        const name = cleanText(
          $description
            .contents()
            .filter((nodeIndex, node) => node.nodeType === Node.TEXT_NODE)
            .text()
        );
        if (!name) {
          return;
        }
        const $price = $details.find(".price");
        const price = parsePrice(cleanText($price.contents().first().text()));
        const priceStudent = parsePrice(cleanText($price.find("span").text()));
        items.push(
          createItem({
            type: eatAndMeetType(label),
            label,
            name,
            price,
            priceStudent: priceStudent !== price ? priceStudent : null,
            allergens: splitAllergens($description.find("span").text()),
            weight: findWeight(name),
          })
        );
      });
    days.push({ day, date: "", items });
  });
  return days;
}
