import type { HTMLAttributes } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useSession } from '@nexasign/lib/client-only/providers/session';
import { isPersonalLayout } from '@nexasign/lib/utils/organisations';
import { cn } from '@nexasign/ui/lib/utils';
import { Button } from '@nexasign/ui/primitives/button';

import { useOptionalCurrentTeam } from '~/providers/team';

export type AppNavDesktopProps = HTMLAttributes<HTMLDivElement> & {
  setIsCommandMenuOpen: (value: boolean) => void;
};

export const AppNavDesktop = ({
  className,
  setIsCommandMenuOpen,
  ...props
}: AppNavDesktopProps) => {
  const { _ } = useLingui();
  const { organisations } = useSession();

  const { pathname } = useLocation();

  const [modifierKey, setModifierKey] = useState(() => 'Ctrl');

  const currentTeam = useOptionalCurrentTeam();

  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const isMacOS = /Macintosh|Mac\s+OS\s+X/i.test(userAgent);

    setModifierKey(isMacOS ? '⌘' : 'Ctrl');
  }, []);

  const menuNavigationLinks = useMemo(() => {
    let teamUrl = currentTeam?.url || null;

    if (!teamUrl && isPersonalLayout(organisations)) {
      teamUrl = organisations[0].teams[0]?.url || null;
    }

    if (!teamUrl) {
      return [];
    }

    return [
      {
        href: `/t/${teamUrl}/documents`,
        label: msg`Documents`,
      },
      // NexaSign-Templates (interne Signier-Vorlagen) sind weiter per URL
      // erreichbar (/t/<team>/templates), stehen aber nicht in der Haupt-Nav —
      // dort führt der Eintrag „Vorlagen" rechts daneben auf die öffentliche
      // Vorlagen-Bibliothek /vorlagen/.
    ];
  }, [currentTeam, organisations]);

  return (
    <div
      className={cn(
        'ml-8 hidden flex-1 items-center gap-x-12 md:flex md:justify-between',
        className,
      )}
      {...props}
    >
      <div>
        <AnimatePresence>
          {menuNavigationLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline gap-x-6"
            >
              {menuNavigationLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  to={href}
                  data-tour={href.includes('/documents') ? 'nav-documents' : undefined}
                  className={cn(
                    'rounded-md font-medium leading-5 text-muted-foreground ring-offset-background hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-muted-foreground/60',
                    {
                      'text-foreground dark:text-muted-foreground': pathname?.startsWith(href),
                    },
                  )}
                >
                  {_(label)}
                </Link>
              ))}
              {/* NexaSign: „Vorlagen" und „GoBD" — externe Bereiche, gleicher Stil wie die Remix-Links */}
              <a
                href="/vorlagen/"
                data-tour="nav-vorlagen"
                className={cn(
                  'rounded-md font-medium leading-5 text-muted-foreground ring-offset-background hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-muted-foreground/60',
                  {
                    'text-foreground dark:text-muted-foreground':
                      pathname?.startsWith('/vorlagen') && !pathname?.startsWith('/vorlagen/gobd'),
                  },
                )}
              >
                Vorlagen
              </a>
              <a
                href="/vorlagen/gobd/"
                className={cn(
                  'rounded-md font-medium leading-5 text-muted-foreground ring-offset-background hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-muted-foreground/60',
                  {
                    'text-foreground dark:text-muted-foreground':
                      pathname?.startsWith('/vorlagen/gobd'),
                  },
                )}
              >
                GoBD
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Button
        variant="outline"
        className="flex w-full max-w-96 items-center justify-between rounded-lg text-muted-foreground"
        onClick={() => setIsCommandMenuOpen(true)}
      >
        <div className="flex items-center">
          <Search className="mr-2 h-5 w-5" />
          <Trans>Search</Trans>
        </div>

        <div>
          <div className="flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs tracking-wider text-muted-foreground">
            {modifierKey}+K
          </div>
        </div>
      </Button>
    </div>
  );
};
