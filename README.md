# Astro Spectra Mod (Frontend + Web Worker, Engine7-ready)

Detta repo är en **frontend-only scaffold** för en moddad version av SPECTRA (vanilla JS + canvas), med:
- **CORE** = original-SPECTRA-beteende (kamera → stripe → realtidsgraf)
- **LAB** = live elementidentifiering + subtraction/absorbans
- **ASTRO** = sol/stjärna/planet-lägen + continuum-normalisering + Doppler (prelim) + molekylband

Ingen Python/backend i denna struktur. “Tung analys” körs i en **Web Worker** så UI-loopen förblir snabb.

---

## Vad jag utgår från i denna struktur

### 1) SPECTRA (originalets arkitektur)
Originalet är en klassisk instrumentpanel i vanilla JS:
- `cameraScript.js` startar kamera och triggar `plotRGBLineFromCamera()`
- `graphScript.js` klipper horisontell stripe från video/bild, läser `getImageData`, ritar realtidsgraf i canvas
- `stripeScript.js` styr stripe-bredd/y-position
- `calibrationScript.js` gör px→nm via polynomfit
- `referenceGraphScript.js` hanterar referenskurvor
- `dataSavingScript.js` exporterar PNG/XLSX

Det viktiga: **grafen genereras direkt från pixelrad** (client-side), vilket är perfekt att bevara.

### 2) Uppdaterad engine + bibliotek (engine7 + multi-library)
Du har nu uppgraderade bibliotek (atom + molekyl + presets + metadata/manifest).  
Det påverkar strukturen här genom att vi separerar:
- biblioteksladdning
- schema-normalisering
- indexering/filter
- atommatchning vs bandmatchning
- preset-resolving (lab/astro)

---

## Designprinciper

1. **CORE ska kunna hållas identisk med SPECTRA**
   - modulen ska lägga till hooks, inte “äga om” originalet direkt.

2. **Två hastigheter**
   - UI-loop: 30–60 fps (ritning i `graphScript.js`)
   - Analys-tick i worker: 2–5 Hz (peak detect + match + QC)

3. **Web Worker som lokal analysmotor**
   - Ingen backend
   - Ingen Pyodide/Python i browsern
   - Lättare deployment (GitHub Pages etc.)

4. **Schema-aware bibliotek**
   - engine7-biblioteken har olika format (dict/list/schema-v2)
   - worker loader normaliserar till intern standardmodell

---

## Rekommenderad utvecklingsordning (kort)

### Steg A — Integrera original-SPECTRA i scaffold
Byt ut placeholders i `frontend/scripts/*.js`, `frontend/pages/recording.html`, `frontend/styles/styles.css` med originalfilerna.

### Steg B — Lägg in säkra hooks (utan att sabba CORE)
Patcha:
- `graphScript.js` → exportera senaste frame + overlay-hook
- `calibrationScript.js` → exportera kalibreringsstate
- `referenceGraphScript.js` → stöd för “subtraction reference”
- `recording.html` → CORE/LAB/ASTRO-knappar + panelcontainers

### Steg C — Worker-analys för LAB (real-time line ID)
- peaks + lineMatcher + qcRules + overlays
- atom-bibliotek först

### Steg D — Subtraction / absorbans / continuum
- dark/ref/flat
- continuum-normalisering
- bättre peak-robusthet

### Steg E — ASTRO
- presets (Sun/Star/Planet/DeepSky)
- Doppler/RV prelim
- molekylband och bandheads

---

# Filstruktur (med ansvar per fil)

## Rotnivå

### `.gitignore`
Ignorerar editorfiler, build-artifacts m.m.

### `LICENSE`
Projektlicens (läggs till senare).

### `README.md`
Detta dokument: arkitektur, roadmap och ansvar för varje fil.

---

## `docs/`

### `docs/roadmap.md`
Detaljerad genomförandeplan (milstolpar, testmål, risker).

### `docs/worker_protocol.md`
Kontrakt mellan UI och Worker:
- request/response-message-typer
- payloadfält (nm, I, mode, settings, filters)
- felkoder/status

### `docs/library_format.md`
Dokumenterar intern normaliserad biblioteksmodell (atomlinjer, band, species metadata).

### `docs/calibration_presets.md`
Preset-idéer och referenslinjer för:
- Hg/Ne/Ar
- Solar/Fraunhofer
- H-alpha rig
- labb-kalibrering

### `docs/migration_from_spectra.md`
Checklist för att kopiera originalfiler från SPECTRA och patcha dem i rätt ordning.

### `docs/engine7_mapping_notes.md`
Mappning från engine7-koncept → worker-moduler:
- auto-mode
- offset
- QC/gating
- plateau handling
- multi-library loader

---

## `frontend/`

### `frontend/index.html`
Enkel redirect till `pages/recording.html`.

