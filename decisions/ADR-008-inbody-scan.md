# ADR-008: InBody sheet scan

- **Date:** 2026-10-11
- **Status:** Accepted (user chose option B)
- **Roadmap item:** Phase 3: body composition (user request, ideas #12)

## Context
The user wants to add InBody results (body composition) by photographing the printed sheet. This is health data. It must run in the PWA with no app store.

## Options
| | A: Manual entry | B: On-device OCR | C: Vision AI via backend |
|---|---|---|---|
| What | A form for the InBody values | Tesseract.js reads the photo on the phone, then the form is shown for review | An AI model reads the photo through a server function |
| Pros | Exact, private, simple | Private, offline, free | Most accurate across layouts and languages |
| Cons | 10–15 numbers to type | Dense sheets confuse OCR; about 7 MB download on first scan | Sends health data to a third party; needs the backend and API key; about $0.01 per scan |
| Works without app store? | ✅ | ✅ | ✅ (needs a server) |
| Effort / cost | S, free | M, free | M–L, small cost, blocked |

## Decision
**B, with A as the review and fallback** (the user's choice).
- **OCR:** Tesseract.js 7 (LSTM, English `best_int` model) is self-hosted in `public/ocr`, copied from node_modules at build time, and cached by the service worker on first use. The photo is made upright, resized to a 2400 px long side, and turned grayscale with a 2–98% contrast stretch. Tesseract reads it as one block (PSM 6) so each label stays on its value's line.
- **Parser** (`lib/inbody.ts`): finds each value by its printed label and takes the first plausible number on the rest of that line. It ignores normal ranges ("(55.8~75.4)"). Lines with 5 or more numbers are bar charts, so it reads from the end. If a whole number appears where decimals are expected ("311" for 3.11), it restores the decimal point and marks the value **check**. Values outside human ranges are dropped. Weight, body fat mass and PBF are cross-checked. Pound sheets are converted to kg. The test date is read when printed.
- **Review is mandatory:** every value is shown as "from photo", "check" (hard to read) or empty "not found". Out-of-range values block Save.
- **Stored:** values only (IndexedDB `bodyComps`, DB v5, in export and Delete all). The photo stays in memory for comparison and is never saved or sent.

## Consequences
- Accuracy on real sheets is not yet known. A synthetic InBody-570-style photo read 15/15 values correctly, with two decimal points recovered and flagged. Real sheets (InBody 270/770, other languages, glare, curled paper) need testing with a real photo and parser tuning.
- English only for now. Adding languages means more model files (each about 1–15 MB).
- Revisit (option C) if real-sheet accuracy is poor and the backend exists, with explicit consent for sending the photo.
