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

## Revision 1 (2026-10-11): tested on a real InBody 270 sheet
A real phone photo of an InBody 270 sheet (from the user; kept out of the public repo) read **3 of 14 values correctly, with 2 wrong**, using line-by-line text:
- two columns share each text line, so the PBF line picked up a scale value from beside the BMR column and SMM picked up an impedance value
- chart scale ticks sit beside the values
- OCR splits numbers ("72. 4") and dates ("03. 04. 2026")

**New reader (`lib/inbodyScan.ts`):**
1. **Two OCR passes** (sparse text and automatic layout) on one worker; each reads different parts of the sheet well.
2. **Word positions instead of lines:** labels are found by chaining neighbouring words. The value is the number right of the label, in the same column (the right column starts at its headers), on the same row (after **deskewing** by the median text-line angle), preferring decimals over integer ticks, larger print, and never a known BMI/PBF tick or a reference range. History rows are ignored.
3. **Layout-specific:** score digits printed large below the label; "Level N" for visceral fat; the segmental **body figure** (InBody 270) read by position, with the centre line midway between the outermost values; the labelled segmental table (570/770), lean before fat.
4. **The sheet checks itself:** water + protein + minerals + fat = weight (±0.25 kg) confirms those four; PBF = fat ÷ weight and BMI = weight ÷ height² (printed height, else profile height) confirm a reading or are **calculated**; SMM must be 45–65% of fat-free mass.
5. **Status per value:** *from photo* (confirmed or agreed by two sources), *check* (one source), *calculated*, or empty.

**Result:** real InBody 270 photo **12/14 correct, 0 wrong** (right arm and trunk illegible at the photo's 1106 px width); tilted 570-style synthetic sheet **12/15, 0 wrong**. About 10 s for two passes on a Mac; slower on a phone.

**Privacy:** the user's sheet and its OCR output stay in the session's temporary folder. Unit tests use a synthetic layout with made-up values.

## Revision 2 (2026-10-11): body-figure close-up for InBody 270 sheets
The user confirmed their sheets use the InBody 270 format. Its segmental values sit on a **grey dotted body figure** that whole-page OCR can't read (right arm and trunk were missing).
- **Close-up read:** the figure's region (found from the page's headers) is cropped, enlarged 2× and turned **black and white at three cut-offs** (120/135/150), then read in two modes: 6 small reads on one worker. Plain enlargement made it worse, because it amplified the dots.
- **Voting:** candidates are rounded to the printed precision first (OCR reads "kg" as an extra digit, e.g. "3.211"). A value is *from photo* only when at least 2 reads agree **and** no rival has more than a third of its votes; otherwise *check*, with the rival offered as a one-tap "or …?" button.
- **Body proportions:** a trunk value below 1.8× (or above 4.5×) a leg value is rejected; this catches leg values that land on the centre line in a lopsided read.

**Result on the user's sheet:** **13/14 exact**; the trunk is shown as *check* with the true value offered one tap away ("or …?"). All 4 limbs and every main value were confirmed. About 15 s on a Mac (2 page reads + 6 close-ups); expect roughly 2–3× longer on a phone.