---

## `frontend/pages/`

### `frontend/pages/recording.html`
**Navet** (ersätts senare med original-SPECTRA `recording.html`, sedan patchas).
Ansvar efter patch:
- original UI (video/canvas/sliders/buttons)
- nya mode-knappar: CORE / LAB / ASTRO
- panelcontainers för mod-funktioner
- script-ordning (viktig för gamla globala scripts)

---

## `frontend/styles/`

### `frontend/styles/styles.css`
Original SPECTRA-styles (placeholder nu).

### `frontend/styles/mod-panels.css`
Stilar för nya sidopaneler:
- mode-tabs
- subtraction-panel
- top-hits-panel
- preset-panel
- worker-status-indikator

### `frontend/styles/overlays.css`
Stilar/klassnamn för overlay-relaterad UI (legend, tag-badges, confidence färger).

### `frontend/styles/mobile-tweaks.css`
Mobilanpassningar för de nya panelerna utan att röra originalets layout för hårt.

---

## `frontend/languages/`

### `frontend/languages/en.json`
Engelska UI-strängar för mod-paneler och statusmeddelanden.

### `frontend/languages/sv.json`
Svenska UI-strängar för mod-paneler och statusmeddelanden.

---

## `frontend/assets/`

### `frontend/assets/icons/`
Ikoner för mode-knappar, status, overlays (placeholder via `.gitkeep`).

### `frontend/assets/presets/`
Valfria preset-ikoner/bilder (placeholder).

### `frontend/assets/examples/`
Exempelbilder/spektrum för demo/manualtest (placeholder).

---

## `frontend/data/` (engine7-aware bibliotek)

### `frontend/data/line_library_general_atomic.json`
Atomärt linjebibliotek (stort allmänt bibliotek).  
Används primärt i LAB och ASTRO line matching.

### `frontend/data/molecular_bands_general_v2.json`
Generellt molekylbandsbibliotek (v2 schema).

### `frontend/data/molecular_bands_v2_merged_from_legacy.json`
Sammanfogat molekylbandsbibliotek från äldre källor (v2-liknande schema).

### `frontend/data/molecular_species_catalog_v2.json`
Art-/molekylkatalog (metadata, alias, kategorier, taggar).

### `frontend/data/molecular_detection_presets_v1.json`
Presetregler för molekyldetektion (krav på flera band etc.).

### `frontend/data/molecular_sources_v1.json`
Källmetadata/proveniens/caveats för molekylbiblioteken.

### `frontend/data/astro_presets.json`
Frontend-presets för ASTRO-lägen (Sun/Star/Planet/DeepSky):
- filter
- smoothing
- continuum-inställningar
- analysintervall

### `frontend/data/lab_presets.json`
Frontend-presets för LAB-lägen (Hg/Ne/Ar/H/Na etc.).

### `frontend/data/library_manifest.json`
Samlad manifestfil för vilka bibliotek som ska laddas, versioner och checksummor (frontend-lokalt).

---

## `frontend/scripts/` (SPECTRA original — placeholders)

> Dessa ska ersättas med originalfiler från SPECTRA. Modden bygger ovanpå dem.

### `frontend/scripts/polynomialRegressionScript.js`
Polyfit-matte för px→nm-kalibrering.

### `frontend/scripts/zipScript.js`
Tredjeparts zip-lib (om originalet använder zip-export).

### `frontend/scripts/languageScript.js`
i18n-laddning via `?lang=` och `data-translate` attribut.

### `frontend/scripts/dataSavingScript.js`
Export av graf/kamerabild/XLSX.  
Senare kan modden hooka in metadata-export.

### `frontend/scripts/referenceGraphScript.js`
Referenskurvor och import från Excel.  
Patchas för att även kunna märka referens som subtraction/flat/reference.

### `frontend/scripts/imageLoadingScript.js`
Ladda bild(er), jämförelsekurvor, stripe-data från stillbilder.

### `frontend/scripts/setupScript.js`
Diverse init/UI-state för originalet.

### `frontend/scripts/cameraScript.js`
Kameraåtkomst, stream-start, exponering, stillbildssekvens (“recording”).

### `frontend/scripts/stripeScript.js`
Stripe-bredd / stripe-position / overlaylinje i kamerafönster.

### `frontend/scripts/cameraSelection.js`
Stripe-preview-canvas och kontinuerlig preview.

### `frontend/scripts/calibrationScript.js`
Kalibrering, polynomfit, px↔nm, residual/divergence-plot.  
Patchas för att exponera kalibreringsstate till modden.

### `frontend/scripts/graphScript.js`
**Hjärtat**: realtime spectrum från stripe-pixeldata + ritning i `graphCanvas`.  
Patchas för:
- export av senaste frame
- overlay-hook
- ev. pipeline-hook (LAB/ASTRO)

