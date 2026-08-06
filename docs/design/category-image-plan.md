# Landing category image plan

The production taxonomy currently has eight shelves. Create one photograph per shelf; the table below is a production brief, not a category registry.

## Shared art direction

- Realistic, calm editorial photography in contemporary Southern African homes, clinics, roads, and workplaces.
- Warm natural light, subject-led colours, diverse local families and workers, and practical safety details; do not use the Safety Shelf brand palette or motifs.
- No other visible brands or readable text, watermarks, gore, fear-led imagery, or staged emergency drama.
- The only branding is `safety-shelf.co.za`, once in small legible text along the bottom edge.
- Compose the subject in the upper or right-hand two thirds. Keep the lower-left area quiet enough for the existing white title and description overlay.
- Generate at 1600 x 2000 (4:5). Keep the central 4:3 crop useful on desktop and mobile, then export WebP at roughly 200 KB or less.

## Required images

| Order | Category | Working filename | Scene brief |
| --- | --- | --- | --- |
| 1 | Pregnancy Care | `pregnancy-care.webp` | Pregnant Black woman and partner calmly preparing a clinic bag and antenatal card in a warm home; reassuring, capable, not medicalised. |
| 2 | New Born Care | `newborn-care.webp` | Parent settling a newborn into a clear, safe cot beside a softly lit bed; uncluttered sleep space and gentle family care. |
| 3 | Child Safety at Home | `child-safety-at-home.webp` | Caregiver and young child in a welcoming kitchen or living room with visible prevention details such as secured cupboards and covered sockets. |
| 4 | Road Safety for Children | `road-safety-for-children.webp` | Mother teaching two schoolchildren to stop, look, and listen from the pavement before using a zebra crossing in a recognisably South African neighbourhood. |
| 5 | Gender-based Violence | `gender-based-violence.webp` | Private, supportive conversation between two adult women in a calm community-support setting; dignity, agency, and a safe route to help, with no aggressor shown. |
| 6 | Emotional & Physical Abuse | `emotional-and-physical-abuse.webp` | Adult man speaking privately with an older male community counsellor on a quiet veranda; dignity, agency, and recovery rather than depicting harm. |
| 7 | Pregnancy & Disability Awareness | `pregnancy-and-disability-awareness.webp` | Pregnant wheelchair user consulting with an attentive Black midwife in an accessible clinic; eye-level collaboration and visible inclusive access. |
| 8 | Mine Health and Safety | `mine-health-and-safety.webp` | Diverse mine team completing a pre-shift safety check in clean PPE near an above-ground entrance; competence and prevention, not an incident. |

## Data-driven integration

- Do not add a slug-to-image map to the landing page. Categories and their presentation data must continue to come from `api.categories.list`.
- When the images are ready, add an optional Convex storage ID to each category row and have `categories.list` resolve it to a URL, following the existing book-cover storage pattern.
- Upload and attach each image to its production category record. Until a category has an image, the landing card keeps its database-provided icon fallback.
- Verify every card at narrow mobile and two-column desktop widths before release.

## Review status

Eight candidates were generated and approved on 2026-08-06 with the built-in image generation tool and saved under `docs/category-images/`. They are 1122 x 1402 WebP files. All eight were uploaded to Convex production and attached to their matching category rows; their resolved URLs returned HTTP 200 `image/webp` after attachment.

The original Road Safety candidate was removed and replaced during review with a curbside teaching scene; only the replacement remains at the canonical filename.
