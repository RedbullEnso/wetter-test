// Hintergrund-Animation, an echte Zahlen aus der Wetter-Antwort gebunden, keine Dekoration.
// Jede Schwelle/Formel hier ist auch in missionen/17/ANIMATION.md mit Zahl dokumentiert.
// Reines Canvas + requestAnimationFrame, keine Bibliothek.

const canvas = document.createElement("canvas");
canvas.id = "wetter-animation";
canvas.style.cssText = "position:fixed; inset:0; width:100%; height:100%; z-index:0; pointer-events:none;";
document.body.prepend(canvas);
const ctx = canvas.getContext("2d");

function canvasGroesseAnpassen() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
canvasGroesseAnpassen();
window.addEventListener("resize", canvasGroesseAnpassen);

// Ortswechsel springt nicht, er geht ueber (Mission 17): jeder Wetterzustand ist eine eigene
// "Ebene" mit Wolken + Niederschlag. Beim Wechsel blendet die alte Ebene in UEBERGANG_MS aus und
// die neue gleichzeitig ein. Wind, Nacht-Schleier und Hintergrundfarbe gleiten ebenso.
const UEBERGANG_MS = 1500;
const NACHT_DECKKRAFT = 0.38;

let ebenen = [];              // [{ code, typ, wolken, niederschlag, deckkraft, ziel }]
let blitzAlpha = 0;
let nachtDeckkraft = 0;        // aktuell gezeichnet (0 = Tag, 0.38 = Nacht)
let nachtZiel = 0;
let windKmh = 0;               // aktuell gezeichnet
let windZiel = 0;              // aus der Quelle
let letztesBild = null;
let animationLaeuft = false;
let bilderGezeichnet = 0;      // nur fuer die Lastmessung (--messe-last): gezeichnete Bilder zaehlen

// Zwei uebereinanderliegende Hintergrund-Ebenen, weil CSS einen Farbverlauf nicht direkt in einen
// anderen ueberblenden kann: die neue Ebene bekommt den neuen Verlauf und blendet per opacity ein.
const hintergruende = [0, 1].map(() => {
  const div = document.createElement("div");
  div.style.cssText = `position:fixed; inset:0; z-index:0; pointer-events:none; opacity:0; transition:opacity ${UEBERGANG_MS}ms ease;`;
  document.body.prepend(div);
  return div;
});
let aktiverHintergrund = 0;
let letzteFarbe = null;

function hintergrundSetzen(farbe) {
  if (farbe === letzteFarbe) return;
  letzteFarbe = farbe;
  aktiverHintergrund = 1 - aktiverHintergrund;
  const neu = hintergruende[aktiverHintergrund];
  const alt = hintergruende[1 - aktiverHintergrund];
  neu.style.background = `linear-gradient(180deg, ${farbe})`;
  neu.style.zIndex = "0"; alt.style.zIndex = "-1"; // neue Ebene liegt oben und blendet ein
  neu.style.opacity = "1";
  setTimeout(() => { if (hintergruende[1 - aktiverHintergrund] === alt) alt.style.opacity = "0"; }, UEBERGANG_MS);
}

// --- Wolken: Menge aus dem WMO-Code (0=klar .. 3=bedeckt), Drift aus der Windgeschwindigkeit ---
// Schwelle/Formel (auch in ANIMATION.md): Wolkenanzahl = WOLKEN_PRO_CODE[code] ?? 0.
// Drift in Pixel/Bild = windKmh / 20 (bei 0 km/h stehen die Wolken, bei 40 km/h ~2px/Bild).
const WOLKEN_PRO_CODE = { 0: 0, 1: 2, 2: 5, 3: 9 };

function wolkenErzeugen(code) {
  const anzahl = WOLKEN_PRO_CODE[code] ?? (code >= 45 ? 6 : 3); // Niederschlag/Nebel: mittelviel Bewölkung
  const liste = [];
  for (let i = 0; i < anzahl; i++) {
    liste.push({
      x: Math.random() * canvas.width,
      y: 20 + Math.random() * (canvas.height * 0.35),
      breite: 90 + Math.random() * 120,
      hoehe: 26 + Math.random() * 20,
      alpha: 0.10 + Math.random() * 0.12,
    });
  }
  return liste;
}

