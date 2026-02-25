## Manual test checklist — CORE freeze gate (pre-LAB)

This checklist is the **minimum** validation required before starting Phase 2 (LAB).

### 0) Clean run
- [ ] Hard refresh (no cache). No blocking popups.
- [ ] Open DevTools console: **no recurring errors**.

### 1) Camera & stripe
- [ ] Start camera. Video shows.
- [ ] Move stripe position/width. Stripe overlay updates.
- [ ] Stop camera. UI remains responsive.

### 2) Graph basics
- [ ] Graph updates continuously from live camera stripe.
- [ ] Toggle RGB / Combined. Graph responds.
- [ ] Toggle X labels (px/nm). Works (nm depends on calibration).
- [ ] Peaks toggle works.
- [ ] Reset zoom works.
- [ ] Step back/left/right works.

### 3) PRO display overrides (Phase 1.5)
- [ ] Display mode: Normal / Difference / Ratio / Transmittance / Absorbance.
  - [ ] When reference is missing, modes safely fall back (no crash).
- [ ] Y-axis mode: Auto / Fixed 255 / Manual.
  - [ ] Manual Y max affects scaling.
- [ ] Fill mode: Inherit / Off / Synthetic / Source.
  - [ ] Fill opacity slider affects fill.
- [ ] Peak controls: threshold / distance / smoothing.
  - [ ] Values are editable and affect peaks.

### 4) Status / Data Quality
- [ ] Status values change while camera/graph runs.
- [ ] Data Quality shows non-zero saturation when clipping is obvious.
- [ ] No UI jitter or freeze during updates.

### 5) Dock hide/show
- [ ] Hide left panel. Restore it.
- [ ] Hide bottom drawer. Restore it (expand button remains clickable).

### 6) Calibration (Original + PRO Bridge)
- [ ] Original calibration workflow still works.
- [ ] PRO Calibration I/O:
  - [ ] Export points (shell).
  - [ ] Import points (shell) (JSON/CSV).
  - [ ] Apply shell → original calibration fields.
  - [ ] Apply triggers original calibration update.

### 7) Export
- [ ] Export numeric data works.
- [ ] Export images works.

### 8) Worker controls (non-blocking)
- [ ] Ping worker gives feedback (even if worker unavailable).
- [ ] Init libraries gives feedback (even if worker unavailable).
- [ ] Probe camera gives feedback.

### Pass criteria
All CORE items above must be **passable without hacks**.

Notes:
- If an item fails, log it in `FunctionSpec.md` under **Known risks / regressions**.
- Do not start LAB until CORE is stable; LAB debugging becomes painful otherwise.