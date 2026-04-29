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
  DownloadIcon,
  FileTextIcon,
  InboxIcon,
  MoreHorizontalIcon,
  PlugIcon,
  SearchIcon,
  Settings2Icon,
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

// Vollständiger Status-Enum (matcht das tRPC-Schema). Tabs zeigen aber nur
// die 4 Hauptzustände — IGNORED ist via Filter erreichbar, PROCESSED ist eine
// Sammel-Kategorie.
type DiscoveryStatus =
  | 'inbox'
  | 'pending-manual'
  | 'accepted'
  | 'archived'
  | 'ignored'
  | 'processed';
type DiscoveryTab = 'inbox' | 'pending-manual' | 'accepted' | 'archived';
type Document = TFindDiscoveryDocumentsResponse['documents'][number];
type Source = TFindDiscoveryDocumentsResponse['sources'][number];

const STATUS_TABS: ReadonlyArray<{ value: DiscoveryTab; label: ReturnType<typeof msg> }> = [
  { value: 'inbox', label: msg`Eingang` },
  { value: 'pending-manual', label: msg`Manuell zu ziehen` },
  { value: 'accepted', label: msg`Akzeptiert` },
  { value: 'archived', label: msg`Archiv` },
];

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

const NoSourceEmptyState = () => (
  <Card className="flex flex-col items-center gap-5 p-12 text-center">
    <PlugIcon className="h-12 w-12 text-muted-foreground" aria-hidden />
    <div className="max-w-md">
      <h2 className="text-lg font-semibold">
        <Trans>Verbinden Sie Ihre erste Dokumentenquelle</Trans>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <Trans>
          Belege erscheinen hier, sobald Sie eine Quelle verbunden und einen Sync-Lauf gestartet
          haben.
        </Trans>
      </p>
    </div>
    <Button asChild>
      <Link to="/settings/sources">
        <Trans>Quelle verbinden</Trans>
      </Link>
    </Button>
  </Card>
);

const SourcesStatusBar = ({ sources, locale }: { sources: Source[]; locale: string }) => {
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
              <Trans>Noch kein Sync gestartet</Trans>
            </span>
          </>
        )}
      </div>
      <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
        <Link to="/settings/sources">
          <Settings2Icon className="h-3.5 w-3.5" aria-hidden />
          <Trans>Quellen verwalten</Trans>
        </Link>
      </Button>
    </div>
  );
};

const NoResultsCard = ({ sources, locale }: { sources: Source[]; locale: string }) => (
  <div className="flex flex-col gap-4">
    <SourcesStatusBar sources={sources} locale={locale} />
    <Card className="flex flex-col items-center gap-3 p-12 text-center">
      <InboxIcon className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-lg font-semibold">
          <Trans>Keine Belege im aktuellen Bereich</Trans>
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          <Trans>
            Starten Sie in den Quellen-Einstellungen einen Sync-Lauf für einen bestimmten
            Zeitraum, um Belege aus Ihrem Postfach einzulesen.
          </Trans>
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/settings/sources">
          <Settings2Icon className="mr-2 h-4 w-4" aria-hidden />
          <Trans>Sync-Lauf starten</Trans>
        </Link>
      </Button>
    </Card>
  </div>
);

// Tabellen-Ansicht für „Akzeptiert" und „Archiv". Im Gegensatz zur Card-Liste
// (die für Eingang+Manuell wegen der Aktions-Buttons sinnvoller ist) brauchen
// wir hier Lese-Übersicht über viele Belege + Export.
const csvEscape = (val: string | null | undefined): string => {
  if (val == null) return '';
  if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
};