function wolkenZeichnen(wolken, deckkraft) {
  const driftProBild = windKmh / 20; // dokumentierte Formel, siehe ANIMATION.md
  ctx.fillStyle = "white";
  for (const w of wolken) {
    ctx.globalAlpha = w.alpha * deckkraft;
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, w.breite / 2, w.hoehe / 2, 0, 0, Math.PI * 2);
    ctx.ellipse(w.x - w.breite * 0.3, w.y + 6, w.breite / 3, w.hoehe / 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(w.x + w.breite * 0.3, w.y + 4, w.breite / 3.2, w.hoehe / 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    w.x += driftProBild;
    if (w.x - w.breite > canvas.width) w.x = -w.breite;
  }
  ctx.globalAlpha = 1;
}

// --- Niederschlag: Typ aus dem WMO-Code, Schraeglage aus Wind UND Fallgeschwindigkeit ---
// Physik (Quellen in ANIMATION.md): Der Wind traegt Tropfen und Flocken gleich schnell seitwaerts.
// Wie schraeg sie fallen, haengt davon ab, wie schnell sie nach unten fallen:
//   Regentropfen ~8 m/s (3 mm, Gunn & Kinzer 1949), Schneeflocken ~1 m/s (Locatelli & Hobbs 1974).
// Deshalb weht Schnee bei gleichem Wind viel staerker schraeg als Regen.
// Massstab: PX_PRO_MS Pixel pro Bild entsprechen 1 m/s. Fallgeschwindigkeit Regen 4..9 px/Bild
// (~5..11 m/s), Schnee 0,5..1,5 px/Bild (~0,6..1,9 m/s) - dieselbe Groessenordnung wie gemessen.
const PX_PRO_MS = 0.8;

function niederschlagErzeugen(typ) {
  const anzahl = typ === "schnee" ? 70 : 120;
  const liste = [];
  for (let i = 0; i < anzahl; i++) {
    liste.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      geschwindigkeit: typ === "schnee" ? 0.5 + Math.random() * 1 : 4 + Math.random() * 5,
      laenge: typ === "regen" || typ === "gewitter" ? 10 + Math.random() * 10 : 0,
      groesse: typ === "schnee" ? 1.5 + Math.random() * 2 : 0,
      driftEigen: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2, // Schnee: leichtes Pendeln
    });
  }
  return liste;
}

// Horizontal aus dem Fenster geweht -> auf der anderen Seite wieder herein (bei Sturm noetig).
function umbrechen(t) {
  if (t.x > canvas.width + 20) t.x -= canvas.width + 40;
  else if (t.x < -20) t.x += canvas.width + 40;
}

function niederschlagZeichnen(niederschlag, niederschlagsTyp, deckkraft) {
  ctx.globalAlpha = deckkraft;
  const windPx = (windKmh / 3.6) * PX_PRO_MS; // km/h -> m/s -> Pixel pro Bild, siehe ANIMATION.md
  if (niederschlagsTyp === "regen" || niederschlagsTyp === "gewitter") {
    ctx.strokeStyle = "rgba(210,225,245,0.5)";
    ctx.lineWidth = 1.2;
    for (const t of niederschlag) {
      const dx = t.driftEigen + windPx;
      // Strich zeigt in Bewegungsrichtung: Neigung = seitwaerts / nach unten.
      const neigung = dx / t.geschwindigkeit;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + neigung * t.laenge, t.y + t.laenge);
      ctx.stroke();
      t.y += t.geschwindigkeit;
      t.x += dx;
      umbrechen(t);
      if (t.y > canvas.height) { t.y = -t.laenge; t.x = Math.random() * canvas.width; }
    }
    if (niederschlagsTyp === "gewitter" && Math.random() < 0.006) blitzAusloesen(deckkraft);
  } else if (niederschlagsTyp === "schnee") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const t of niederschlag) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.groesse, 0, Math.PI * 2);
      ctx.fill();
      t.phase += 0.03;
      t.y += t.geschwindigkeit;
      t.x += t.driftEigen + windPx + Math.sin(t.phase) * 0.3;
      umbrechen(t);
      if (t.y > canvas.height) { t.y = -5; t.x = Math.random() * canvas.width; }
    }
  }
}

