# Verfahrensdokumentation — GoBD-konforme Archivierung digital signierter Dokumente

> **Hinweis:** Diese Vorlage dient als Orientierungshilfe und stellt keine
> Rechtsberatung i.S.d. RDG dar. Für die rechtliche Wirksamkeit im Einzelfall
> wird keine Haftung übernommen. Bitte vor Verwendung durch Ihre/n
> Steuerberater/in und/oder Datenschutzbeauftragte/n prüfen lassen.

---

## 1. Unternehmen und Verantwortlichkeiten

| Feld | Inhalt |
|---|---|
| **Unternehmen** | {{unternehmen_name}} |
| **Anschrift** | {{unternehmen_anschrift}} |
| **Handelsregister** | {{unternehmen_handelsregister}} |
| **Steuernummer** | {{unternehmen_steuernummer}} |
| **Verfahrensverantwortliche/r** | {{verantwortlicher_name}} |
| **Rolle** | {{verantwortlicher_rolle}} |
| **Datenschutzbeauftragte/r** | {{dsb_name}} |
| **Steuerberater/in** | {{stb_name}} |
| **Dokument-Version / Stand** | {{version}}, {{stand_datum}} |

## 2. Gegenstand des Verfahrens

Dieses Verfahren beschreibt die **elektronische Archivierung digital signierter Dokumente**, die über die Plattform **NexaSign** (auf Basis von NexaSign, AGPL-3.0) erzeugt werden. Zweck ist die Einhaltung der **GoBD** (Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form sowie zum Datenzugriff, BMF-Schreiben vom 28.11.2019) sowie der Aufbewahrungsfristen nach **§ 147 AO** und **§ 257 HGB**.

## 3. Betroffene Dokumentarten

Unter dieses Verfahren fallen insbesondere:

- Verträge mit Kunden, Lieferanten, Partnern (steuerlich relevant gem. § 147 Abs. 1 Nr. 2 AO)
- Auftragsverarbeitungs-Verträge nach Art. 28 DSGVO
- Arbeits-, Aufhebungs- und Beratungsverträge
- Handelsbriefe in elektronischer Form (§ 257 Abs. 1 Nr. 2, 3 HGB)

Nicht unter dieses Verfahren fallen: reine interne Kommunikation ohne steuerliche Relevanz.

## 4. Technische Umsetzung

### 4.1 Plattform

- **NexaSign / NexaSign** als Signatur- und Ablage-System
- Hostingstandort: {{hosting_standort}}
- Zugangssicherung: TLS 1.2+, Passwort + 2FA, Rollen- und Rechte-Management

### 4.2 Unveränderbarkeit (§ 146 Abs. 4 AO)

- Signierte PDFs werden nach Abschluss des Signatur-Vorgangs **mit einem kryptografischen Hash (SHA-256)** versehen und in der Datenbank gespeichert.
- Das Bearbeiten oder Löschen abgeschlossener Signatur-Vorgänge durch Endanwender ist **systemseitig ausgeschlossen**.
- Audit-Log-Einträge sind revisionsfest verkettet (Append-Only).

### 4.3 Vollständigkeit und Ordnung

- Jedem Dokument wird eine eindeutige ID zugewiesen.
- Metadaten (Parteien, Datum, Signatur-Status, Audit-Trail) werden in der Datenbank gespeichert und mit dem PDF verknüpft.
- Eine **Export-Funktion** (NexaSign-Admin-CLI `nexasign-gobd-export`) erzeugt für einen frei wählbaren Zeitraum ein ZIP-Paket mit Dokumenten, Audit-Log (CSV), Hash-Manifest und Verfahrensdokumentation.

### 4.4 Aufbewahrungsfrist

- Mindestens **10 Jahre** (beginnend mit Schluss des Kalenderjahres, in dem das Dokument entstand) gem. § 147 Abs. 3 AO.
- Das System ist so konfiguriert, dass ein Löschen vor Ablauf der Frist ausgeschlossen ist (WORM-Prinzip).

### 4.5 Datensicherung

- **{{backup_strategie}}** (z. B. „tägliches verschlüsseltes Backup via borgbackup auf getrennten Speicher", „wöchentliche Vollsicherung, georedundant")
- Wiederherstellungs-Tests: {{recovery_test_rhythmus}} (empfohlen: mindestens jährlich)
- Wiederherstellungs-Verantwortliche/r: {{recovery_verantwortlicher}}

### 4.6 Datenzugriff für Betriebsprüfung (§ 147 Abs. 6 AO)

- **Z1** (unmittelbarer Zugriff): Prüfer/in erhält ein temporäres Nur-Lese-Konto
- **Z2** (mittelbarer Zugriff): Export über `nexasign-gobd-export` als strukturiertes Paket
- **Z3** (Datenträger): Selbes Export-Paket auf verschlüsseltem USB-Medium

## 5. Organisatorische Umsetzung

### 5.1 Rollen und Rechte

| Rolle | Zugriff |
|---|---|
| Geschäftsführung / Inhaber/in | Vollzugriff, Export-Freigabe |
| Finanzbuchhaltung / StB-Kontakt | Lesezugriff, Export |
| Admin (IT) | Systemkonfiguration, kein Zugriff auf Vertragsinhalte |
| Endanwender/innen | Eigene Dokumente, keine Archiv-Löschung |

### 5.2 Verfahren bei Personalwechsel

{{personalwechsel_verfahren}}

### 5.3 Regelmäßige Kontrollen

- **Jährlich**: Vollständigkeits- und Integritätsprüfung (Hash-Vergleich)
- **Bei Bedarf**: Test-Export für Prüfungs-Szenario
- Ergebnisse werden protokolliert und 10 Jahre aufbewahrt.

## 6. Mitgeltende Unterlagen

- AGPL-3.0-Lizenz des NexaSign / NexaSign
- DSGVO-Verarbeitungsverzeichnis (Art. 30 DSGVO)
- Auftragsverarbeitungs-Vertrag mit dem Hosting-Dienstleister
- IT-Sicherheitsrichtlinie des Unternehmens

## 7. Änderungshistorie

| Version | Datum | Änderung | Freigabe |
|---|---|---|---|
| 1.0 | {{stand_datum}} | Erstellung | {{verantwortlicher_name}} |

---

## 8. Rechtlicher Hinweis

Diese Verfahrensdokumentation ist eine **Vorlage zur Orientierung**. Die GoBD-Konformität eines konkreten Einsatzes hängt vom Zusammenspiel aus:
1. **Technischer Basis** (NexaSign liefert die GoBD-ready Funktionen)
2. **Organisation und Prozessen** (durch Ihr Unternehmen umgesetzt)
3. **Dieser Verfahrensdokumentation** (von Ihnen ausgefüllt, freigegeben, gepflegt)
4. **Regelmäßiger Kontrollen und Nachweise**

Ein bestandener NexaSign-Einsatz ersetzt **kein** Wirtschaftsprüfer-Testat nach **IDW PS 880** oder **IDW 951**. Für ein solches Testat ist der Gesamt-Einsatz (Technik + Organisation + Dokumentation) durch eine/n Wirtschaftsprüfer/in zu prüfen.

Bereitgestellt als Open-Source-Vorlage durch **NexaStack** — CC-BY 4.0.

---

**{{ort_unterzeichnung}}, {{datum_unterzeichnung}}**

__________________________
{{verantwortlicher_name}} ({{verantwortlicher_rolle}})
