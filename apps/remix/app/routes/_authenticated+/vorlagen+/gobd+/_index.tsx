import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { appMetaTags } from '~/utils/meta';

/**
 * GoBD-Hub — vormals PHP unter templates/vorlagen-index/gobd/index.php.
 * Migration zu Remix-Route, damit /vorlagen/gobd/ dieselbe App-Header-Navigation
 * nutzt wie der Rest der App. Eine Codebase, eine Nav.
 */

export function meta() {
  return appMetaTags(msg`GoBD-Archivierung`);
}

type Module = {
  badge: string;
  badgeColor?: 'primary' | 'warning';
  href?: string;
  titel: string;
  desc: string;
  cta: string;
  disabled?: boolean;
};

const MODULES: Module[] = [
  {
    badge: 'Wissen',
    href: '#was-ist-gobd',
    titel: 'Was ist GoBD?',
    desc: 'Einstieg für Nicht-Fachleute — was bedeutet GoBD, wen betrifft es, welche Fristen gelten.',
    cta: 'Zum Abschnitt',
  },
  {
    badge: 'Verantwortung',
    href: '#verantwortung',
    titel: 'NexaSign vs. Sie',
    desc: 'Klare Aufteilung: was deckt NexaSign technisch ab, was müssen Sie organisatorisch selbst regeln.',
    cta: 'Verantwortungs-Split',
  },
  {
    badge: 'Download',
    href: '/vorlagen/download/11-verfahrensdokumentation-gobd.md',
    titel: 'Verfahrensdokumentation',
    desc: 'GoBD-Pflichtdokument. Vorlage mit Platzhaltern — Steuerberater gegenprüfen lassen, dann ablegen.',
    cta: 'Vorlage laden',
  },
  {
    badge: 'Tool',
    href: '#export-tool',
    titel: 'Export-CLI',
    desc: 'Exportiert signierte Envelopes und das Audit-Log als ZIP-Paket für Z2-/Z3-Prüfzugriff.',
    cta: 'Nutzung',
  },
  {
    badge: 'Prüfung',
    href: '#zugriffsarten',
    titel: 'Finanzamt-Zugriffsarten',
    desc: 'Z1, Z2, Z3 — was bedeuten die Zugriffs-Szenarien und was liefert NexaSign dafür.',
    cta: 'Erklärung',
  },
  {
    badge: 'Geplant',
    badgeColor: 'warning',
    titel: 'WORM-Enforcement in der App',
    desc: 'Automatische Lösch-Sperre in der UI für signierte Envelopes — folgt in Phase 2.',
    cta: 'In Entwicklung',
    disabled: true,
  },
  {
    badge: 'Geplant',
    badgeColor: 'warning',
    titel: 'Retention-Cron (10 Jahre)',
    desc: 'Automatische Fristenkontrolle: keine Dokumente vor Ablauf der 10-Jahres-Pflicht löschen.',
    cta: 'In Entwicklung',
    disabled: true,
  },
  {
    badge: 'Geplant',
    badgeColor: 'warning',
    titel: 'SHA-256-Manifest',
    desc: 'Integritätsnachweis für jeden Export: unveränderte Hashes der Originale.',
    cta: 'In Entwicklung',
    disabled: true,
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Was ist WORM?',
    a: (
      <p>
        <strong>„Write Once Read Many"</strong> — Einmal geschriebene Dokumente können gelesen, aber
        nicht mehr geändert oder gelöscht werden (innerhalb der Aufbewahrungsfrist). Das ist das
        technische Fundament für Unveränderbarkeit nach § 146 Abs. 4 AO.
      </p>
    ),
  },
  {
    q: 'Was ist ein SHA-256-Hash?',
    a: (
      <p>
        Ein <strong>digitaler Fingerabdruck</strong> eines Dokuments — eine 64-stellige hexadezimale
        Zeichenkette, die eindeutig ist. Ändert sich auch nur ein Byte am Dokument, passt der Hash
        nicht mehr. Damit wird Unverändertheit mathematisch nachweisbar.
      </p>
    ),
  },
  {
    q: 'Was ist ein Audit-Log?',
    a: (
      <p>
        Ein Protokoll aller Ereignisse eines Dokuments: wer hat es erstellt, wer geöffnet, wer
        signiert, wann heruntergeladen. <em>Append-Only</em> heißt: Einträge können nur hinzugefügt
        werden, nicht gelöscht oder verändert.
      </p>
    ),
  },
  {
    q: 'Was bedeutet IDW PS 880 / IDW 951?',
    a: (
      <p>
        <strong>Prüfungsstandards des Instituts der Wirtschaftsprüfer</strong> für IT-Systeme (PS
        880) bzw. Dienstleister (PS 951). Darauf basieren formale „revisionssicher"-Testate. Eine
        solche Prüfung kostet typischerweise einen fünfstelligen Betrag und ist nur dann sinnvoll,
        wenn Sie das Testat gegenüber Kunden oder Aufsichtsbehörden formal nachweisen müssen.
      </p>
    ),
  },
  {
    q: 'Muss ich den Steuerberater einbeziehen?',
    a: (
      <p>
        Ja — spätestens bei der <strong>Verfahrensdokumentation</strong> und der jährlichen
        Integritätskontrolle. Die GoBD sind steuerliches Recht, und ein formal sauberes Setup ist
        Aufgabe von Buchhaltung und Steuerberatung. NexaSign liefert die Technik, Sie liefern die
        Prozess-Freigaben.
      </p>
    ),
  },
  {
    q: 'Darf NexaSign selbst sich „GoBD-konform" nennen?',
    a: (
      <p>
        Nein. NexaSign ist <strong>„GoBD-ready"</strong>: die technischen Funktionen sind da.
        „GoBD-konform" im juristischen Sinn wird erst Ihre konkrete Implementierung (Technik +
        Organisation + Verfahrensdokumentation). Für ein formales Testat wäre ein Wirtschaftsprüfer
        einzubeziehen.
      </p>
    ),
  },
];