// --- Blitz: heller Blitz UND eine sichtbare, gezackte Bahn von oben ---
let blitzBahn = null;
function blitzAusloesen(deckkraft) {
  blitzAlpha = 0.6 * deckkraft;
  const punkte = [];
  let x = canvas.width * (0.2 + Math.random() * 0.6), y = 0;
  const ende = canvas.height * (0.35 + Math.random() * 0.25);
  while (y < ende) {
    punkte.push([x, y]);
    x += (Math.random() - 0.5) * 40;
    y += 15 + Math.random() * 25;
  }
  blitzBahn = punkte;
}

function blitzZeichnen() {
  if (blitzAlpha <= 0) { blitzBahn = null; return; }
  ctx.fillStyle = `rgba(255,255,255,${blitzAlpha * 0.5})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (blitzBahn) {
    ctx.strokeStyle = `rgba(255,255,230,${Math.min(1, blitzAlpha * 1.6)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    blitzBahn.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  blitzAlpha -= 0.03; // ~20 Bilder = ~0,33 s sichtbar
}

// --- Nebel (WMO 45/48): breite, halbdurchsichtige Schwaden, die langsam mit dem Wind ziehen ---
// Drift = windKmh / 40 Pixel/Bild (halb so schnell wie Wolken: Nebel liegt am Boden, dort ist
// weniger Wind als in Wolkenhoehe). Schwaden im unteren zwei Dritteln des Fensters.
function nebelErzeugen() {
  const liste = [];
  for (let i = 0; i < 5; i++) {
    liste.push({
      x: Math.random() * canvas.width,
      y: canvas.height * (0.3 + Math.random() * 0.65),
      breite: canvas.width * (0.9 + Math.random() * 0.6),
      hoehe: 60 + Math.random() * 60,
      alpha: 0.10 + Math.random() * 0.08,
    });
  }
  return liste;
}

function nebelZeichnen(nebel, deckkraft) {
  for (const n of nebel) {
    const verlauf = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.breite / 2);
    verlauf.addColorStop(0, `rgba(230,235,240,${n.alpha * deckkraft})`);
    verlauf.addColorStop(1, "rgba(230,235,240,0)");
    ctx.fillStyle = verlauf;
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.scale(1, n.hoehe / n.breite);
    ctx.translate(-n.x, -n.y);
    ctx.fillRect(n.x - n.breite / 2, n.y - n.breite / 2, n.breite, n.breite);
    ctx.restore();
    n.x += windKmh / 40;
    if (n.x - n.breite / 2 > canvas.width) n.x = -n.breite / 2;
  }
}

// --- Sterne: nur nachts, Anzahl aus dem Wolkencode (je klarer, desto mehr) ---
const STERNE_PRO_CODE = { 0: 80, 1: 50, 2: 20 };
function sterneErzeugen(code) {
  const anzahl = STERNE_PRO_CODE[code] ?? 0;
  const liste = [];
  for (let i = 0; i < anzahl; i++) {
    liste.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      r: 0.6 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      tempo: 0.02 + Math.random() * 0.04,
    });
  }
  return liste;
}

