# Penpot Design Workflow für notebuddy

Dieses Dokument beschreibt, wie **Penpot** (selbst gehostet) als Design-Tool für **notebuddy** eingesetzt wird — von der Einrichtung bis zur Asset-Pipeline.

## Übersicht

```
Penpot (d:\penpot)  →  Design / Mockups / Tokens
        ↓
  Export (SVG / PNG / JSON)
        ↓
notebuddy (d:\notebuddy)  →  assets/ + src/constants/
```

---

## 1. Penpot starten

```bash
cd d:\penpot
docker compose -p penpot -f docker-compose.yaml up -d
```

- **Penpot UI:** http://localhost:9001
- **Mailcatch (Registrierungs-Mails):** http://localhost:1080
- **Stoppen:** `docker compose -p penpot -f docker-compose.yaml down`
- **Update:** `docker compose -f docker-compose.yaml pull && docker compose -p penpot -f docker-compose.yaml up -d`

### Erster User anlegen

1. Gehe zu http://localhost:9001 → "Sign up"
2. Die Bestätigungsmail erscheint im Mailcatcher unter http://localhost:1080
3. Alternativ via CLI:
   ```bash
   docker exec -ti penpot-penpot-backend-1 python3 manage.py create-profile
   ```

---

## 2. Projektstruktur in Penpot

Erstelle in Penpot ein Team **"notebuddy"** mit folgenden Files:

### File 1: 🎨 Design System
| Page | Inhalt |
|------|--------|
| **Colors** | Light/Dark Theme, Parchment, Feedback-Farben |
| **Typography** | Font-Skalen (title, subtitle, body, noteBadge) |
| **Spacing** | 2/4/8/16/24/32/64px Referenz-Blöcke |
| **Components** | Wiederverwendbare UI-Bausteine (siehe unten) |

### File 2: 📱 Screens
| Page | Inhalt |
|------|--------|
| **Home** | Startbildschirm mit Modus-Karten |
| **Note→Piano** | Note anzeigen → Mikrofon → Pitch-Detection → Feedback |
| **Piano→Note** | Taste drücken → NoteButtons → Feedback |
| **Visualize** | Note → Staff tippen → Feedback |
| **Range Finder** | Adaptiver Test |
| **Tutorial** | 4-Phasen Lernmodus |

### File 3: 🎹 Assets
| Page | Inhalt |
|------|--------|
| **Icons** | Tab-Icons, UI-Icons |
| **Illustrations** | Onboarding, Tutorial |
| **App Icon** | 1024×1024 Master |

---

## 3. Design-Tokens Referenz

Die Datei **`docs/penpot-design-tokens.json`** enthält alle notebuddy-Design-Tokens im DTCG-Format.
Verwende diese als Referenz beim Anlegen von Farben, Typografie und Spacing in Penpot.

### Quick-Reference: Farben

| Token | Light | Dark |
|-------|-------|------|
| text | `#000000` | `#ffffff` |
| background | `#ffffff` | `#000000` |
| backgroundElement | `#F0F0F3` | `#212225` |
| backgroundSelected | `#E0E1E6` | `#2E3135` |
| textSecondary | `#60646C` | `#B0B4BA` |

### Quick-Reference: Parchment (Notensystem)

| Token | Light | Dark |
|-------|-------|------|
| bg | `#fdf6e3` | `#1e1e32` |
| staffLine | `#000000` | `#e0e0e0` |
| noteHead | `#000000` | `#e0e0e0` |

### Quick-Reference: Feedback

| Token | Wert |
|-------|------|
| correct | `#22c55e` |
| correctGlow | `rgba(34,197,94,0.8)` |
| wrong | `#ef4444` |
| wrongBlink | `#8b0000` |
| hoverFill | `rgba(102,126,234,0.3)` |
| hoverStroke | `rgba(102,126,234,0.8)` |

### Quick-Reference: Typografie-Skala

| Rolle | Compact (<420) | Medium (420–700) | Expanded (≥700) |
|-------|----------------|-------------------|-----------------|
| title | 34px | 42px | 48px |
| subtitle | 22px | 26px | 30px |
| body | 15px | 16px | 17px |
| noteBadge | 96px | 128px | 160px |

### Quick-Reference: Spacing

| Token | Wert |
|-------|------|
| half | 2px |
| one | 4px |
| two | 8px |
| three | 16px |
| four | 24px |
| five | 32px |
| six | 64px |

---

## 4. Komponenten-Bibliothek

Diese notebuddy-Komponenten sollen als Penpot-Komponenten nachgebaut werden:

