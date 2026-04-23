# Anlage TOM — Technisch-organisatorische Maßnahmen (Art. 32 DSGVO)

> **Hinweis:** Diese Vorlage dient ausschließlich zur Orientierung und stellt keine Rechtsberatung dar. Die folgenden Maßnahmen sind an die konkreten Systeme und Risiken des Auftragsverarbeiters anzupassen. Generische TOMs genügen dem Rechenschaftsgrundsatz (Art. 5 Abs. 2 DSGVO) nicht.

Anlage zum Auftragsverarbeitungsvertrag zwischen {{verantwortlicher_name}} und {{auftragsverarbeiter_name}} vom {{datum_unterzeichnung}}.

## 1. Vertraulichkeit (Art. 32 Abs. 1 lit. b DSGVO)

### 1.1 Zutrittskontrolle
{{tom_zutrittskontrolle}}
Beispielmaßnahmen: Sicherheitszonen, Chipkarten-/PIN-Zugang, Besucherprotokolle, Alarmanlage, Videoüberwachung, verschlossene Serverräume.

### 1.2 Zugangskontrolle
{{tom_zugangskontrolle}}
Beispielmaßnahmen: individuelle Benutzerkonten, starke Passwortrichtlinie, Mehr-Faktor-Authentifizierung, automatische Sperre, Protokollierung fehlgeschlagener Anmeldeversuche.

### 1.3 Zugriffskontrolle
{{tom_zugriffskontrolle}}
Beispielmaßnahmen: rollenbasierte Berechtigungskonzepte (Least Privilege), regelmäßige Rechte-Reviews, Verschlüsselung von Datenträgern, kontrollierter Umgang mit mobilen Geräten.

### 1.4 Trennungskontrolle
{{tom_trennungskontrolle}}
Beispielmaßnahmen: Mandantentrennung auf Anwendungs- und Datenbankebene, getrennte Test-/Produktivsysteme, logische Trennung durch Zugriffsrechte.

### 1.5 Pseudonymisierung
{{tom_pseudonymisierung}}
Beispielmaßnahmen: Ersetzung direkter Identifikatoren durch Pseudonyme in Analysesystemen, getrennte Schlüsseltabellen.

## 2. Integrität (Art. 32 Abs. 1 lit. b DSGVO)

### 2.1 Weitergabekontrolle
{{tom_weitergabekontrolle}}
Beispielmaßnahmen: TLS 1.2+ für Datenübertragung, VPN für Fernzugriff, verschlüsselte E-Mail für sensible Daten, Dokumentation von Transferwegen.

### 2.2 Eingabekontrolle
{{tom_eingabekontrolle}}
Beispielmaßnahmen: vollständige Audit-Logs (Benutzer, Zeitpunkt, Änderung), manipulationssichere Protokollierung, regelmäßige Log-Reviews.

## 3. Verfügbarkeit und Belastbarkeit (Art. 32 Abs. 1 lit. b, c DSGVO)

### 3.1 Verfügbarkeitskontrolle
{{tom_verfuegbarkeitskontrolle}}
Beispielmaßnahmen: redundante Systeme, unterbrechungsfreie Stromversorgung (USV), Brandfrüherkennung, Klimatisierung, tägliche Backups mit Offsite-Lagerung.

### 3.2 Rasche Wiederherstellbarkeit
{{tom_wiederherstellbarkeit}}
Beispielmaßnahmen: dokumentierter Notfallplan (BCM/DR), definiertes RPO/RTO, regelmäßige Wiederherstellungstests.

## 4. Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d DSGVO)

### 4.1 Datenschutz-Management
{{tom_ds_management}}
Beispielmaßnahmen: benannter Datenschutzbeauftragter, dokumentiertes Verarbeitungsverzeichnis, jährliche Schulungen, Richtlinien und Verfahrensanweisungen.

### 4.2 Incident-Response-Management
{{tom_incident_response}}
Beispielmaßnahmen: dokumentierter Meldeprozess, 24h-Meldefrist an Verantwortlichen, Nachverfolgung und Ursachenanalyse.

### 4.3 Auftragskontrolle
{{tom_auftragskontrolle}}
Beispielmaßnahmen: sorgfältige Auswahl von Unterauftragsverarbeitern, vertragliche Verpflichtung, regelmäßige Kontrollen (z. B. durch Zertifikate).

### 4.4 Zertifizierungen / Audits
{{tom_zertifizierungen}}
Beispiele: ISO/IEC 27001, SOC 2 Typ II, BSI C5, TISAX.

## 5. Genehmigte Unterauftragsverarbeiter (Stand: {{datum_unterzeichnung}})

| Unterauftragsverarbeiter | Sitz | Zweck / Leistung | Drittlandtransfer? |
|---|---|---|---|
| {{unterauftragsverarbeiter_1_name}} | {{unterauftragsverarbeiter_1_sitz}} | {{unterauftragsverarbeiter_1_zweck}} | {{unterauftragsverarbeiter_1_drittland}} |
| {{unterauftragsverarbeiter_2_name}} | {{unterauftragsverarbeiter_2_sitz}} | {{unterauftragsverarbeiter_2_zweck}} | {{unterauftragsverarbeiter_2_drittland}} |
| {{unterauftragsverarbeiter_3_name}} | {{unterauftragsverarbeiter_3_sitz}} | {{unterauftragsverarbeiter_3_zweck}} | {{unterauftragsverarbeiter_3_drittland}} |

Weitere Zeilen nach Bedarf ergänzen. Änderungen an dieser Liste sind dem Verantwortlichen gemäß § 5 Abs. 2 AV-Vertrag mitzuteilen.

---

**Stand der TOM:** {{datum_unterzeichnung}}  
**Nächste Überprüfung:** jährlich, spätestens bis {{naechste_tom_pruefung}}