export default function GoBDPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-10 pb-16 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        <Trans>GoBD-konforme Archivierung mit NexaSign</Trans>
      </h1>
      <p className="mt-3 max-w-3xl text-base text-muted-foreground">
        <Trans>
          Unterschriebene Verträge sind <strong>steuerrelevante Belege</strong> — das Finanzamt darf
          sie bis zu 10 Jahre später prüfen. Hier finden Sie alle Bausteine, die NexaSign für eine{' '}
          <strong>GoBD-orientierte Archivierung</strong> mitbringt: Erklärungen, Vorlagen, Tools,
          FAQ.
        </Trans>
      </p>

      {/* Module */}
      <h2 className="mt-12 border-b border-border pb-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
        <Trans>Bausteine</Trans>
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const cls = m.disabled
            ? 'flex flex-col gap-2 rounded-xl border-[1.5px] border-border bg-card p-6 opacity-55'
            : 'group flex flex-col gap-2 rounded-xl border-[1.5px] border-border bg-card p-6 no-underline transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md';
          const badgeCls =
            m.badgeColor === 'warning'
              ? 'self-start rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-amber-700'
              : 'self-start rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-primary';

          const inner = (
            <>
              <span className={badgeCls}>{m.badge}</span>
              <h3 className="mt-1 font-serif text-xl font-semibold tracking-tight text-foreground">
                {m.titel}
              </h3>
              <div className="flex-1 text-[0.93rem] leading-relaxed text-muted-foreground">
                {m.desc}
              </div>
              <div
                className={`mt-2 text-sm font-semibold ${
                  m.disabled ? 'text-muted-foreground' : 'text-primary'
                }`}
              >
                {m.cta}
                {!m.disabled && <span> →</span>}
              </div>
            </>
          );

          if (m.disabled) {
            return (
              <div key={m.titel} className={cls} title="In Entwicklung">
                {inner}
              </div>
            );
          }
          return (
            <a key={m.titel} href={m.href} className={cls}>
              {inner}
            </a>
          );
        })}
      </div>

      {/* Was ist GoBD */}
      <h2
        id="was-ist-gobd"
        className="mt-12 border-b border-border pb-2 font-serif text-2xl font-semibold tracking-tight text-foreground"
      >
        <Trans>Was ist GoBD überhaupt?</Trans>
      </h2>
      <p className="mt-3 leading-relaxed text-foreground">
        <Trans>
          GoBD steht für{' '}
          <strong>
            „Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und
            Unterlagen in elektronischer Form sowie zum Datenzugriff"
          </strong>{' '}
          — ein BMF-Schreiben aus dem Jahr 2019, das für alle deutschen Unternehmen verbindlich ist,
          die Bücher führen.
        </Trans>
      </p>
      <p className="mt-2 leading-relaxed text-foreground">
        <Trans>
          Kern: Wenn Sie <strong>steuerrelevante Dokumente</strong> (Rechnungen, Verträge,
          Handelsbriefe) digital erzeugen oder ablegen, müssen sie{' '}
          <strong>10 Jahre unveränderbar</strong> aufbewahrt und im Prüfungsfall dem Finanzamt
          zugänglich gemacht werden. Unterschriebene Verträge aus NexaSign fallen eindeutig unter
          diese Pflicht.
        </Trans>
      </p>

      {/* Verantwortung */}
      <h2
        id="verantwortung"
        className="mt-12 border-b border-border pb-2 font-serif text-2xl font-semibold tracking-tight text-foreground"
      >
        <Trans>Die Verantwortungs-Teilung</Trans>
      </h2>
      <p className="mt-3 leading-relaxed text-foreground">
        <Trans>
          GoBD-Konformität ist <strong>nie</strong> die Leistung eines einzelnen Tools. Sie entsteht
          aus dem Zusammenspiel von drei Elementen:
        </Trans>
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border-[1.5px] border-l-[4px] border-border border-l-emerald-600 bg-card p-5">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            ✅ <Trans>Was NexaSign liefert</Trans>
          </h3>
          <ul className="ml-5 mt-2 list-disc space-y-1 text-[0.94rem] leading-relaxed text-foreground">
            <li>
              <strong>Unveränderbare Ablage</strong> signierter PDFs mit kryptografischem Hash
            </li>
            <li>
              <strong>Append-Only Audit-Log</strong> — wer, was, wann, bei welchem Envelope
            </li>
            <li>
              <strong>Export-CLI</strong> <code>nexasign-gobd-export</code> für Z2/Z3-Prüfzugriff
            </li>
            <li>
              <strong>Verfahrensdokumentations-Vorlage</strong> zum Anpassen und Freigeben
            </li>
            <li>
              <strong>Rollen-/Rechte-Management</strong> (z. B. Nur-Lese-Konto für Steuerberater)
            </li>
            <li>
              <strong>TLS + DB-Verschlüsselung</strong> im Ruhezustand
            </li>
          </ul>
        </div>
        <div className="rounded-xl border-[1.5px] border-l-[4px] border-border border-l-amber-600 bg-card p-5">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            👤 <Trans>Was Sie selbst regeln</Trans>
          </h3>
          <ul className="ml-5 mt-2 list-disc space-y-1 text-[0.94rem] leading-relaxed text-foreground">
            <li>
              <strong>Verfahrensdokumentation</strong> schreiben, pflegen, freigeben lassen
            </li>
            <li>
              <strong>Datensicherung</strong> (Backups, Off-Site-Kopien, Wiederherstellungstests)
            </li>
            <li>
              <strong>Zugriffsrechte</strong> sauber nach Need-to-know vergeben
            </li>
            <li>
              <strong>Personalwechsel-Prozesse</strong> (Handover, Rechte-Entzug)
            </li>
            <li>
              <strong>Jährliche Integritätskontrollen</strong> (Hash-Vergleich, Test-Export)
            </li>
            <li>
              <strong>Optional:</strong> Wirtschaftsprüfer-Testat nach IDW PS 880 / IDW 951
            </li>
          </ul>
        </div>
      </div>

      {/* Zugriffsarten */}
      <h2
        id="zugriffsarten"
        className="mt-12 border-b border-border pb-2 font-serif text-2xl font-semibold tracking-tight text-foreground"
      >
        <Trans>Finanzamt-Zugriff: Z1, Z2, Z3</Trans>
      </h2>
      <p className="mt-3 leading-relaxed text-foreground">
        <Trans>Nach § 147 Abs. 6 AO kann das Finanzamt drei Arten von Datenzugriff fordern:</Trans>
      </p>
      <ul className="ml-5 mt-2 list-disc space-y-2 text-foreground">
        <li>
          <strong>Z1 — unmittelbarer Zugriff:</strong> Der/Die Prüfer/in loggt sich mit einem
          Nur-Lese-Konto direkt in die NexaSign-Instanz ein und sichtet Dokumente online.
        </li>
        <li>
          <strong>Z2 — mittelbarer Zugriff:</strong> Sie exportieren die angeforderten Dokumente in
          einem strukturierten Format; der/die Prüfer/in bekommt das Ergebnis.
        </li>
        <li>
          <strong>Z3 — Datenträgerüberlassung:</strong> Das Export-Paket wird auf einem
          verschlüsselten USB-Medium übergeben.
        </li>
      </ul>
      <p className="mt-3 leading-relaxed text-foreground">
        <Trans>
          <strong>Für Z2 und Z3</strong> liefert NexaSign das CLI-Tool{' '}
          <code>nexasign-gobd-export</code> — siehe nächster Abschnitt.
        </Trans>
      </p>

      {/* Export-Tool */}
      <h2
        id="export-tool"
        className="mt-12 border-b border-border pb-2 font-serif text-2xl font-semibold tracking-tight text-foreground"
      >
        <Trans>Export-CLI — </Trans>
        <code>nexasign-gobd-export</code>
      </h2>
      <p className="mt-3 leading-relaxed text-foreground">
        <Trans>
          Kommandozeilen-Tool für den System-Administrator. Exportiert alle abgeschlossen signierten
          Envelopes und das Audit-Log eines Zeitraums als strukturiertes Paket.
        </Trans>
      </p>
      <h3 className="mt-4 font-semibold text-foreground">
        <Trans>Nutzung</Trans>
      </h3>
      <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/40 px-4 py-3 font-mono text-sm leading-relaxed text-foreground">
        <code>{`sudo nexasign-gobd-export <VON> <BIS> <ZIEL-VERZEICHNIS>

# Beispiel — kompletter Zeitraum 2026:
sudo nexasign-gobd-export 2026-01-01 2026-12-31 /tmp/gobd-2026`}</code>
      </pre>
      <h3 className="mt-4 font-semibold text-foreground">
        <Trans>Inhalt des Export-Pakets</Trans>
      </h3>
      <ul className="ml-5 mt-2 list-disc space-y-1 text-foreground">
        <li>
          <code>envelopes.csv</code> — Metadaten aller signierten Envelopes (ID, Titel, Status,
          Zeitstempel)
        </li>
        <li>
          <code>audit-log.csv</code> — Vollständiger Audit-Trail im Zeitraum
        </li>
        <li>
          <code>README.md</code> — Beschreibung des Pakets und rechtlicher Kontext
        </li>
        <li>
          <code>nexasign-gobd-export_VON_BIS.zip</code> — alles zusammengefasst
        </li>
      </ul>
      <p className="mt-3 text-sm italic text-muted-foreground">
        <Trans>
          Aktueller Stand (Phase 1): Metadaten- und Audit-Export. PDF-Binary-Export aus der{' '}
          <code>DocumentData</code>-Tabelle und SHA-256-Manifest folgen in Phase 2.
        </Trans>
      </p>

      {/* FAQ */}
      <h2
        id="faq"
        className="mt-12 border-b border-border pb-2 font-serif text-2xl font-semibold tracking-tight text-foreground"
      >
        <Trans>Fachbegriffe & FAQ</Trans>
      </h2>
      <div className="mt-4 space-y-2">
        {FAQ.map((f) => (
          <details key={f.q} className="overflow-hidden rounded-lg border border-border bg-card">
            <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-foreground marker:hidden">
              {f.q}
            </summary>
            <div className="px-4 py-3 text-foreground [&_p]:leading-relaxed">{f.a}</div>
          </details>
        ))}
      </div>

      {/* Legal */}
      <div className="mt-10 rounded-lg border-l-[3px] border-primary bg-muted/40 px-5 py-4 text-[0.92rem] leading-relaxed text-foreground">
        <strong>⚖️ Rechtlicher Hinweis</strong>
        <br />
        <Trans>
          NexaSign stellt <strong>GoBD-orientierte Archivfunktionen</strong> zur Verfügung. Die
          GoBD-konforme Gesamtimplementierung (Technik + Organisation + Verfahrensdokumentation) in
          Ihrem Unternehmen verantworten Sie selbst. Diese Seite dient der Orientierung und ersetzt
          keine Rechts-, Steuer- oder Konformitäts-Beratung. Wir empfehlen die Abstimmung mit
          Ihrer/m Steuerberater/in, Datenschutzbeauftragten und — für formale Zertifizierungen — mit
          einer/m Wirtschaftsprüfer/in.
        </Trans>
        <br />
        <br />
        <Trans>
          NexaSign ist Open-Source (AGPL-3.0). Die Bereitstellung erfolgt ohne Gewährleistung.
        </Trans>
      </div>
    </div>
  );
}
