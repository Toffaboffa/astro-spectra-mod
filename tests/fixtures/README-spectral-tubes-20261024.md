# Spectral tubes, 2026-10-24: real-export regression pack

This fixture records **all detected peaks** from seven user-supplied SPECTRA PRO
v1.4.1 JSON exports (from the ZIPs created on 2026-10-24). Each row stores the
reported peak pixel index, *fitted* wavelength (0.0001 nm) and prominence
(rounded to 0.001, not claimed measurement precision). The fixture also carries
calibration anchors, full wavelength coverage, original winner/score share,
1280-point array length, original analysis filename and its full SHA-256.

**Not a raw-trace fixture:** it intentionally does not embed the original
1280-point RGB/intensity arrays or images. A SHA-256 cannot recreate the data.
The seven original export ZIPs remain the authoritative raw measurements. The
production fingerprints are replayed from *measured peaks*, not synthetic
spectral intensities or a new camera read. This covers scoring/evidence
regressions but NOT stripe extraction, calibration fitting, smoothing, peak
detection from raw pixels, UI or AI interpretation. For end-to-end validation,
import the source ZIP's image/JSON and compare the whole path separately.

## Provenance and labels

| Export time | User's tube | Label status | Exported Best Match | Detected peaks |
|---|---|---|---|---:|
| 20:14:43 | N2 | user reported | N2 | 45 |
| 20:38:04 | H | user reported | H | 3 |
| 20:41:12 | probably O2 | **TENTATIVE** | CO2 | 36 |
| 20:43:19 | Ne | user reported | Ne | 20 |
| 20:44:18 | H | user reported | H | 4 |
| 20:46:50 | probably O2 | **TENTATIVE** | CO2 | 18 |
| 21:10:00 | Hg | user reported | Hg | 6 |

These are observations, not a validated blinded accuracy study. The CO2
discharge hypothesis cannot be ruled out just from the user saying "probably O2".
Do not train the classifier to force O2 from this label.

## Issues to resolve after Step 1

1. **H-alpha:** both spectra show a strong 654.4396 / 654.4333 nm peak, close to
   H-alpha at 656.281 nm. Their residuals exceed the current 1.8 nm accepted
   cap by about 0.04–0.05 nm. A 3 nm confirmation pass detects the line,
   but it is absent from accepted evidence. Preserve strict identity safeguards;
   distinguish a calibrated *possible match* from a confirmed match.
2. **O2/CO2:** both tentatively labeled O2 spectra have prominent features near
   774.78/774.92 nm (near O I 777.35 nm) and 844.33/844.30 nm (O I 844.65 nm).
   The former exceeds the 1.8 nm cap. The O2 profile currently requires
   762 nm molecular evidence; CO2 simultaneously receives matches against its
   451/483/520/561 nm CO-band anchors. Those bands must be evaluated, not simply
   ignored. Atomic O evidence alone must not be promoted to proof of O2 parent gas.
3. **Calibration:** strong O I 845-nm evidence is located beyond the final
   calibration anchor at px 1110 / 837.76 nm. Do not treat zero calibration-fit
   residual with three anchors/quadratic fit as independent accuracy proof.
4. **Candidate qualification:** a low *score share* is not a probability of
   the source gas. Extend the evidence-sufficiency gate to molecular candidates.
5. **Peak-center anomalies:** some low-prominence reported fitted feature
   centers are not monotonic with their pixel indices. Future verification
   should compare fitted centers with the **original calibrated nm grid**
   before inferring a calibration error from the fitted centers alone.

CI executes:
`node tests/spectral_tube_real_exports_regression.test.cjs`

The suite asserts immutable provenance and measured evidence, replays the
production atomic/molecular fingerprint scorers, and registers unresolved
scientific requirements as TODO tests. **It deliberately does not assert that
an existing misclassification must remain broken.** Turn each TODO into a
passing acceptance test when its implementation is delivered in later steps.
