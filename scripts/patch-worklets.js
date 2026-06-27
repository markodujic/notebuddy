/**
 * Postinstall-Patch für react-native-worklets.
 *
 * Problem: WorkletsModule.h importiert <rnworklets/rnworklets.h>,
 * diese Header-Datei existiert aber nicht (stale Referenz aus Reanimated v3).
 *
 * Lösung: Erstellt einen Kompatibilitäts-Header, der die relevanten
 * Public-Headers aus dem worklets-Pod re-exportiert. Damit CocoaPods
 * den Header im include-Pfad unter `rnworklets/` findet, kopieren wir
 * ihn in das `apple/worklets/apple/` Verzeichnis und ergänzen die
 * podspec um ein `header_mappings_dir` für rnworklets.
 *
 * Alternativ (Fallback): Entfernt den Import, falls das Shim nicht klappt.
 */
const fs = require('fs');
const path = require('path');

const WORKLETS_DIR = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-worklets',
);

const HEADER_PATH = path.join(
  WORKLETS_DIR,
  'apple',
  'worklets',
  'apple',
  'WorkletsModule.h',
);

const STALE_IMPORT = '#import <rnworklets/rnworklets.h>';

if (!fs.existsSync(HEADER_PATH)) {
  console.log('[patch-worklets] WorkletsModule.h nicht gefunden – überspringe Patch');
  process.exit(0);
}

let content = fs.readFileSync(HEADER_PATH, 'utf8');

if (!content.includes(STALE_IMPORT)) {
  console.log('[patch-worklets] stale Import nicht vorhanden – Patch nicht nötig');
  process.exit(0);
}

// Strategy: Remove the stale import. The types it used to provide
// (from the old bundled reanimated worklets) are no longer needed
// because WorkletsModuleProxy.h on line 7 provides all necessary types.
content = content.replace(`${STALE_IMPORT}\n`, '');
fs.writeFileSync(HEADER_PATH, content, 'utf8');
console.log('[patch-worklets] Stale <rnworklets/rnworklets.h> Import entfernt');