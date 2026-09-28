// WMO-Wettercodes -> Deutscher Text, Icon, Hintergrundfarbverlauf.
// Quelle: https://open-meteo.com/en/docs -> Abschnitt "WMO Weather interpretation codes (WW)".
// Jede Zeile unten zitiert den englischen Originaltext aus der Doku im Kommentar, die deutsche
// Übersetzung daneben ist meine eigene, keine Herstelleraussage.
const WETTERCODES = {
  0: { text: "Klarer Himmel", icon: "☀️", farbe: "#4a90d9,#1b4d7a" },            // "Clear sky"
  1: { text: "Überwiegend klar", icon: "🌤️", farbe: "#5c9bd6,#274f7c" },        // "Mainly clear, partly cloudy, and overcast"
  2: { text: "Teilweise bewölkt", icon: "⛅", farbe: "#6f9bc4,#39597e" },        // (dieselbe Quellzeile wie 1/3)
  3: { text: "Bedeckt", icon: "☁️", farbe: "#7d8b9a,#3f4a56" },                  // (dieselbe Quellzeile wie 1/2)
  45: { text: "Nebel", icon: "🌫️", farbe: "#8a9aa5,#4c5860" },                  // "Fog and depositing rime fog"
  48: { text: "Reifnebel", icon: "🌫️", farbe: "#8a9aa5,#4c5860" },              // (dieselbe Quellzeile wie 45)
  51: { text: "Leichter Nieselregen", icon: "🌦️", farbe: "#5c7fa3,#2e4257" },   // "Drizzle: Light, moderate, and dense intensity"
  53: { text: "Nieselregen", icon: "🌦️", farbe: "#5c7fa3,#2e4257" },
  55: { text: "Starker Nieselregen", icon: "🌧️", farbe: "#4f7093,#25384a" },
  56: { text: "Gefrierender Nieselregen", icon: "🌧️❄️", farbe: "#5c7fa3,#2e4257" }, // "Freezing Drizzle: Light and dense intensity"
  57: { text: "Starker gefrierender Nieselregen", icon: "🌧️❄️", farbe: "#4f7093,#25384a" },
  61: { text: "Leichter Regen", icon: "🌧️", farbe: "#4f7093,#25384a" },          // "Rain: Slight, moderate and heavy intensity"
  63: { text: "Regen", icon: "🌧️", farbe: "#43617f,#1f2f3f" },
  65: { text: "Starker Regen", icon: "🌧️", farbe: "#38536e,#19232f" },
  66: { text: "Gefrierender Regen", icon: "🌧️❄️", farbe: "#43617f,#1f2f3f" },   // "Freezing Rain: Light and heavy intensity"
  67: { text: "Starker gefrierender Regen", icon: "🌧️❄️", farbe: "#38536e,#19232f" },
  71: { text: "Leichter Schneefall", icon: "🌨️", farbe: "#7fa3c7,#3d5570" },     // "Snow fall: Slight, moderate, and heavy intensity"
  73: { text: "Schneefall", icon: "❄️", farbe: "#719ac5,#354d66" },
  75: { text: "Starker Schneefall", icon: "❄️", farbe: "#6390bd,#2c445b" },
  77: { text: "Schneegriesel", icon: "❄️", farbe: "#7fa3c7,#3d5570" },           // "Snow grains"
  80: { text: "Leichte Regenschauer", icon: "🌦️", farbe: "#5c7fa3,#2e4257" },   // "Rain showers: Slight, moderate, and violent"
  81: { text: "Regenschauer", icon: "🌧️", farbe: "#4f7093,#25384a" },
  82: { text: "Heftige Regenschauer", icon: "⛈️", farbe: "#38536e,#19232f" },
  85: { text: "Leichte Schneeschauer", icon: "🌨️", farbe: "#7fa3c7,#3d5570" },  // "Snow showers slight and heavy"
  86: { text: "Starke Schneeschauer", icon: "🌨️", farbe: "#6390bd,#2c445b" },
  95: { text: "Gewitter", icon: "⛈️", farbe: "#3a3a5c,#17172a" },                // "Thunderstorm: Slight or moderate"
  96: { text: "Gewitter mit leichtem Hagel", icon: "⛈️", farbe: "#3a3a5c,#17172a" }, // "Thunderstorm with slight and heavy hail"
  99: { text: "Gewitter mit starkem Hagel", icon: "⛈️", farbe: "#3a3a5c,#17172a" },
};

// Nachts keine Sonne im Symbol (Mission 17: "nachts ist es Nacht" gilt auch fuer die Icons).
// Nur die drei Codes mit Sonne im Bild bekommen eine Nachtfassung, alle anderen zeigen ohnehin
// Wolken/Regen/Schnee ohne Sonne.
const NACHT_ICONS = { 0: "🌙", 1: "🌙", 2: "☁️" };

function wettercode(code, istNacht = false) {
  const eintrag = WETTERCODES[code] || { text: "Unbekannter Code", icon: "❓", farbe: "#4a4a4a,#1a1a1a" };
  return istNacht && NACHT_ICONS[code] ? { ...eintrag, icon: NACHT_ICONS[code] } : eintrag;
}
