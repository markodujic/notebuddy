/**
 * Penpot Live-Sync Watcher für notebuddy
 *
 * Pollt die Penpot API und synchronisiert Design-Änderungen
 * (SVG-Exports, Design-Tokens) in die notebuddy-Codebase.
 * Metro Fast Refresh erkennt die Dateiänderungen → App aktualisiert live.
 *
 * Verwendung:
 *   1. .env ausfüllen (PENPOT_API_TOKEN, PENPOT_FILE_ID)
 *   2. npm run penpot:sync
 *   3. Ctrl+C zum Beenden
 */

import fs from "node:fs";
import path from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;

const ASSETS_DIR = path.resolve(import.meta.dirname, "..", "assets", "penpot");
const CONSTANTS_FILE = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "constants",
  "penpot-sync.ts"
);

function apiUrl() {
  return process.env.PENPOT_API_URL || "http://localhost:9001";
}
function apiToken() {
  return process.env.PENPOT_API_TOKEN || "";
}
function fileId() {
  return process.env.PENPOT_FILE_ID || "";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString("de-DE");
  console.log(`[${ts}] ${msg}`);
}

function loadEnv() {
  const envPath = path.resolve(import.meta.dirname, "..", ".env");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    // .env nicht lesbar — ignorieren
  }
}

async function penpotRpc(command, params = {}) {
  const url = `${apiUrl()}/api/rpc/command/${command}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...params, id: fileId() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Penpot API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function penpotGetText(endpoint) {
  const url = `${apiUrl()}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${apiToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Penpot GET ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" }[c]))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rgbToHex(rgb) {
  if (typeof rgb === "string") return rgb;
  if (Array.isArray(rgb)) {
    const [r, g, b, a] = rgb;
    const hex = `#${[r, g, b]
      .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
      .join("")}`;
    return a !== undefined && a < 1
      ? `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(
          b * 255
        )},${a})`
      : hex;
  }
  return String(rgb);
}

// ─── Core Sync Logic ─────────────────────────────────────────────────────────

let lastModifiedAt = null;
let isRunning = false;

async function syncOnce() {
  if (isRunning) return;
  isRunning = true;

  try {
    const fileInfo = await penpotRpc("get-file");

    if (!fileInfo || !fileInfo.data) {
      log("⚠️  File nicht gefunden — ist die File-ID korrekt?");
      return;
    }

    const modifiedAt = fileInfo.data.modifiedAt || fileInfo.data.rev || "";

    if (lastModifiedAt && modifiedAt === lastModifiedAt) {
      return; // Keine Änderung
    }

    log(
      `🔄 Penpot File geändert (rev: ${modifiedAt.slice(0, 8) || "?"}) — synchronisiere...`
    );

    const fileData = await penpotRpc("get-file-objects");

    if (!fileData || !fileData.data) {
      log("⚠️  Keine Objects im File gefunden");
      lastModifiedAt = modifiedAt;
      return;
    }

    const objects = fileData.data.objects || fileData.data;
    let syncedCount = 0;

    fs.mkdirSync(ASSETS_DIR, { recursive: true });

    for (const [objId, obj] of Object.entries(objects)) {
      if (!obj || obj.type !== "frame") continue;

      const name = obj.name || objId;
      const safeName = sanitizeFilename(name);

      if (
        name.toLowerCase().includes("token") ||
        name.toLowerCase().includes("design-system")
      ) {
        syncTokens(obj, objects);
      }

      try {
        const svg = await exportObjectAsSvg(objId);
        if (svg) {
          const filePath = path.join(ASSETS_DIR, `${safeName}.svg`);
          fs.writeFileSync(filePath, svg);
          syncedCount++;
        }
      } catch (err) {
        // SVG-Export fehlgeschlagen — überspringen
      }
    }

    syncColorsFromObjects(objects);

    if (syncedCount > 0) {
      log(`✅ ${syncedCount} SVG(s) exportiert → assets/penpot/`);
    }

    lastModifiedAt = modifiedAt;
    log("✓ Sync abgeschlossen — warte auf nächste Änderung...");
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("401") || msg.includes("403")) {
      log("❌ Auth-Fehler — PENPOT_API_TOKEN korrekt?");
    } else if (msg.includes("ECONNREFUSED")) {
      log("❌ Penpot nicht erreichbar — läuft Docker?");
    } else {
      log(`❌ Sync-Fehler: ${msg.slice(0, 120)}`);
    }
  } finally {
    isRunning = false;
  }
}

