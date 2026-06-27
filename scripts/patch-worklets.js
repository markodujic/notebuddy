/**
 * Postinstall-Patch für react-native-worklets 0.8.x.
 *
 * Probleme:
 * 1. WorkletsModule.h importiert <rnworklets/rnworklets.h> — existiert nicht.
 * 2. WorkletsModule.h/.mm referenzieren NativeWorkletsModuleSpec(JSI), aber der
 *    Codegen generiert NativeRnworkletsSpec(JSI) (wegen codegenConfig.name = "rnworklets").
 *
 * Lösung:
 * - Entfernt den stale <rnworklets/rnworklets.h> Import.
 * - Korrigiert NativeWorkletsModuleSpec → NativeRnworkletsSpec in .h und .mm.
 */
const fs = require('fs');
const path = require('path');

const APPLE_DIR = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-worklets',
  'apple',
  'worklets',
  'apple',
);

const FILES = ['WorkletsModule.h', 'WorkletsModule.mm'];

const STALE_IMPORT = '#import <rnworklets/rnworklets.h>';
const OLD_NAME = 'NativeWorkletsModuleSpec';
const NEW_NAME = 'NativeRnworkletsSpec';

let totalPatched = 0;

for (const file of FILES) {
  const filePath = path.join(APPLE_DIR, file);

  if (!fs.existsSync(filePath)) {
    console.log(`[patch-worklets] ${file} nicht gefunden – überspringe`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Stale Import entfernen (nur in .h)
  if (file.endsWith('.h') && content.includes(STALE_IMPORT)) {
    content = content.replace(`${STALE_IMPORT}\n`, '');
    modified = true;
    console.log(`[patch-worklets] ${file}: stale <rnworklets/rnworklets.h> Import entfernt`);
  }

  // 2. Codegen-Namen korrigieren (.h und .mm)
  if (content.includes(OLD_NAME)) {
    content = content.split(OLD_NAME).join(NEW_NAME);
    modified = true;
    console.log(`[patch-worklets] ${file}: ${OLD_NAME} → ${NEW_NAME} korrigiert`);
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalPatched += 1;
  }
}

if (totalPatched === 0) {
  console.log('[patch-worklets] Keine Patches nötig');
}