---

## `frontend/scripts/mod/` (nya moduler ovanpå SPECTRA)

### App-shell / state / integration

#### `frontend/scripts/mod/appMode.js`
Styr globalt mode:
- `CORE`, `LAB`, `ASTRO`
- emits mode change events
- default = CORE

#### `frontend/scripts/mod/stateStore.js`
Central state för moddelen:
- worker-status
- matches/top-hits
- processing settings
- dark/ref/flat buffers
- active presets
- analysis tick timing

#### `frontend/scripts/mod/uiPanels.js`
Bygger och kopplar UI för mod-paneler:
- mode-tabbar
- subtraction-kontroller
- presets
- top hits
- confidence/rv/status

#### `frontend/scripts/mod/eventBus.js`
Lätt pub/sub för att undvika att allt binds direkt mot globala variabler.

#### `frontend/scripts/mod/spectrumFrameAdapter.js`
Läser data från hookad `graphScript.js` och formar standardframe:
- `px[]`
- `nm[]` (om kalibrerad)
- `R[]`, `G[]`, `B[]`
- `I[]`
- metadata (zoom, source type, timestamp)

#### `frontend/scripts/mod/analysisWorkerClient.js`
Kommunikation med Web Worker:
- init worker
- skicka analysjobb med throttle (2–5 Hz)
- request-id / stale-result-hantering
- timeout/felstatus

#### `frontend/scripts/mod/overlays.js`
Ritar i grafen ovanpå originalkurvor:
- peak markers
- etiketter (species)
- band-spans
- offset/Doppler info
- confidence färgkodning

#### `frontend/scripts/mod/utils.js`
Generella hjälpfunktioner (formattering, clamp, debounce, rolling stats).

---

### Processing (LAB + ASTRO)

#### `frontend/scripts/mod/processingPipeline.js`
Orkestrerar analysförberedelse i rätt ordning:
1. normalize raw intensity
2. dark/ref/flat correction
3. absorbance/transmittance (vid behov)
4. continuum normalization (ASTRO)
5. smoothing
6. quick peaks (för UI)

#### `frontend/scripts/mod/subtraction.js`
Hanterar:
- capture dark
- capture reference
- capture flat
- matematik:
  - `raw-dark`
  - `raw/ref`
  - `(raw-dark)/(ref-dark)`
  - absorbans `-log10(I/I0)`

#### `frontend/scripts/mod/continuum.js`
Continuum-estimat för sol/stjärna:
- rolling median / low-order fit
- normalisering
- inversion för absorptionstoppar (så peaks blir “positiva” till worker)

#### `frontend/scripts/mod/smoothing.js`
Signalutjämning:
- median filter
- SG-lite (enkel Savitzky–Golay-liknande)
- användarstyrka/presetstyrka

#### `frontend/scripts/mod/normalization.js`
Olika normaliseringsstrategier:
- `I=max(R,G,B)`
- luminance
- channel-specific
- robust percentile normalization

#### `frontend/scripts/mod/quickPeaks.js`
Snabb och lätt peakdetect för UI-markering direkt i renderloopen (ej tung matchning).

#### `frontend/scripts/mod/flatField.js`
Instrumentrespons/flat correction (extra steg utöver vanlig referenssubtraktion).

---

### Kalibrering & presets

#### `frontend/scripts/mod/calibrationBridge.js`
Brygga mot originalets `calibrationScript.js`:
- läsa polykoefficienter
- läsa/skriva kalibreringspunkter
- residual-status till UI

#### `frontend/scripts/mod/calibrationPresets.js`
Kalibreringspresets:
- Hg/Ne/Ar
- Solar/Fraunhofer anchors
- H-alpha rig
- (ev) användarpresets lokalt sparade

#### `frontend/scripts/mod/presets.js`
Högre nivå-presets per arbetsflöde:
- LAB: emission-lampor, absorptionslabb
- ASTRO: Sun, Star, Planet, DeepSky
Översätter preset → UI + worker settings.

---

### Bibliotek & sök/filter

#### `frontend/scripts/mod/libraryClient.js`
Laddar JSON-filer från `frontend/data/`, bygger klientcache och exponerar filterbara subsets.

#### `frontend/scripts/mod/libraryFilters.js`
Tar UI-filter (checkboxar, context tags, species types) och bygger worker-vänligt filterobjekt.

#### `frontend/scripts/mod/speciesSearch.js`
Autocomplete/sökbox för species/molekyler/band:
- alias
- snabb filtrering
- highlight i overlay

---

### Session/export

#### `frontend/scripts/mod/sessionCapture.js`
Samlar sessionmetadata:
- inställningar
- kalibrering
- timestamps
- snapshots av top hits/QC
Bra för “instrumentlogg”-känsla.