const downloadCsv = (filename: string, rows: string[][]): void => {
  const csv = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  // BOM für Excel-Kompatibilität auf deutschen Systemen.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const DocumentTable = ({
  documents,
  locale,
  onAction,
  isPending,
  showAcceptedColumn,
}: {
  documents: Document[];
  locale: string;
  onAction: (id: string, action: TDiscoveryDocumentAction) => void;
  isPending: boolean;
  showAcceptedColumn: boolean;
}) => {
  const intlDate = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const header = [
      'Datum',
      'Korrespondent',
      'Betreff',
      'Betrag',
      'Rechnungs-Nr',
      ...(showAcceptedColumn ? ['Akzeptiert am', 'Akzeptiert von'] : []),
      'Status',
    ];
    const rows = documents.map((d) => [
      d.documentDate ? intlDate.format(d.documentDate) : intlDate.format(d.capturedAt),
      d.correspondent ?? '',
      d.title,
      d.detectedAmount ?? '',
      d.detectedInvoiceNumber ?? '',
      ...(showAcceptedColumn
        ? [d.acceptedAt ? intlDate.format(d.acceptedAt) : '', d.acceptedByName ?? '']
        : []),
      d.status,
    ]);
    downloadCsv(`belege-${today}.csv`, [header, ...rows]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={documents.length === 0}>
          <DownloadIcon className="mr-2 h-4 w-4" aria-hidden />
          <Trans>CSV exportieren</Trans>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                <Trans>Datum</Trans>
              </th>
              <th className="px-3 py-2 font-medium">
                <Trans>Korrespondent</Trans>
              </th>
              <th className="px-3 py-2 font-medium">
                <Trans>Betreff</Trans>
              </th>
              <th className="px-3 py-2 font-medium">
                <Trans>Betrag</Trans>
              </th>
              <th className="px-3 py-2 font-medium">
                <Trans>Rechnungs-Nr.</Trans>
              </th>
              {showAcceptedColumn && (
                <th className="px-3 py-2 font-medium">
                  <Trans>Akzeptiert</Trans>
                </th>
              )}
              <th className="px-3 py-2 text-right font-medium">
                <Trans>Aktion</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t hover:bg-muted/30">
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {intlDate.format(doc.documentDate ?? doc.capturedAt)}
                </td>
                <td className="px-3 py-2">{doc.correspondent ?? '–'}</td>
                <td className="max-w-md truncate px-3 py-2">
                  <Link to={doc.id} className="hover:underline">
                    {doc.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {doc.detectedAmount ?? '–'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {doc.detectedInvoiceNumber ?? '–'}
                </td>
                {showAcceptedColumn && (
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {doc.acceptedAt ? (
                      <>
                        {intlDate.format(doc.acceptedAt)}
                        {doc.acceptedByName && (
                          <span className="ml-1 text-xs">· {doc.acceptedByName}</span>
                        )}
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {doc.status === 'accepted' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={isPending}
                      onClick={() => onAction(doc.id, 'archive')}
                    >
                      <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      <Trans>Archivieren</Trans>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                    <Link to={doc.id}>
                      <Trans>Details</Trans>
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function FindDocumentsPage() {
  const { _, i18n } = useLingui();
  const { toast } = useToast();
  const [status, setStatus] = useState<DiscoveryTab>('inbox');
  const [query, setQuery] = useState('');

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.discovery.findDocuments.useQuery({
    status,
    query: query.trim() || undefined,
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

  const hasAnySource = data?.hasAnySource ?? false;
  const sources = data?.sources ?? [];

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
        <Tabs value={status} onValueChange={(v) => setStatus(v as DiscoveryTab)}>
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
        {isLoading && <LoadingList />}

        {!isLoading && data && !hasAnySource && <NoSourceEmptyState />}

        {!isLoading && data && hasAnySource && data.documents.length === 0 && (
          <NoResultsCard sources={sources} locale={i18n.locale} />
        )}

        {!isLoading && data && data.documents.length > 0 && (
          <div className="flex flex-col gap-4">
            <SourcesStatusBar sources={sources} locale={i18n.locale} />
            {status === 'accepted' || status === 'archived' ? (
              <DocumentTable
                documents={data.documents}
                locale={i18n.locale}
                onAction={handleAction}
                isPending={updateStatusMutation.isPending}
                showAcceptedColumn
              />
            ) : (
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
              </div>
            )}
            {data.total > data.documents.length && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                <Trans>
                  {data.documents.length} von {data.total} angezeigt
                </Trans>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
