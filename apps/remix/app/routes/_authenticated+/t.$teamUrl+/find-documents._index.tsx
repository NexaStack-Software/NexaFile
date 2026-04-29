// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  AlertCircleIcon,
  ArchiveIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  InboxIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlugIcon,
  RefreshCwIcon,
  SearchIcon,
  XCircleIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import { trpc } from '@nexasign/trpc/react';
import type {
  TDiscoveryDocumentAction,
  TFindDiscoveryDocumentsResponse,
} from '@nexasign/trpc/server/discovery-router/schema';
import { Badge } from '@nexasign/ui/primitives/badge';
import { Button } from '@nexasign/ui/primitives/button';
import { Card } from '@nexasign/ui/primitives/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@nexasign/ui/primitives/dropdown-menu';
import { Input } from '@nexasign/ui/primitives/input';
import { Skeleton } from '@nexasign/ui/primitives/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@nexasign/ui/primitives/tabs';
import { useToast } from '@nexasign/ui/primitives/use-toast';

type DiscoveryStatus = 'inbox' | 'pending-manual' | 'processed';
type Document = TFindDiscoveryDocumentsResponse['documents'][number];
type Source = TFindDiscoveryDocumentsResponse['sources'][number];

const toDiscoveryStatus = (value: string): DiscoveryStatus => {
  if (value === 'pending-manual' || value === 'processed') return value;
  return 'inbox';
};

const STATUS_TABS: ReadonlyArray<{ value: DiscoveryStatus; label: ReturnType<typeof msg> }> = [
  { value: 'inbox', label: msg`Eingang` },
  { value: 'pending-manual', label: msg`Manuell zu ziehen` },
  { value: 'processed', label: msg`Verarbeitet` },
];

// Relative Zeit ohne externe Abhängigkeit — Intl.RelativeTimeFormat reicht.
const formatRelativeTime = (date: Date, locale: string): string => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second');
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(diffDays, 'day');
};

const formatDate = (date: Date | null, locale: string): string => {
  if (!date) return '–';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const StatusIcon = ({ status }: { status: DiscoveryStatus }) => {
  if (status === 'pending-manual') return <ClockIcon className="h-4 w-4" aria-hidden />;
  if (status === 'processed') return <CheckCircleIcon className="h-4 w-4" aria-hidden />;
  return <InboxIcon className="h-4 w-4" aria-hidden />;
};

const DocumentRow = ({
  doc,
  locale,
  onAction,
  isPending,
}: {
  doc: Document;
  locale: string;
  onAction: (id: string, action: TDiscoveryDocumentAction) => void;
  isPending: boolean;
}) => (
  <Card className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/50">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <FileTextIcon className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{doc.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {doc.correspondent && <span>{doc.correspondent}</span>}
            {doc.documentType && <span>{doc.documentType}</span>}
            <span>{formatDate(doc.documentDate ?? doc.capturedAt, locale)}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Badge variant="secondary">
          <StatusIcon status={doc.status} />
          <span className="ml-1.5">
            {doc.status === 'pending-manual' && <Trans>Manuell</Trans>}
            {doc.status === 'processed' && <Trans>Verarbeitet</Trans>}
            {doc.status === 'inbox' && <Trans>Neu</Trans>}
          </span>
        </Badge>
        {doc.status === 'inbox' && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => onAction(doc.id, 'accept')}
            >
              <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              <Trans>Akzeptieren</Trans>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPending}>
                  <MoreHorizontalIcon className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAction(doc.id, 'mark-pending-manual')}>
                  <ClockIcon className="mr-2 h-4 w-4" aria-hidden />
                  <Trans>Als manuell zu ziehen markieren</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction(doc.id, 'archive')}>
                  <ArchiveIcon className="mr-2 h-4 w-4" aria-hidden />
                  <Trans>Archivieren</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction(doc.id, 'ignore')}>
                  <XCircleIcon className="mr-2 h-4 w-4" aria-hidden />
                  <Trans>Ignorieren</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {doc.status === 'pending-manual' && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onAction(doc.id, 'archive')}
          >
            <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            <Trans>Archivieren</Trans>
          </Button>
        )}
      </div>
    </div>
    {doc.tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {doc.tags.map((tag) => (
          <Badge key={tag} variant="neutral" className="text-xs font-normal">
            {tag}
          </Badge>
        ))}
      </div>
    )}
  </Card>
);

