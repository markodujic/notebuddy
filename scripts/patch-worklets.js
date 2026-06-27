/**
 * Postinstall-Patch für react-native-worklets.
 *
 * Problem: WorkletsModule.h importiert <rnworklets/rnworklets.h>,
 * diese Header-Datei existiert aber nicht (stale Referenz aus Reanimated v3).
 * Der Import ist funktional unnötig, da die benötigten Typen über
 * <worklets/NativeModules/WorkletsModuleProxy.h> geliefert werden.
 *
 * Dieser Patch entfernt die fehlerhafte Import-Zeile.
 */
const fs = require('fs');
const path = require('path');

const HEADER_PATH = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-worklets',
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

content = content.replace(`${STALE_IMPORT}\n`, '');
fs.writeFileSync(HEADER_PATH, content, 'utf8');
console.log('[patch-worklets] Stale <rnworklets/rnworklets.h> Import entfernt');