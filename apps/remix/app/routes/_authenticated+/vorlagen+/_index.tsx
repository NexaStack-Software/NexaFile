import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { appMetaTags } from '~/utils/meta';

/**
 * Vorlagen-Übersicht — vormals PHP unter templates/vorlagen-index/index.php.
 * Migration zu Remix-Route, damit /vorlagen/ dieselbe App-Header-Navigation
 * nutzt wie /find-documents, /documents, /inbox etc. Eine Codebase, eine Nav.
 *
 * Die einzelnen Generator-Seiten (/vorlagen/av-vertrag/, /vorlagen/x-rechnung/, …)
 * bleiben PHP-FPM-Routes — die enthalten tiefe PDF/ZUGFeRD-Pipeline-Logik, die
 * nicht trivial in Remix portierbar ist. Klick auf eine Karte hier verlinkt
 * weiterhin auf die PHP-Seite, ist also harter Page-Reload.
 */

type VorlagenItem = {
  slug: string;
  badge: string;
  titel: string;
  desc: string;
  href: string;
  cta: string;
};

const VORLAGEN: VorlagenItem[] = [
  {
    slug: 'av-vertrag',
    badge: 'Generator',
    titel: 'AV-Vertrag nach Art. 28 DSGVO',
    desc: 'Auftragsverarbeitungs-Vertrag für jedes B2B-SaaS. 14 Felder ausfüllen, fertig unterschriftsreifes PDF mit TOM-Anhang und Unterauftragsverarbeiter-Liste.',
    href: '/vorlagen/av-vertrag/',
    cta: 'Generator starten',
  },
  {
    slug: 'x-rechnung',
    badge: 'Generator',
    titel: 'X-Rechnung / ZUGFeRD-Generator',
    desc: 'E-Rechnungspflicht ab 2025: Ihr Rechnungs-PDF + Strukturdaten → PDF/A-3 mit eingebettetem EN 16931 XML (ZUGFeRD Comfort). B2B-pflichtkonform im Empfang beim Kunden.',
    href: '/vorlagen/x-rechnung/',
    cta: 'Generator starten',
  },
  {
    slug: 'nda-einseitig',
    badge: 'Generator',
    titel: 'NDA — einseitig',
    desc: 'Vertraulichkeitsvereinbarung, wenn nur eine Partei offenlegt (Bewerbungen, Partnergespräche).',
    href: '/vorlagen/nda-einseitig/',
    cta: 'Generator starten',
  },
  {
    slug: 'nda-gegenseitig',
    badge: 'Generator',
    titel: 'NDA — gegenseitig',
    desc: 'Wechselseitige Vertraulichkeit für echte B2B-Verhandlungen.',
    href: '/vorlagen/nda-gegenseitig/',
    cta: 'Generator starten',
  },
  {
    slug: 'freelancer-werkvertrag',
    badge: 'Generator',
    titel: 'Freelancer- / Werkvertrag',
    desc: 'Projektarbeit mit freien Mitarbeitenden — inkl. Nutzungsrechte und Abnahme.',
    href: '/vorlagen/freelancer-werkvertrag/',
    cta: 'Generator starten',
  },
  {
    slug: 'arbeitsvertrag-unbefristet',
    badge: 'Generator',
    titel: 'Arbeitsvertrag — unbefristet',
    desc: 'Festanstellung nach deutschem Arbeitsrecht. Nachweisgesetz-konform.',
    href: '/vorlagen/arbeitsvertrag-unbefristet/',
    cta: 'Generator starten',
  },
  {
    slug: 'arbeitsvertrag-befristet',
    badge: 'Generator',
    titel: 'Arbeitsvertrag — befristet',
    desc: 'Befristung nach TzBfG, mit oder ohne Sachgrund.',
    href: '/vorlagen/arbeitsvertrag-befristet/',
    cta: 'Generator starten',
  },
  {
    slug: 'beratungsvertrag',
    badge: 'Generator',
    titel: 'Beratungsvertrag',
    desc: 'Consulting, Coaching, Strategieberatung — inkl. Vergütung und Vertraulichkeit.',
    href: '/vorlagen/beratungsvertrag/',
    cta: 'Generator starten',
  },
  {
    slug: 'aufhebungsvertrag',
    badge: 'Generator',
    titel: 'Aufhebungsvertrag',
    desc: 'Einvernehmliche Beendigung eines Arbeitsverhältnisses inkl. Abfindungs-Platzhalter.',
    href: '/vorlagen/aufhebungsvertrag/',
    cta: 'Generator starten',
  },
  {
    slug: 'angebotsannahme',
    badge: 'Generator',
    titel: 'Angebotsannahme / Auftragsbestätigung',
    desc: 'Standard-Geschäftsabschluss nach BGB-Angebotsannahme.',
    href: '/vorlagen/angebotsannahme/',
    cta: 'Generator starten',
  },
  {
    slug: 'agb-zustimmung',
    badge: 'Generator',
    titel: 'AGB-Zustimmung',
    desc: 'Für Online-Registrierung oder Software-Rollout im Unternehmen.',
    href: '/vorlagen/agb-zustimmung/',
    cta: 'Generator starten',
  },
];

export function meta() {
  return appMetaTags(msg`Vorlagen`);
}

export default function VorlagenIndex() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        <Trans>Vertragsvorlagen für deutsche Unternehmen</Trans>
      </h1>
      <p className="mt-3 max-w-3xl text-base text-muted-foreground">
        <Trans>
          11 pragmatische, rechtlich solide Vorlagen nach BGB / HGB / TzBfG / DSGVO. Jede Vorlage
          als geführter Generator: Felder ausfüllen, PDF erzeugen, in NexaFile hochladen und
          signieren. Die Markdown-Rohvorlagen bleiben zusätzlich auf den Generator-Seiten verlinkt.
        </Trans>
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {VORLAGEN.map((v) => (
          <a
            key={v.slug}
            href={v.href}
            className="group relative flex flex-col gap-2 rounded-xl border-[1.5px] border-primary bg-card p-6 text-card-foreground no-underline transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="absolute right-4 top-4 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-primary-foreground">
              {v.badge}
            </span>
            <div className="mt-1 max-w-[calc(100%-5rem)] font-serif text-xl font-semibold tracking-tight text-foreground">
              {v.titel}
            </div>
            <div className="flex-1 text-[0.92rem] leading-relaxed text-muted-foreground">
              {v.desc}
            </div>
            <div className="mt-3 border-t border-border pt-3 text-sm font-semibold text-primary">
              {v.cta}
              <span className="inline-block transition-[margin] group-hover:ml-1.5"> →</span>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10 rounded-lg border-l-[3px] border-primary bg-muted/40 px-5 py-4 text-[0.92rem] leading-relaxed text-foreground">
        <strong className="text-foreground">⚖️ Rechtlicher Hinweis</strong>
        <br />
        <Trans>
          Diese Vorlagen dienen zur <strong>Orientierung</strong> und stellen keine Rechtsberatung
          i.S.d. Rechtsdienstleistungsgesetzes dar. Vor produktiver Verwendung bitte durch
          zugelassene/n Rechtsanwältin/-anwalt prüfen lassen. Die Nutzung erfolgt auf eigenes
          Risiko.
        </Trans>
        <br />
        <br />
        <Trans>
          Quelle: <strong>NexaStack</strong> — Open-Source-Vorlagen unter CC-BY 4.0. Feedback und
          Pull Requests willkommen.
        </Trans>
      </div>
    </div>
  );
}