const LoadingList = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-24 w-full" />
    ))}
  </div>
);

// Zustand 1: Keine Quelle verbunden
const NoSourceEmptyState = () => (
  <Card className="flex flex-col items-center gap-5 p-12 text-center">
    <PlugIcon className="h-12 w-12 text-muted-foreground" aria-hidden />
    <div className="max-w-md">
      <h2 className="text-lg font-semibold">
        <Trans>Verbinden Sie Ihre erste Dokumentenquelle</Trans>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <Trans>
          Belege werden danach automatisch hier auftauchen — aus Ihrem Postfach, später auch aus
          Cloud-Speicher und anderen Quellen.
        </Trans>
      </p>
    </div>
    <Button asChild>
      <Link to="/settings/sources">
        <Trans>Quelle verbinden</Trans>
      </Link>
    </Button>
    <p className="text-xs text-muted-foreground">
      <Trans>Quellen werden pro Konto konfiguriert und sind nur für Sie sichtbar.</Trans>
    </p>
  </Card>
);

// Zustand 2: Quelle verbunden, erster Sync noch nicht abgeschlossen
const FirstSyncPendingBanner = () => (
  <Card className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
    <Loader2Icon className="h-4 w-4 flex-shrink-0 animate-spin text-primary" aria-hidden />
    <span>
      <Trans>Erster Sync läuft — kann ein paar Minuten dauern.</Trans>
    </span>
  </Card>
);

