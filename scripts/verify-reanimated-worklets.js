/**
 * Reanimated + Worklets – Setup-Check (offizieller Weg).
 *
 * Prüft vor einem Dev-Build nur das, was laut offizieller Doku nötig ist
 * (https://docs.expo.dev/versions/v56.0.0/sdk/reanimated/):
 *  1. reanimated + worklets installiert
 *  2. Versions-Paar kompatibel (reanimated 4.x ↔ worklets 0.8.x, RN 0.85)
 *  3. reanimatED's eigene Build-Validierung (validate-worklets-build.js) bestanden
 *  4. babel-preset-expo hat das reanimated/worklets-Plugin geladen
 *
 * KEINE Patches, KEINE codegenConfig-Manipulation – offizielle Doku sieht das nicht vor.
 * Siehe REANIMATED-WORKLETS-SETUP.md.
 *
 * Aufruf:  node ./scripts/verify-reanimated-worklets.js  (bzw. npm run verify:reanimated)
 * Exit-Code 0 = ok, != 0 = vor dem Build beheben.
 */
const fs = require('fs');
const path = require('path');

const NM = path.join(__dirname, '..', 'node_modules');
let problems = 0;
const fail = (m) => { problems += 1; console.error(`  ✖ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

// --- 0. expo-Basiselement auf SDK 56? ---------------------------------------
// Frühere Ursache des 'rnworklets/rnworklets.h file not found'-Build-Fehlers
// war ein Tippfehler "expo": "^46.0.21" (SDK 46 / RN 0.69 von 2022) in der
// package.json. expo@46 generiert iOS-Projekte OHNE New-Architecture-Codegen,
// daher wird der Codegen-Header rnworklets.h nie erzeugt.
console.log('\n[0/5] expo-Basiselement auf SDK 56?');
const expoPkgPath = path.join(NM, 'expo', 'package.json');
const rootPkgPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(rootPkgPath)) {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const rootExpoSpec = rootPkg.dependencies && rootPkg.dependencies.expo;
  const isSdk56Spec = /^~?56\./.test(rootExpoSpec || '');
  isSdk56Spec
    ? ok(`package.json expo="${rootExpoSpec}" (SDK 56)`)
    : fail(`package.json expo="${rootExpoSpec}" – MUSS ~56.0.x sein (SDK 56). ` +
           `Ein expo der Hauptversion <56 (z.B. 46) erzeugt keine New-Arch-Codegen-Projekte ` +
           `→ 'rnworklets/rnworklets.h file not found'. Korrigiere auf "expo": "~56.0.0".`);
}
if (fs.existsSync(expoPkgPath)) {
  const installed = require(expoPkgPath).version;
  /^56\./.test(installed)
    ? ok(`installiert: expo@${installed} (SDK 56)`)
    : fail(`installiert: expo@${installed} – MUSS 56.x sein. ` +
           `Reset (node_modules + package-lock löschen) + \`npm install\` nach Korrektur der package.json.`);
} else {
  fail('expo-Paket fehlt in node_modules.');
}

// --- 1. Pakete vorhanden ----------------------------------------------------
console.log('\n[1/4] reanimated + worklets installiert?');
const rea = path.join(NM, 'react-native-reanimated', 'package.json');
const wl = path.join(NM, 'react-native-worklets', 'package.json');
if (!fs.existsSync(rea)) { fail('react-native-reanimated fehlt – `npx expo install react-native-reanimated react-native-worklets`'); }
else { ok(`reanimated ${require(rea).version}`); }
if (!fs.existsSync(wl)) { fail('react-native-worklets fehlt – `npx expo install react-native-reanimated react-native-worklets`'); }
else { ok(`worklets ${require(wl).version}`); }

// --- 2. Versions-Paar -------------------------------------------------------
console.log('\n[2/4] Versions-Paar');
if (fs.existsSync(rea) && fs.existsSync(wl)) {
  const r = require(rea).version;
  const w = require(wl).version;
  (() => {
    // Kompatibilität dynamisch aus reanimateds peerDependencies (Single Source of
    // Truth – Software-Mansion veröffentlicht beide Pakete gepaart: 4.3↔0.8,
    // 4.4↔0.9, 4.5↔0.10 …). Früher war hier "w.startsWith('0.8.')" hardcodiert,
    // was bei neueren Paaren fälschlich fehlschlug.
    const peer = require(rea).peerDependencies || {};
    const expected = peer['react-native-worklets'] || ''; // z.B. "0.10.x"
    const m = expected.match(/^(\d+)\.(\d+)\.x$/); // Format wie von reanimated genutzt
    return !m || w.startsWith(`${m[1]}.${m[2]}.`); // keine Range / Treffer = ok
  })()
    ? ok(`reanimated ${r} ↔ worklets ${w} (kompatibel laut compatibility.json / RN 0.81–0.85)`)
    : fail(`Inkompatibel: reanimated ${r} ↔ worklets ${w}. Passende Versionen via \`npx expo install react-native-reanimated react-native-worklets\` setzen.`);
} else {
  fail('Versionen nicht prüfbar (Pakete fehlen).');
}

// --- 3. reanimatED's eigene Build-Validierung --------------------------------
console.log('\n[3/4] reanimated build-validation (läuft auch im EAS-Build)');
const validate = path.join(NM, 'react-native-reanimated', 'scripts', 'validate-worklets-build.js');
if (fs.existsSync(validate)) {
  try {
    require(validate);
    ok('validate-worklets-build.js bestanden');
  } catch (e) {
    fail(`validate-worklets-build.js schlägt fehl: ${e.message}`);
  }
} else {
  console.log('  · validate-worklets-build.js nicht gefunden – übersprungen');
}

// --- 4. codegenConfig original (früherer Patch-Fehler vermeiden) -------------
console.log('\n[4/4] codegenConfig original?');
if (fs.existsSync(wl)) {
  const name = require(wl).codegenConfig && require(wl).codegenConfig.name;
  if (name === 'rnworklets') {
    ok('codegenConfig.name === "rnworklets" (Original – nicht verändern!)');
  } else {
    fail(`codegenConfig.name ist "${name}", muss "rnworklets" sein (Original). worklets neu installieren.`);
  }
}

console.log('\n' + (problems === 0
  ? '✅ Alles ok – bereit für den Dev-Build (offizieller Weg, keine Patches).'
  : `❌ ${problems} Problem(e) gefunden – vor dem Build beheben.`));
process.exit(problems === 0 ? 0 : 1);
