const eingabe = document.getElementById("ort-eingabe");
const suchKnopf = document.getElementById("such-knopf");
const vorschlaegeEl = document.getElementById("vorschlaege");
const inhaltEl = document.getElementById("inhalt");
const fehlerEl = document.getElementById("fehler");

const ladeEl = document.getElementById("lade-hinweis");

let letzterOrt = null; // { name, latitude, longitude }

// Mission 18: nach einem Neustart sofort den zuletzt gesuchten Ort zeigen. Gespeichert werden Ort
// UND die letzte Wetter-Antwort, damit schon vor der ersten Netzwerkantwort etwas dasteht.
// try/catch, weil localStorage in Sonderfaellen (z. B. gesperrter Speicher) werfen kann.
const SPEICHER_SCHLUESSEL = "leo-wetter-letzter-stand";
function standSpeichern(ort, daten) {
  try { localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify({ ort, daten, gespeichert: Date.now() })); }
  catch (e) { console.warn("Speichern nicht moeglich", e); }
}
function standLaden() {
  try { return JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)); }
  catch { return null; }
}

// Macht aus Text sicheres HTML: < > & " ' werden zu Zeichen-Codes und damit nur angezeigt,
// nie als HTML-Befehl gelesen.
function htmlSicher(text) {
  return String(text).replace(/[&<>"']/g, z => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);
}

function fehlerZeigen(text) {
  inhaltEl.style.display = "none";
  fehlerEl.style.display = "block";
  fehlerEl.innerHTML = text;
}

async function ortSuchen(name) {
  if (!name || name.trim() === "") {
    fehlerZeigen("Bitte einen Ort eingeben.");
    return;
  }
  vorschlaegeVerstecken();

  let daten;
  try {
    const antwort = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=5&language=de&format=json`
    );
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    daten = await antwort.json();
  } catch (fehler) {
    fehlerZeigen("Ortssuche fehlgeschlagen. Prüfe die Internetverbindung.<br>Quelle: <code>geocoding-api.open-meteo.com</code>.");
    console.error(fehler);
    return;
  }

  // Wichtig: bei keinem Treffer fehlt das Feld "results" komplett (kein leeres Array!) -
  // per curl getestet, bevor dieser Fall im Code behandelt wurde.
  if (!daten.results || daten.results.length === 0) {
    // Matthias' Frage zu "<b>Test</b>": fehlerZeigen() schreibt per innerHTML, die Eingabe wurde
    // also als HTML ausgefuehrt (fett, oder mit <img onerror=...> sogar als Skript). Deshalb die
    // Eingabe vorher entschaerfen - der Rest der Meldung bleibt HTML (<br>, <code>).
    fehlerZeigen(`Kein Ort namens „${htmlSicher(name)}" gefunden. Bitte Schreibweise prüfen.`);
    return;
  }

  // Bug (von Leo im Screenshot gefunden): eine Fehlermeldung von einer vorherigen Suche blieb
  // sichtbar und ueberlagerte die neue Vorschlagsliste, weil hier nichts sie ausgeblendet hat.
  fehlerEl.style.display = "none";

  if (daten.results.length === 1) {
    ortWaehlen(daten.results[0]);
  } else {
    vorschlaegeAnzeigen(daten.results);
  }
}

function vorschlaegeAnzeigen(treffer) {
  vorschlaegeEl.innerHTML = "";
  aktiverIndex = -1;
  treffer.forEach((ort, i) => {
    const zeile = document.createElement("div");
    const region = [ort.admin1, ort.country].filter(Boolean).join(", ");
    zeile.textContent = region ? `${ort.name} (${region})` : ort.name;
    zeile.dataset.index = i;
    zeile.addEventListener("click", () => ortWaehlen(ort));
    zeile.addEventListener("mouseenter", () => aktivenSetzen(i));
    vorschlaegeEl.appendChild(zeile);
  });
  if (treffer.length) {
    vorschlaegeEl.style.display = "block";
    inhaltEl.classList.add("gedimmt"); // Suche in den Vordergrund, Rest leicht abblenden
  } else {
    vorschlaegeVerstecken();
  }
}

function vorschlaegeVerstecken() {
  vorschlaegeEl.style.display = "none";
  inhaltEl.classList.remove("gedimmt");
}

function ortWaehlen(ort) {
  vorschlaegeVerstecken();
  eingabe.value = ort.name;
  letzterOrt = { name: ort.name, latitude: ort.latitude, longitude: ort.longitude };
  wetterLaden({ ortswechsel: true });
}

// --- Live-Vorschläge während des Tippens (interaktiv, nicht erst nach Enter/Klick) ---
let liveTreffer = [];
let aktiverIndex = -1;
let liveTimer = null;
let liveZaehler = 0; // schuetzt gegen Antworten, die nicht mehr zur aktuellsten Eingabe passen

function aktivenSetzen(index) {
  const zeilen = [...vorschlaegeEl.children];
  zeilen.forEach(z => z.classList.remove("aktiv"));
  if (index >= 0 && index < zeilen.length) {
    zeilen[index].classList.add("aktiv");
    aktiverIndex = index;
  } else {
    aktiverIndex = -1;
  }
}

async function liveSuche(text) {
  const eigeneNummer = ++liveZaehler;
  try {
    const antwort = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=6&language=de&format=json`
    );
    if (!antwort.ok) return;
    const daten = await antwort.json();
    if (eigeneNummer !== liveZaehler) return; // inzwischen wurde weitergetippt, diese Antwort ist veraltet
    liveTreffer = daten.results || [];
    vorschlaegeAnzeigen(liveTreffer);
  } catch {
    // Live-Vorschau bei Netzwerkfehler still ausblenden - die grosse Fehlermeldung ist Enter/Klick vorbehalten
    if (eigeneNummer === liveZaehler) vorschlaegeVerstecken();
  }
}

eingabe.addEventListener("input", () => {
  clearTimeout(liveTimer);
  const text = eingabe.value.trim();
  if (text.length < 2) {
    vorschlaegeVerstecken();
    liveTreffer = [];
    return;
  }
  liveTimer = setTimeout(() => liveSuche(text), 300); // Debounce: nicht bei jedem Tastendruck anfragen
});

eingabe.addEventListener("keydown", e => {
  const offen = vorschlaegeEl.style.display === "block" && liveTreffer.length > 0;
  if (e.key === "ArrowDown" && offen) {
    e.preventDefault();
    aktivenSetzen((aktiverIndex + 1) % liveTreffer.length);
  } else if (e.key === "ArrowUp" && offen) {
    e.preventDefault();
    aktivenSetzen((aktiverIndex - 1 + liveTreffer.length) % liveTreffer.length);
  } else if (e.key === "Enter") {
    if (offen && aktiverIndex >= 0) {
      ortWaehlen(liveTreffer[aktiverIndex]);
    } else {
      ortSuchen(eingabe.value);
    }
  } else if (e.key === "Escape") {
    vorschlaegeVerstecken();
  }
});

document.addEventListener("click", e => {
  if (!document.getElementById("suche").contains(e.target)) {
    vorschlaegeVerstecken();
  }
});

// Mission 18: Laden darf nichts einfrieren. fetch() ist asynchron, die Oberflaeche bleibt also
// bedienbar - sichtbar gemacht durch einen Ladehinweis, waehrend der alte Inhalt stehen bleibt.
// ladeZaehler: wird waehrend des Ladens schon der naechste Ort gesucht, darf die aeltere, spaeter
// eintreffende Antwort den neueren Ort nicht ueberschreiben (gleiches Prinzip wie liveZaehler).
let ladeZaehler = 0;

async function wetterLaden({ ortswechsel = false } = {}) {
  if (!letzterOrt) return;
  const ort = { ...letzterOrt };
  const eigeneNummer = ++ladeZaehler;
  const { latitude, longitude } = ort;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature,is_day` +
    `&hourly=temperature_2m,weather_code,apparent_temperature,precipitation_probability,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max` +
    `&forecast_days=7&timezone=auto`;

  ladeEl.textContent = "⏳ Lade aktuelles Wetter …";
  ladeEl.style.visibility = "visible";
  if (ortswechsel) inhaltEl.classList.add("wechsel"); // alter Inhalt blendet ab, springt nicht weg

  let daten;
  try {
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    daten = await antwort.json();
  } catch (fehler) {
    if (eigeneNummer !== ladeZaehler) return;
    inhaltEl.classList.remove("wechsel");
    // Gleicher Ort, schon etwas zu sehen (z. B. gespeicherter Stand nach Neustart ohne Netz):
    // den Stand stehen lassen und nur darauf hinweisen, statt ihn durch eine Fehlermeldung zu ersetzen.
    if (!ortswechsel && inhaltEl.style.display === "block") {
      ladeEl.textContent = "⚠️ Keine Verbindung – zeige den zuletzt geladenen Stand";
      console.error(fehler);
      return;
    }
    ladeEl.style.visibility = "hidden";
    fehlerZeigen("Wetterdaten konnten nicht geladen werden. Prüfe die Internetverbindung.<br>Quelle: <code>api.open-meteo.com</code>.");
    console.error(fehler);
    return;
  }
  if (eigeneNummer !== ladeZaehler) return; // inzwischen anderer Ort gewaehlt: veraltete Antwort verwerfen

  ladeEl.style.visibility = "hidden";
  inhaltEl.style.display = "block";
  fehlerEl.style.display = "none";
  anzeigen(daten, ort.name);
  inhaltEl.classList.remove("wechsel");
  standSpeichern(ort, daten);
}

// feld(objekt, pfad, formatFn) -> gibt formatiertes Ergebnis oder "–" zurueck, wenn die Quelle
// das Feld nicht liefert. So stuerzt die Anzeige nicht ab, wenn Open-Meteo mal ein Feld weglaesst.
function feld(wert, formatFn) {
  return (wert === undefined || wert === null) ? "–" : formatFn(wert);
}

function anzeigen(daten, ortName) {
  const jetzt = daten.current || {};
  const code = wettercode(jetzt.weather_code, istNachtAus(daten));

  document.getElementById("hero-ort").textContent = ortName;
  document.getElementById("hero-icon").textContent = code.icon;
  document.getElementById("hero-temp").textContent = feld(jetzt.temperature_2m, v => `${Math.round(v)}°C`);
  document.getElementById("hero-text").textContent = code.text;
  document.getElementById("hero-gefuehlt").textContent = feld(jetzt.apparent_temperature, v => `Gefühlt ${Math.round(v)}°C`);

  jackeAnzeigen(daten);

  if (typeof hintergrundSetzen === "function") hintergrundSetzen(code.farbe);
  if (typeof zustandSetzen === "function") {
    zustandSetzen({ code: jetzt.weather_code, windSpeedKmh: jetzt.wind_speed_10m, istNachtJetzt: istNachtAus(daten) });
  }

  // --- Details ---
  document.getElementById("d-wind").textContent = feld(jetzt.wind_speed_10m, v => `${Math.round(v)} km/h`);
  document.getElementById("d-feuchte").textContent = feld(jetzt.relative_humidity_2m, v => `${v}%`);
  const uvHeute = daten.daily && daten.daily.uv_index_max ? daten.daily.uv_index_max[0] : undefined;
  document.getElementById("d-uv").textContent = feld(uvHeute, v => v.toFixed(1));
  const sonnenauf = daten.daily && daten.daily.sunrise ? daten.daily.sunrise[0] : undefined;
  const sonnenunter = daten.daily && daten.daily.sunset ? daten.daily.sunset[0] : undefined;
  document.getElementById("d-sonne").textContent =
    (sonnenauf && sonnenunter)
      ? `${uhrzeit(sonnenauf)} – ${uhrzeit(sonnenunter)}`
      : "–";

  // --- Stundenverlauf ---
  const stundenEl = document.getElementById("stunden");
  stundenEl.innerHTML = "";
  if (daten.hourly && daten.hourly.time) {
    const jetztStunde = (jetzt.time || daten.hourly.time[0]).slice(0, 13); // aktuelle Stunde als Text
    const start = daten.hourly.time.findIndex(t => t.slice(0, 13) >= jetztStunde);
    const von = start >= 0 ? start : 0;
    for (let i = von; i < von + 12 && i < daten.hourly.time.length; i++) {
      const stundenCode = wettercode(daten.hourly.weather_code[i], daten.hourly.is_day?.[i] === 0);
      const div = document.createElement("div");
      div.className = "stunde";
      div.innerHTML = `
        <div>${uhrzeitStunde(daten.hourly.time[i])}</div>
        <div class="icon">${stundenCode.icon}</div>
        <div>${feld(daten.hourly.temperature_2m[i], v => Math.round(v) + "°")}</div>
      `;
      stundenEl.appendChild(div);
    }
  }

  // --- 7-Tage-Liste ---
  const tageEl = document.getElementById("tage");
  tageEl.innerHTML = "";
  if (daten.daily && daten.daily.time) {
    daten.daily.time.forEach((datumStr, i) => {
      const tagCode = wettercode(daten.daily.weather_code[i]);
      const datum = new Date(datumStr + "T12:00"); // Mittag: kein Datumsversatz durch Zeitzonen
      const wochentag = i === 0 ? "Heute" : datum.toLocaleDateString("de-DE", { weekday: "short" });
      const tagDatum = datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

      const div = document.createElement("div");
      div.className = "tag";
      div.innerHTML = `
        <div class="wochentag">${wochentag}<br><span style="opacity:.6;font-size:11px">${tagDatum}</span></div>
        <div class="icon">${tagCode.icon}</div>
        <div class="beschreibung">${tagCode.text}</div>
        <div class="minmax">
          <span class="min">${feld(daten.daily.temperature_2m_min?.[i], v => Math.round(v) + "°")}</span>
          &nbsp;/&nbsp;
          <span class="max">${feld(daten.daily.temperature_2m_max?.[i], v => Math.round(v) + "°")}</span>
        </div>
      `;
      tageEl.appendChild(div);
    });
  }
}

// Mission 17: Tag/Nacht muss fuer JEDEN Ort stimmen. Erste Wahl ist is_day aus der Quelle
// (Doku: "1 if the current time step has daylight, 0 at night") - das deckt auch Polartag und
// Polarnacht ab, wo es keinen normalen Sonnenauf-/untergang gibt. Nur falls das Feld fehlt,
// wird wie frueher mit Sonnenauf-/untergang von heute verglichen.
function istNachtAus(daten) {
  const jetzt = daten.current || {};
  if (jetzt.is_day === 0 || jetzt.is_day === 1) return jetzt.is_day === 0;
  const auf = daten.daily?.sunrise?.[0], unter = daten.daily?.sunset?.[0];
  if (!jetzt.time || !auf || !unter) return false;
  return jetzt.time < auf || jetzt.time > unter; // ISO-Texte derselben Ortszeit: Textvergleich genuegt
}

// Mission 18: "Brauche ich eine Jacke?" in fuenf Sekunden. Betrachtet werden die naechsten 12
// Stunden ab jetzt. Schwellen (auch in missionen/18/PRUEFUNG.md):
//   gefuehlte Temperatur minimal < 15 °C   -> Jacke (kalt)
//   Regenwahrscheinlichkeit maximal >= 40 % -> Jacke (nass)
const JACKE_KALT_UNTER = 15;
const JACKE_NASS_AB = 40;
function jackeAnzeigen(daten) {
  const el = document.getElementById("jacke");
  const h = daten.hourly;
  const jetztZeit = daten.current?.time;
  if (!h || !h.time || !jetztZeit) { el.textContent = ""; return; }
  let von = h.time.findIndex(t => t.slice(0, 13) >= jetztZeit.slice(0, 13));
  if (von < 0) von = 0;
  const gefuehlt = (h.apparent_temperature || []).slice(von, von + 12).filter(v => v != null);
  const regen = (h.precipitation_probability || []).slice(von, von + 12).filter(v => v != null);
  if (!gefuehlt.length) { el.textContent = ""; return; }
  const minGefuehlt = Math.min(...gefuehlt);
  const maxRegen = regen.length ? Math.max(...regen) : null;
  const kalt = minGefuehlt < JACKE_KALT_UNTER;
  const nass = maxRegen !== null && maxRegen >= JACKE_NASS_AB;
  const gruende = [];
  // Gerundet auf die Schwelle (14,9 -> "15°") wuerde der Grund der Entscheidung widersprechen,
  // deshalb genau dort mit einer Nachkommastelle: "14,9°" (vom Test test-m18.js gefunden).
  const grad = v => Math.round(v) === JACKE_KALT_UNTER ? v.toFixed(1).replace(".", ",") : Math.round(v);
  if (kalt) gruende.push(`gefühlt bis ${grad(minGefuehlt)}°`);
  if (nass) gruende.push(`Regen bis ${maxRegen} %`);
  el.className = kalt || nass ? "ja" : "nein";
  el.innerHTML = kalt || nass
    ? `🧥 <b>${kalt ? "Jacke" : "Regenjacke"} mitnehmen</b><span>${gruende.join(" · ")} (nächste 12 Std.)</span>`
    : `👕 <b>Keine Jacke nötig</b><span>gefühlt mind. ${grad(minGefuehlt)}°${maxRegen !== null ? ` · Regen max. ${maxRegen} %` : ""} (nächste 12 Std.)</span>`;
}

// Uhrzeiten direkt aus dem Text der Quelle ("2026-09-23T06:12") statt ueber new Date(): so kann
// die Zeitzone/Sommerzeit DIESES Rechners die Ortszeit eines fernen Orts nie verschieben.
function uhrzeit(iso) {
  return iso.slice(11, 16);
}
function uhrzeitStunde(iso) {
  return `${iso.slice(11, 13)} Uhr`;
}

suchKnopf.addEventListener("click", () => ortSuchen(eingabe.value));

// Start: zuletzt gesuchten Ort sofort aus dem Speicher anzeigen, dann im Hintergrund frisch laden.
// Nur beim allerersten Start (nichts gespeichert) Frankfurt als Vorgabe.
const gespeichert = standLaden();
if (gespeichert && gespeichert.ort && gespeichert.daten) {
  letzterOrt = gespeichert.ort;
  eingabe.value = gespeichert.ort.name;
  inhaltEl.style.display = "block";
  anzeigen(gespeichert.daten, gespeichert.ort.name);
  wetterLaden();
} else {
  ortSuchen("Frankfurt am Main");
}
setInterval(() => { if (letzterOrt) wetterLaden(); }, 15 * 60 * 1000);
