import { Trans } from '@lingui/react/macro';
import { File } from 'lucide-react';

import { NEXT_PUBLIC_WEBAPP_URL } from '@nexasign/lib/constants/app';
import { VerifiedIcon } from '@nexasign/ui/icons/verified';
import { cn } from '@nexasign/ui/lib/utils';
import { Button } from '@nexasign/ui/primitives/button';

export type UserProfileTimurProps = {
  className?: string;
  rows?: number;
};

/**
 * Demo-Profil-Komponente für die Signup-Seite.
 * Zeigt, wie ein öffentliches NexaSign-Profil für eingeladene Unterzeichner aussieht.
 * Der Komponentenname bleibt aus Upstream-Kompatibilität `UserProfileTimur` —
 * zeigt einen generischen Beispiel-User (kein echtes Foto im OSS-Repo).
 */
export const UserProfileTimur = ({ className, rows = 2 }: UserProfileTimurProps) => {
  const baseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000');

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl bg-neutral-100 p-4 dark:bg-background',
        className,
      )}
    >
      <div className="inline-block max-w-full truncate rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground">
        {baseUrl.host}/u/beispiel
      </div>

      <div className="mt-4">
        {/* Generischer SVG-Avatar — kein reales Foto, damit OSS-Deployer ihr
            eigenes Profil benutzen, ohne Drittperson-Ähnlichkeit zu erben. */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
          </svg>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-center gap-x-2">
          <h2 className="text-2xl font-semibold">
            <Trans>Beispiel-Nutzer</Trans>
          </h2>

          <VerifiedIcon className="h-8 w-8 text-primary" />
        </div>

        <p className="mt-4 max-w-[40ch] text-center text-sm text-muted-foreground">
          <Trans>So könnte Ihr öffentliches NexaSign-Profil aussehen.</Trans>
        </p>

        <p className="mt-1 max-w-[40ch] text-center text-sm text-muted-foreground">
          <Trans>
            Unterzeichner können direkt auf Ihre freigegebenen Dokumente zugreifen — ohne eigenen
            Account.
          </Trans>
        </p>
      </div>

      <div className="mt-8 w-full">
        <div className="divide-y-2 divide-neutral-200 overflow-hidden rounded-lg border-2 border-neutral-200 dark:divide-foreground/30 dark:border-foreground/30">
          <div className="bg-neutral-50 p-4 font-medium text-muted-foreground dark:bg-foreground/20">
            <Trans>Dokumente</Trans>
          </div>

          {Array(rows)
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-x-6 bg-background p-4"
              >
                <div className="flex items-center gap-x-2">
                  <File className="h-8 w-8 text-muted-foreground/80" strokeWidth={1.5} />

                  <div className="space-y-2">
                    <div className="h-1.5 w-24 rounded-full bg-neutral-300 md:w-36 dark:bg-foreground/30" />
                    <div className="h-1.5 w-16 rounded-full bg-neutral-200 md:w-24 dark:bg-foreground/20" />
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <Button type="button" size="sm" className="pointer-events-none w-32">
                    <Trans>Unterzeichnen</Trans>
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