async function exportObjectAsSvg(objectId) {
  try {
    const svg = await penpotGetText(
      `/api/export/shape/${fileId()}/${objectId}.svg`
    );
    return typeof svg === "string" && svg.startsWith("<svg") ? svg : null;
  } catch (err) {
    return null;
  }
}

function syncTokens(frameObj, allObjects) {
  const tokens = {
    colors: {},
    updatedAt: new Date().toISOString(),
  };

  if (frameObj.shapes) {
    for (const shape of frameObj.shapes) {
      const obj = allObjects[shape.id] || shape;
      if (obj && obj.type === "rect" && obj.fills) {
        const name = sanitizeFilename(obj.name || "color");
        const fill = obj.fills[0];
        if (fill && fill.fillColor) {
          tokens.colors[name] = rgbToHex(fill.fillColor);
        }
      }
    }
  }

  writeConstantsFile(tokens);
}

function syncColorsFromObjects(objects) {
  const colors = {};
  let foundAny = false;

  for (const [, obj] of Object.entries(objects)) {
    if (!obj || obj.type !== "rect") continue;
    if (!obj.name || !obj.fills) continue;

    const fill = obj.fills?.[0];
    if (fill?.fillColor && obj.name.startsWith("color/")) {
      const colorName = obj.name.replace("color/", "").trim();
      colors[colorName] = rgbToHex(fill.fillColor);
      foundAny = true;
    }
  }

  if (foundAny) {
    writeConstantsFile({
      colors,
      updatedAt: new Date().toISOString(),
    });
  }
}

function writeConstantsFile(data) {
  const content = `/**
 * AUTO-GENERIERT von scripts/penpot-sync.mjs
 * NICHT MANUELL BEARBEITEN — Änderungen werden überschrieben.
 *
 * Letzter Sync: ${data.updatedAt}
 */

export const PENPOT_SYNC_COLORS = ${JSON.stringify(data.colors, null, 2)} as const;

export const PENPOT_SYNC_UPDATED_AT = "${data.updatedAt}";
`;
  fs.writeFileSync(CONSTANTS_FILE, content);
  log("🎨 Tokens synchronisiert → src/constants/penpot-sync.ts");
}

// ─── Main ────────────────────────────────────────────────────────────────────

function printBanner() {
  const url = apiUrl();
  const fid = fileId() || "(nicht gesetzt)";
  const tokenStatus = apiToken() ? "gesetzt" : "FEHLT";
  const interval = `${POLL_INTERVAL_MS / 1000}s`;

  console.log(`
╔══════════════════════════════════════════════════════════╗
║         Penpot -> notebuddy Live-Sync                    ║
╠══════════════════════════════════════════════════════════╣
║  Penpot:   ${url.padEnd(44)}║
║  File-ID:  ${fid.padEnd(44)}║
║  Token:    ${tokenStatus.padEnd(44)}║
║  Interval: ${interval.padEnd(44)}║
╚══════════════════════════════════════════════════════════╝
`);
}

async function main() {
  loadEnv();

  if (!apiToken()) {
    console.error(
      "\n❌ PENPOT_API_TOKEN nicht gesetzt!\n" +
        "   → .env öffnen und PENPOT_API_TOKEN eintragen\n" +
        "   → Token in Penpot: Profile → Access Tokens → Generate\n"
    );
    process.exit(1);
  }

  if (!fileId()) {
    console.error(
      "\n❌ PENPOT_FILE_ID nicht gesetzt!\n" +
        "   → .env öffnen und PENPOT_FILE_ID eintragen\n" +
        "   → File-ID aus der Penpot-URL kopieren\n"
    );
    process.exit(1);
  }

  printBanner();
  log("🚀 Watcher gestartet — Ctrl+C zum Beenden");
  log("   Ändere etwas in Penpot und beobachte die Magie ✨\n");

  await syncOnce();
  setInterval(syncOnce, POLL_INTERVAL_MS);
}

main().catch((e) => {
  console.error("Fataler Fehler:", e);
  process.exit(1);
});