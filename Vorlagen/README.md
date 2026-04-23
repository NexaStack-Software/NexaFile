# Vorlagen-Kern (DE) — 10 Start-Templates

Schlanke, pragmatische Vertragsmuster nach deutschem Recht (BGB / HGB / TzBfG / DSGVO / RDG). Alle Dateien sind reines Markdown mit Mustache-Platzhaltern (`{{feld_name}}`), direkt importierbar in NexaSign / NexaSign.

## Rechtlicher Hinweis

Diese Vorlagen dienen ausschließlich zur Orientierung und stellen **keine Rechtsberatung** im Sinne des Rechtsdienstleistungsgesetzes (RDG) dar. Für die rechtliche Wirksamkeit im Einzelfall wird keine Haftung übernommen. Vor produktiver Verwendung ist eine Prüfung durch eine zugelassene Rechtsanwältin oder einen zugelassenen Rechtsanwalt dringend empfohlen. Die Verwendung erfolgt auf eigenes Risiko.

## Dateiübersicht

| # | Datei | Zweck |
|---|---|---|
| 1 | `01-nda-einseitig.md` | NDA einseitig — Bewerber, Partnergespräche |
| 2 | `02-nda-gegenseitig.md` | NDA gegenseitig — B2B-Verhandlungen |
| 3 | `03-freelancer-werkvertrag.md` | Freelancer / Werkvertrag |
| 4 | `04-arbeitsvertrag-unbefristet.md` | Festanstellung |
| 5 | `05-arbeitsvertrag-befristet.md` | Befristung mit/ohne Sachgrund (TzBfG) |
| 6 | `06-av-vertrag-dsgvo.md` | Auftragsverarbeitung Art. 28 DSGVO |
| 6a | `06a-tom-anhang.md` | Anlage TOM (zu AV-Vertrag) |
| 7 | `07-beratungsvertrag.md` | Consulting / Coaching |
| 8 | `08-aufhebungsvertrag.md` | Einvernehmliche Beendigung |
| 9 | `09-angebotsannahme.md` | Auftragsbestätigung |
| 10 | `10-agb-zustimmung.md` | AGB-Zustimmung (Registrierung, Rollout) |

## Platzhalter-Konvention

Alle Platzhalter im Format `{{snake_case}}`. Beim Template-Import in NexaSign / NexaSign werden diese als Signatur- oder Textfelder erkannt.

### Gemeinsame Platzhalter

| Platzhalter | Bedeutung |
|---|---|
| `{{partei_a_name}}` | Vollständiger Name/Firma Partei A (üblicherweise Auftraggeber/Arbeitgeber/Offenlegende Partei) |
| `{{partei_a_anschrift}}` | Straße, PLZ, Ort |
| `{{partei_a_vertreter}}` | Gesetzlicher Vertreter (z. B. Geschäftsführer) |
| `{{partei_a_registergericht}}` | Handelsregister-Gericht + HRB-Nummer |
| `{{partei_b_name}}` | Vollständiger Name/Firma Partei B |
| `{{partei_b_anschrift}}` | Straße, PLZ, Ort |
| `{{partei_b_vertreter}}` | Gesetzlicher Vertreter |
| `{{partei_b_registergericht}}` | HR-Eintrag |
| `{{ort_unterzeichnung}}` | Ort der Unterzeichnung |
| `{{datum_unterzeichnung}}` | Datum (TT.MM.JJJJ) |
| `{{gerichtsstand}}` | z. B. „Berlin" |
| `{{anwendbares_recht}}` | Standard: „Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts" |

### Spezifische Platzhalter
Dokument-spezifische Felder sind im jeweiligen Header der Vorlage dokumentiert.

## Nutzung im NexaSign-Template-Flow

1. Vorlage (`.md`) in NexaSign-Template-Bibliothek importieren
2. Platzhalter werden automatisch als befüllbare Felder erkannt
3. Unterschriftenfelder (`__________________________`) als Signatur-Anker belegen
4. Template veröffentlichen → Endnutzer füllt aus und signiert

## Erweiterung später

Nicht im 10er-Kern, aber sinnvolle Folgevorlagen: Gewerbemietvertrag, Handelsvertretervertrag, Praktikumsvertrag, Softwarelizenzvertrag, Vertraulichkeits- und Wettbewerbsverbotsabrede (eigenständig), Abfindungsvereinbarung.
