// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors.
/**
 * Schmaler Footer, der auf jeder Seite den NexaStack-Bezug sichtbar macht.
 * Identisch zum _footer.php der PHP-Vorlagen-Seiten (Text + Link auf nexastack.co).
 */
export const NexaStackFooter = () => (
  <footer className="mt-auto border-t border-border bg-background">
    <div className="mx-auto max-w-screen-xl px-4 py-6 text-center text-base text-muted-foreground md:px-8">
      NexaSign — ein Open-Source-Projekt von{' '}
      <a
        href="https://nexastack.co/"
        className="font-medium text-foreground no-underline transition-colors hover:text-primary"
      >
        NexaStack
      </a>
    </div>
  </footer>
);