// Wiederverwendbar in Zustand 3 und 4: Sync-Status mit relativem Zeitstempel und manuellem Trigger
const SourcesStatusBar = ({
  sources,
  isSyncing,
  onSync,
  locale,
}: {
  sources: Source[];
  isSyncing: boolean;
  onSync: () => void;
  locale: string;
}) => {
  // Jüngsten lastSyncAt über alle Quellen bestimmen
  const latestSync =
    sources
      .map((s) => s.lastSyncAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        {latestSync ? (
          <>
            <CheckCircleIcon className="h-4 w-4 text-green-600" aria-hidden />
            <span>
              <Trans>Letzter Sync: {formatRelativeTime(latestSync, locale)}</Trans>
            </span>
          </>
        ) : (
          <>
            <AlertCircleIcon className="h-4 w-4 text-amber-500" aria-hidden />
            <span>
              <Trans>Noch kein Sync abgeschlossen</Trans>
            </span>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={isSyncing}
        onClick={onSync}
        className="h-7 gap-1.5 px-2"
      >
        {isSyncing ? (
          <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RefreshCwIcon className="h-3.5 w-3.5" aria-hidden />
        )}
        <Trans>Jetzt synchronisieren</Trans>
      </Button>
    </div>
  );
};

// Zustand 3: Sync fertig, aber keine Treffer im gewählten Tab
const NoResultsEmptyState = ({
  sources,
  isSyncing,
  onSync,
  locale,
}: {
  sources: Source[];
  isSyncing: boolean;
  onSync: () => void;
  locale: string;
}) => (
  <div className="flex flex-col gap-4">
    <SourcesStatusBar sources={sources} isSyncing={isSyncing} onSync={onSync} locale={locale} />
    <Card className="flex flex-col items-center gap-3 p-12 text-center">
      <InboxIcon className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-lg font-semibold">
          <Trans>Keine Belege im aktuellen Bereich</Trans>
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          <Trans>Sobald neue Belege einlaufen, erscheinen sie hier automatisch.</Trans>
        </p>
      </div>
    </Card>
  </div>
);

export default function FindDocumentsPage() {
  const { _, i18n } = useLingui();
  const { toast } = useToast();
  const [status, setStatus] = useState<DiscoveryStatus>('inbox');
  const [query, setQuery] = useState('');

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.discovery.findDocuments.useQuery(
    { status, query: query.trim() || undefined },
    {
      // Pollt alle 5 Sekunden, solange noch kein Sync für eine der Quellen stattgefunden hat.
      refetchInterval: (query) => {
        const sources = query.state.data?.sources ?? [];
        return sources.length > 0 && sources.every((s) => s.lastSyncAt === null) ? 5000 : false;
      },
    },
  );

  const syncMutation = trpc.sources.triggerSync.useMutation({
    onSuccess: () => {
      void utils.discovery.findDocuments.invalidate();
      toast({
        title: _(msg`Sync angestoßen`),
        description: _(msg`Neue Belege erscheinen in Kürze.`),
      });
    },
    onError: (err) => {
      toast({
        title: _(msg`Sync fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = trpc.discovery.updateStatus.useMutation({
    onSuccess: () => {
      void utils.discovery.findDocuments.invalidate();
    },
    onError: (err) => {
      toast({
        title: _(msg`Aktion fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleAction = (id: string, action: TDiscoveryDocumentAction) => {
    updateStatusMutation.mutate({ id, action });
  };

  const handleSync = () => {
    if (!data?.sources) return;
    // Jede konfigurierte Quelle einzeln triggern — das Backend entscheidet, ob ein Sync gerade läuft.
    for (const source of data.sources) {
      syncMutation.mutate({ sourceId: source.id });
    }
  };

  const hasAnySource = data?.hasAnySource ?? false;
  const sources = data?.sources ?? [];
  const firstSyncPending = hasAnySource && sources.every((s) => s.lastSyncAt === null);
  const syncDone = hasAnySource && sources.some((s) => s.lastSyncAt !== null);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          <Trans>Dokumente finden</Trans>
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          <Trans>
            Belege aus allen verbundenen Quellen an einem Ort — durchsuchbar und nach Status
            gefiltert.
          </Trans>
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs value={status} onValueChange={(v) => setStatus(toDiscoveryStatus(v))}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {_(tab.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative max-w-sm flex-1 md:max-w-xs">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder={_(msg`Suchen…`)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <section aria-live="polite">
        {/* Lade-Skeleton solange der erste Request läuft */}
        {isLoading && <LoadingList />}

        {/* Zustand 1: Keine Quelle verbunden */}
        {!isLoading && data && !hasAnySource && <NoSourceEmptyState />}

        {/* Zustand 2: Quelle verbunden, erster Sync noch offen — Skeleton + Banner */}
        {!isLoading && data && firstSyncPending && (
          <div className="flex flex-col gap-4">
            <FirstSyncPendingBanner />
            <LoadingList />
          </div>
        )}

        {/* Zustand 3: Sync fertig, aber keine Treffer im gewählten Tab */}
        {!isLoading && data && syncDone && data.documents.length === 0 && (
          <NoResultsEmptyState
            sources={sources}
            isSyncing={syncMutation.isPending}
            onSync={handleSync}
            locale={i18n.locale}
          />
        )}

        {/* Zustand 4: Dokumente vorhanden */}
        {!isLoading && data && data.documents.length > 0 && (
          <div className="flex flex-col gap-4">
            <SourcesStatusBar
              sources={sources}
              isSyncing={syncMutation.isPending}
              onSync={handleSync}
              locale={i18n.locale}
            />
            <div className="flex flex-col gap-3">
              {data.documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  locale={i18n.locale}
                  onAction={handleAction}
                  isPending={updateStatusMutation.isPending}
                />
              ))}
              {data.total > data.documents.length && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  <Trans>
                    {data.documents.length} von {data.total} angezeigt
                  </Trans>
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
