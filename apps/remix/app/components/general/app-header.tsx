import { type HTMLAttributes, useEffect, useState } from 'react';

import { ReadStatus } from '@prisma/client';
import { InboxIcon, MenuIcon, SearchIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useSession } from '@nexasign/lib/client-only/providers/session';
import { isPersonalLayout } from '@nexasign/lib/utils/organisations';
import { getRootHref } from '@nexasign/lib/utils/params';
import { trpc } from '@nexasign/trpc/react';
import { cn } from '@nexasign/ui/lib/utils';
import { Button } from '@nexasign/ui/primitives/button';

import { AppCommandMenu } from './app-command-menu';
import { AppNavDesktop } from './app-nav-desktop';
import { AppNavMobile } from './app-nav-mobile';
import { MenuSwitcher } from './menu-switcher';
import { OrgMenuSwitcher } from './org-menu-switcher';

export type HeaderProps = HTMLAttributes<HTMLDivElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const params = useParams();

  const { organisations } = useSession();

  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const { data: unreadCountData } = trpc.document.inbox.getCount.useQuery(
    {
      readStatus: ReadStatus.NOT_OPENED,
    },
    {
      // refetchInterval: 30000, // Refetch every 30 seconds
    },
  );

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        // py-4 = 16 px Padding oben/unten → ~88 px Gesamthöhe (60 px Logo + Luft).
        // Entfernt das „drangeklatscht"-Gefühl, das mit h-16 + 60-px-Logo entstand.
        'supports-backdrop-blur:bg-background/60 sticky top-0 z-[60] flex w-full items-center border-b border-b-transparent bg-background/95 py-4 backdrop-blur duration-200',
        scrollY > 5 && 'border-b-border',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        {/* NexaSign-Logo: fertig gesetzte Wortmarke als Bild.
            60 px hoch, 1x + 2x via srcset, WebP mit PNG-Fallback.
            Identisch zur PHP-Nav (templates/vorlagen-index/_nav.php). */}
        <Link
          to={getRootHref(params)}
          className="hidden items-center rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
          aria-label="NexaSign"
        >
          <picture>
            <source type="image/webp" srcSet="/logo-1x.webp 1x, /logo-2x.webp 2x" />
            <img
              src="/logo-1x.png"
              srcSet="/logo-1x.png 1x, /logo-2x.png 2x"
              alt="NexaSign"
              height={64}
              width={268}
              style={{ height: '64px', width: 'auto', display: 'block' }}
            />
          </picture>
        </Link>

        <AppNavDesktop setIsCommandMenuOpen={setIsCommandMenuOpen} />

        <Button asChild variant="outline" className="relative hidden h-10 w-10 rounded-lg md:flex">
          <Link to="/inbox" className="relative block h-10 w-10">
            <InboxIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground" />

            {unreadCountData && unreadCountData.count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {unreadCountData.count > 99 ? '99+' : unreadCountData.count}
              </span>
            )}
          </Link>
        </Button>

        <div className="md:ml-4">
          {isPersonalLayout(organisations) ? <MenuSwitcher /> : <OrgMenuSwitcher />}
        </div>

        <div className="flex flex-row items-center space-x-4 md:hidden">
          <button onClick={() => setIsCommandMenuOpen(true)}>
            <SearchIcon className="h-6 w-6 text-muted-foreground" />
          </button>

          <button onClick={() => setIsHamburgerMenuOpen(true)}>
            <MenuIcon className="h-6 w-6 text-muted-foreground" />
          </button>

          <AppCommandMenu open={isCommandMenuOpen} onOpenChange={setIsCommandMenuOpen} />

          <AppNavMobile
            isMenuOpen={isHamburgerMenuOpen}
            onMenuOpenChange={setIsHamburgerMenuOpen}
          />
        </div>
      </div>
    </header>
  );
};