#### `frontend/scripts/mod/exportAugment.js`
Hookar in i originalets exportflöde och lägger till:
- matches
- mode
- presets
- QC-noteringar
- offset/Doppler prelim

---

## `frontend/workers/` (lokal analysmotor)

### `frontend/workers/analysis.worker.js`
Worker entrypoint. Importerar router och startar message loop.

### `frontend/workers/workerRouter.js`
Routar meddelanden:
- `INIT_LIBRARIES`
- `ANALYZE_FRAME`
- `SET_PRESET`
- `QUERY_LIBRARY`
- `PING`

### `frontend/workers/workerTypes.js`
Konstanter/schema för message types och response shapes.

### `frontend/workers/workerState.js`
Worker-intern state:
- loaded libraries
- indices
- active preset
- caches
- last analysis info

### `frontend/workers/spectrumMath.js`
Låg-nivå matematik:
- normalization
- inversion
- derivatives
- window statistics
- safe log/ratio ops

### `frontend/workers/peakDetect.js`
Peak/valley detektion för emission/absorption inkl. platåhantering (viktig för mättnad).

### `frontend/workers/peakScoring.js`
Scorar peaks på prominens, kontrast, bredd, lokal kontext.

### `frontend/workers/autoMode.js`
Auto-detektion av emission/absorption (engine7-idé portad till workerlogik).

### `frontend/workers/offsetEstimate.js`
Robust global våglängds-offset från flera linjeträffar.

### `frontend/workers/dopplerEstimate.js`
Tolkar offset/linjeskift till preliminär radialhastighet och kvalitet.

### `frontend/workers/lineMatcher.js`
Matchar toppar mot atomlinjebibliotek med tolerans, filter och viktning.

### `frontend/workers/bandMatcher.js`
Matchar breda molekylband/bandheads (annan logik än smala linjer).

### `frontend/workers/templateMatcher.js`
Plats för framtida template/cross-correlation (Tyngre ASTRO-funktion).

### `frontend/workers/qcRules.js`
Domain rules/gating för att minska falska positiva, övermärkning och orimliga kombinationer.

### `frontend/workers/confidenceModel.js`
Bygger sammanlagd confidence från peak score + match score + QC + preset-fit.

### `frontend/workers/libraryLoader.js`
Schema-aware loader:
- atom-dict-schema
- flat-list schema
- molecular v2 schemas
- normaliserar allt till intern modell

### `frontend/workers/libraryIndex.js`
Indexerar bibliotek:
- våglängds-buckets
- species lookup
- context tags
- category/kind

### `frontend/workers/libraryQuery.js`
Query/filter mot index:
- by mode/preset
- by wavelength range
- by species/category/context

### `frontend/workers/presetResolver.js`
Översätter preset till konkret analyskonfiguration för worker pipeline.

### `frontend/workers/downsample.js`
Nedsampling för snabbare analys-tick på stora frames.

### `frontend/workers/analysisPipeline.js`
Hela workerkedjan:
1. preprocess
2. auto-mode / explicit mode
3. peaks
4. matching (line/band)
5. offset
6. qc/confidence
7. response payload

---

## `tests/`

### `tests/fixtures/sample_lab_spectrum.json`
Exempelframe för LAB-emissionstest.

### `tests/fixtures/sample_solar_spectrum.json`
Exempelframe för sol/absorption/continuumtest.

### `tests/fixtures/sample_molecular_band_spectrum.json`
Exempelframe för molekylband-test (ASTRO eller förbränningsspektrum).

### `tests/manual-test-checklist.md`
Manuell QA-checklista:
- CORE regression
- LAB subtract
- ASTRO presets
- overlay correctness
- export metadata

### `tests/test-worker-protocol.md`
Testfall för request/response mellan UI och worker.

### `tests/test-preset-mapping.md`
Testfall som verifierar att presets ger rätt filter och analysinställningar.

---

## Nästa steg (praktiskt)

1. **Kopiera in original-SPECTRA-filerna** över placeholders i `frontend/scripts/`, `frontend/pages/recording.html`, `frontend/styles/styles.css`.
2. Kopiera in dina riktiga engine7-bibliotek i `frontend/data/` (ersätt placeholder-filerna).
3. Zip:a repo och ladda upp här.
4. Jag patchar nästa steg i säker ordning (CORE först, sedan LAB/ASTRO hooks).

---

## Kort teknisk kommentar om “utan backend”

Det här upplägget gör att du slipper Python/backendberoenden men behåller instrumentkänslan:
- SPECTRA gör realtidsrenderingen (som den redan är bra på)
- Worker gör analyslogik i lugnare takt
- UI visar overlays/top hits/status

Det är samma orkester, bara med fler instrument och mindre serverdrama.