function sterneZeichnen(sterne, deckkraft) {
  // Sichtbar nur so weit, wie der Nachtschleier schon steht: Tag->Nacht blendet sie mit ein.
  const nacht = nachtDeckkraft / NACHT_DECKKRAFT;
  if (nacht <= 0) return;
  for (const st of sterne) {
    st.phase += st.tempo;
    ctx.globalAlpha = deckkraft * nacht * (0.55 + 0.45 * Math.sin(st.phase)); // Funkeln
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Wert linear um hoechstens "schritt" Richtung Ziel bewegen.
function annaehern(wert, ziel, schritt) {
  return wert < ziel ? Math.min(ziel, wert + schritt) : Math.max(ziel, wert - schritt);
}

function bildZeichnen(zeitstempel) {
  bilderGezeichnet++;
  // Zeitbasiert statt bildbasiert: der Uebergang dauert 1,5 s, egal ob 30 oder 144 Bilder/s.
  const dt = letztesBild === null ? 16 : Math.min(100, zeitstempel - letztesBild);
  letztesBild = zeitstempel;
  const anteil = dt / UEBERGANG_MS;

  for (const e of ebenen) e.deckkraft = annaehern(e.deckkraft, e.ziel, anteil);
  ebenen = ebenen.filter(e => e.ziel > 0 || e.deckkraft > 0); // ausgeblendete Ebenen wegwerfen
  // Wind gleitet in derselben Zeit vom alten zum neuen Wert (Neigung/Drift springt nicht).
  windKmh = annaehern(windKmh, windZiel, Math.max(Math.abs(windZiel - windStart), 1) * anteil);
  nachtDeckkraft = annaehern(nachtDeckkraft, nachtZiel, NACHT_DECKKRAFT * anteil);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const e of ebenen) {
    wolkenZeichnen(e.wolken, e.deckkraft);
    nebelZeichnen(e.nebel, e.deckkraft);
    niederschlagZeichnen(e.niederschlag, e.typ, e.deckkraft);
  }
  ctx.globalAlpha = 1;

  blitzZeichnen();

  // Nacht: dunkler Schleier statt eigener Partikel - "nachts ist es Nacht" gilt fuer JEDEN
  // Zustand (auch Regen bei Nacht), deshalb als letzte Schicht oben drauf.
  if (nachtDeckkraft > 0) {
    ctx.fillStyle = `rgba(5,10,25,${nachtDeckkraft})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Sterne ueber dem Schleier, sonst wuerde die Nacht sie wieder abdunkeln.
  for (const e of ebenen) sterneZeichnen(e.sterne, e.deckkraft);

  if (animationLaeuft) requestAnimationFrame(bildZeichnen);
}

// WMO-Code -> Niederschlagstyp fuer die Partikel-Schicht.
function niederschlagsTypAus(code) {
  if ([95, 96, 99].includes(code)) return "gewitter";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "schnee";
  return "keine";
}

let windStart = 0;

// zustandSetzen({code, windSpeedKmh, istNachtJetzt}) - einziger Eintrittspunkt aus renderer.js.
// Jeder Aufruf-Parameter ist eine echte Zahl/ein echter Wert aus der Open-Meteo-Antwort.
function zustandSetzen({ code, windSpeedKmh, istNachtJetzt }) {
  windStart = windKmh;
  windZiel = windSpeedKmh ?? 0;
  nachtZiel = istNachtJetzt ? NACHT_DECKKRAFT : 0;

  // Gleicher Code wie bisher (z. B. 15-Minuten-Aktualisierung): keine neue Ebene, sonst wuerden
  // die Wolken ohne Grund neu verteilt. Nur Wind und Nacht gleiten zum neuen Wert.
  const aktiv = ebenen.find(e => e.ziel === 1);
  if (!aktiv || aktiv.code !== code) {
    for (const e of ebenen) e.ziel = 0;
    const typ = niederschlagsTypAus(code);
    ebenen.push({
      code, typ, deckkraft: 0, ziel: 1,
      wolken: wolkenErzeugen(code),
      niederschlag: typ === "keine" ? [] : niederschlagErzeugen(typ),
      nebel: code === 45 || code === 48 ? nebelErzeugen() : [],
      sterne: sterneErzeugen(code),
    });
  }

  if (!animationLaeuft) {
    animationLaeuft = true;
    requestAnimationFrame(bildZeichnen);
  }
}