| Komponente | Quelle | Penpot-Typ |
|------------|--------|------------|
| Staff View | `components/staff/staff-view.tsx` | Frame 340×340, 5 Linien |
| Grand Staff | `components/staff/grand-staff-view.tsx` | Frame mit 2 Systemen + Akkolade |
| Piano Keyboard | `components/piano-keyboard.tsx` | 88 Tasten, 3D-Perspektive |
| Note Buttons | `components/controls/note-buttons.tsx` | 7 Buttons (A-G) |
| Swipe Accidental | `components/controls/swipe-accidental.tsx` | Swipe-Gestik-Indikator |
| Pitch Ring | `components/feedback/pitch-ring.tsx` | Animierter Ring |
| Result Banner | `components/feedback/result-banner.tsx` | Correct/Wrong Banner |
| Segmented Control | `components/segmented-control.tsx` | Tab-Switcher |
| Mode Card | `components/mode-card.tsx` | Start-Kachel |

### Staff-Metriken (für Penpot-Komponenten)

```
Canvas:        340×340px
Line Spacing:  24px
Line Width:    1.5px
Note Head:     13×9px, Rotation -0.3 rad
Stem:          67px hoch, 2.5px breit
Ledger Extend: 20px über Note hinaus
```

### Keyboard-Tastenbreiten

| Breakpoint | Weiße Taste |
|------------|-------------|
| Compact | 16px |
| Medium | 24px |
| Expanded | 28px |

---

## 5. Asset-Pipeline: Penpot → notebuddy

### SVG-Export

1. In Penpot: Element auswählen → **Export → SVG**
2. Datei speichern unter `d:\notebuddy\assets\images\` (oder passender Subfolder)
3. In Expo einbinden:
   ```tsx
   import { SvgXml } from 'react-native-svg';
   // oder als require:
   const icon = require('@/assets/images/icon-name.svg');
   ```

### PNG-Export (für App-Icon, Tab-Icons)

1. In Penpot: Frame in entsprechender Größe anlegen (z. B. 1024×1024 für App-Icon)
2. **Export → PNG @1x/@2x/@3x**
3. In `assets/images/` ablegen

### Design-Tokens synchronisieren

Wenn Tokens in Penpot geändert wurden:
1. Werte aus Penpot ablesen
2. In `src/constants/theme.ts` / `layout.ts` / `music-font.ts` aktualisieren
3. Referenz-JSON in `docs/penpot-design-tokens.json` aktualisieren

---

## 6. Empfohlener Workflow

```
1. Design in Penpot erstellen/ändern
2. SVG/PNG exportieren → assets/
3. Tokens bei Bedarf synchronisieren → src/constants/
4. In notebuddy implementieren (Skia/Reanimated)
5. Auf Device testen (Metro-Server starten)
```

### Naming-Konvention für Assets

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| Icons | `kebab-case.svg` | `note-correct.svg` |
| Tab Icons | `tab-{name}.png` | `tab-home.png` |
| App Icon | `icon.png` (1024²) | `icon.png` |
| Splash | `splash-icon.png` | `splash-icon.png` |

---

## 7. Backup

Penpot speichert alle Daten in Docker-Volumes:
- `penpot_postgres_v15` — Datenbank
- `penpot_assets` — Hochgeladene Assets (Bilder, SVGs)

### Backup-Befehl

```bash
cd d:\penpot
docker run --rm -v penpot_penpot_postgres_v15:/data -v %cd%:/backup ubuntu tar czf /backup/penpot-db-backup.tar.gz /data
docker run --rm -v penpot_penpot_assets:/data -v %cd%:/backup ubuntu tar czf /backup/penpot-assets-backup.tar.gz /data
```

---

## 8. Wenn Penpot von außen erreichbar sein soll

1. In `d:\penpot\docker-compose.yaml`:
   - `PENPOT_PUBLIC_URI` auf deine Domain ändern
   - `disable-secure-session-cookies` Flag entfernen
   - `disable-email-verification` entfernen (echten SMTP einrichten)
   - Traefik-Section auskommentieren und konfigurieren
2. DNS auf deinen Server zeigen lassen
3. `docker compose -p penpot -f docker-compose.yaml up -d`

---

## Quick-Start Checkliste

- [ ] `cd d:\penpot && docker compose -p penpot -f docker-compose.yaml up -d`
- [ ] http://localhost:9001 öffnen → Registrieren
- [ ] Bestätigungsmail unter http://localhost:1080 abrufen
- [ ] Team "notebuddy" erstellen
- [ ] File "Design System" anlegen → Tokens aus `penpot-design-tokens.json` eintragen
- [ ] File "Screens" anlegen → Mockups der 5 Modi erstellen
- [ ] File "Assets" anlegen → Icons/Illustrationen entwerfen
- [ ] Bei Änderungen: SVG/PNG exportieren → `d:\notebuddy\assets\`