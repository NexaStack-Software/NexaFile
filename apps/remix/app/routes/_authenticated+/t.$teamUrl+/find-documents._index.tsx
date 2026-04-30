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
  PaperclipIcon,
  PlugIcon,
  SearchIcon,
  Settings2Icon,
  XCircleIcon,
} from 'lucide-react';
import { Link, useParams } from 'react-router';

import { trpc } from '@nexasign/trpc/react';
import type {
  TDiscoveryDocumentAction,
  TFindDiscoveryDocumentsResponse,
} from '@nexasign/trpc/server/discovery-router/schema';
import { Badge } from '@nexasign/ui/primitives/badge';
import { Button } from '@nexasign/ui/primitives/button';
import { Card } from '@nexasign/ui/primitives/card';
import { Checkbox } from '@nexasign/ui/primitives/checkbox';
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
// "all" ist die Default-Übersicht — alle Belege auf einen Blick, sortiert nach
// Datum. Die anderen Tabs sind Workflow-Filter.
type DiscoveryTab = 'all' | 'inbox' | 'pending-manual' | 'accepted' | 'archived';
type Document = TFindDiscoveryDocumentsResponse['documents'][number];
type Source = TFindDiscoveryDocumentsResponse['sources'][number];

const STATUS_TABS: ReadonlyArray<{ value: DiscoveryTab; label: ReturnType<typeof msg> }> = [
  { value: 'all', label: msg`Alle` },
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
  if (status === 'accepted' || status === 'processed')
    return <CheckCircleIcon className="h-4 w-4" aria-hidden />;
  if (status === 'archived') return <ArchiveIcon className="h-4 w-4" aria-hidden />;
  return <InboxIcon className="h-4 w-4" aria-hidden />;
};

const statusLabel = (status: DiscoveryStatus): React.ReactNode => {
  switch (status) {
    case 'inbox':
      return <Trans>Neu</Trans>;
    case 'pending-manual':
      return <Trans>Manuell</Trans>;
    case 'accepted':
      return <Trans>Akzeptiert</Trans>;
    case 'archived':
      return <Trans>Archiv</Trans>;
    case 'ignored':
      return <Trans>Ignoriert</Trans>;
    case 'processed':
      return <Trans>Verarbeitet</Trans>;
  }
};

const DocumentRow = ({
  doc,
  locale,
  onAction,
  isPending,
  isSelected,
  onToggleSelect,
}: {
  doc: Document;
  locale: string;
  onAction: (id: string, action: TDiscoveryDocumentAction) => void;
  isPending: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) => (
  <Card
    // Override des Card-Defaults (bg-background = cremefarben):
    //   bg-white          — absolut weiss, hebt sich vom warmen Page-BG ab
    //   border-neutral-300 — sichtbarer mittel-grauer Rand statt blass-cremefarben
    //   shadow-sm         — leichtes Hochkant-Gefuehl, klar als „Karte" lesbar
    // bei Auswahl zusaetzlich primary-Ring; hover etwas anheben statt nur Tint.
    className={`flex flex-col gap-2 border-neutral-300 bg-white p-4 shadow-sm transition-all hover:border-neutral-400 hover:shadow-md ${
      isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
    }`}
  >
    <div className="flex items-start gap-3">
      {/* Multi-Select-Checkbox: outside des Detail-Links, damit Klick aufs
          Häkchen den User NICHT zur Detail-Seite navigiert. */}
      <div className="pt-1">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(doc.id)}
          aria-label={`Beleg „${doc.title}" auswählen`}
        />
      </div>

      {/* Klickbarer Bereich → Detail-Seite. Akzeptieren-/Archivieren-Buttons
          liegen ausserhalb dieses Links, damit deren Klicks nicht zur Detail-
          Seite navigieren. */}
      <Link
        to={doc.id}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <FileTextIcon className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{doc.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {doc.correspondent && <span>{doc.correspondent}</span>}
            {doc.detectedInvoiceNumber && (
              <span className="font-mono text-xs">{doc.detectedInvoiceNumber}</span>
            )}
            <span>{formatDate(doc.documentDate ?? doc.capturedAt, locale)}</span>
            {/* Anhang-Indikator: nur wenn herunterladbares Archiv vorhanden.
                Wenn Mail in der DB ist aber keine Files → kein Icon, nichts
                Klickbares — User weiss visuell „hier gibt's nichts zum Laden". */}
            {doc.hasArchive && doc.attachmentCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium text-foreground"
                title={`${doc.attachmentCount} Anhang${
                  doc.attachmentCount > 1 ? '"e' : ''
                } verfügbar`}
              >
                <PaperclipIcon className="h-3 w-3" aria-hidden />
                {doc.attachmentCount}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-2">
        <Badge variant="secondary">
          <StatusIcon status={doc.status} />
          <span className="ml-1.5">{statusLabel(doc.status)}</span>
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
      <div className="flex flex-wrap gap-1.5 pl-9">
        {doc.tags.map((tag) => (
          <Badge key={tag} variant="neutral" className="text-xs font-normal">
            {tag}
          </Badge>
        ))}
      </div>
    )}
  </Card>
);

/**
 * Sticky Action-Bar am oberen Listen-Rand, sichtbar sobald >=1 Beleg
 * ausgewaehlt ist. Zeigt ehrlich, wie viele der ausgewaehlten Belege
 * tatsaechlich Files haben — wenn 0, ist der ZIP-Button disabled.
 */
const BulkActionBar = ({
  selectedCount,
  downloadableCount,
  onClear,
  zipHref,
}: {
  selectedCount: number;
  downloadableCount: number;
  onClear: () => void;
  zipHref: string;
}) => {
  const noneDownloadable = downloadableCount === 0;
  return (
    <div className="sticky top-[88px] z-40 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 backdrop-blur">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          <Trans>{selectedCount} ausgewählt</Trans>
        </p>
        {downloadableCount < selectedCount && (
          <p className="text-xs text-muted-foreground">
            <Trans>
              {downloadableCount} davon mit Anhang — ZIP enthält MANIFEST.txt mit Liste der
              übersprungenen Mails.
            </Trans>
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {noneDownloadable ? (
          <Button size="sm" disabled title="Keiner der ausgewählten Belege hat Anhänge">
            <DownloadIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
            <Trans>Kein Anhang</Trans>
          </Button>
        ) : (
          <Button asChild size="sm">
            <a href={zipHref} download>
              <DownloadIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
              <Trans>Anhänge + Mail als ZIP</Trans>
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trans>Auswahl aufheben</Trans>
        </Button>
      </div>
    </div>
  );
};

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
            Starten Sie in den Quellen-Einstellungen einen Sync-Lauf für einen bestimmten Zeitraum,
            um Belege aus Ihrem Postfach einzulesen.
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
  isSelected,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
}: {
  documents: Document[];
  locale: string;
  onAction: (id: string, action: TDiscoveryDocumentAction) => void;
  isPending: boolean;
  showAcceptedColumn: boolean;
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={documents.length === 0}
        >
          <DownloadIcon className="mr-2 h-4 w-4" aria-hidden />
          <Trans>CSV exportieren</Trans>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <Checkbox
                  checked={documents.length > 0 && allSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Alle auswählen"
                />
              </th>
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
              <th className="px-3 py-2 text-center font-medium" title="Anhang">
                <PaperclipIcon className="mx-auto h-4 w-4" aria-hidden />
              </th>
              <th className="px-3 py-2 font-medium">
                <Trans>Status</Trans>
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
              <tr
                key={doc.id}
                className={`border-t hover:bg-muted/30 ${isSelected(doc.id) ? 'bg-primary/5' : ''}`}
              >
                <td className="px-3 py-2 align-middle">
                  <Checkbox
                    checked={isSelected(doc.id)}
                    onCheckedChange={() => onToggleSelect(doc.id)}
                    aria-label={`Beleg „${doc.title}" auswählen`}
                  />
                </td>
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
                <td className="px-3 py-2 text-center">
                  {doc.hasArchive && doc.attachmentCount > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground"
                      title={`${doc.attachmentCount} Anhang${
                        doc.attachmentCount > 1 ? '"e' : ''
                      } verfügbar`}
                    >
                      <PaperclipIcon className="h-3 w-3" aria-hidden />
                      {doc.attachmentCount}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">–</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Badge variant="secondary" className="text-xs font-normal">
                    <StatusIcon status={doc.status} />
                    <span className="ml-1.5">{statusLabel(doc.status)}</span>
                  </Badge>
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
  const params = useParams();
  const teamUrl = params.teamUrl ?? '';
  // Default ist die Übersicht: alle Belege auf einen Blick, sortiert nach Datum.
  // Workflow-Tabs (Eingang, Manuell, …) sind weiterhin erreichbar.
  const [status, setStatus] = useState<DiscoveryTab>('all');
  const [query, setQuery] = useState('');
  // Multi-Select-State pro Tab — beim Tab-Wechsel zurueckgesetzt.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleStatusChange = (next: DiscoveryTab) => {
    setStatus(next);
    setSelectedIds(new Set());
  };

  const hasAnySource = data?.hasAnySource ?? false;
  const sources = data?.sources ?? [];
  const visibleDocuments = data?.documents ?? [];

  const isSelected = (id: string) => selectedIds.has(id);
  const allVisibleSelected =
    visibleDocuments.length > 0 && visibleDocuments.every((d) => selectedIds.has(d.id));
  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (visibleDocuments.every((d) => prev.has(d.id))) {
        // Alle abwählen die zur aktuellen Sicht gehören.
        const next = new Set(prev);
        visibleDocuments.forEach((d) => next.delete(d.id));
        return next;
      }
      const next = new Set(prev);
      visibleDocuments.forEach((d) => next.add(d.id));
      return next;
    });
  };

  // Absoluter Pfad — relative URLs resolven hier ungewollt nach
  // /t/{team}/zip-attachments (statt /t/{team}/find-documents/zip-attachments),
  // weil die List-URL keinen Trailing-Slash hat.
  const zipHref = `/t/${teamUrl}/find-documents/zip-attachments?ids=${Array.from(selectedIds).join(',')}`;

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
        <Tabs value={status} onValueChange={(v) => handleStatusChange(v as DiscoveryTab)}>
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
            {selectedIds.size > 0 && (
              <BulkActionBar
                selectedCount={selectedIds.size}
                downloadableCount={
                  visibleDocuments.filter(
                    (d) => selectedIds.has(d.id) && d.hasArchive && d.attachmentCount > 0,
                  ).length
                }
                onClear={handleClearSelection}
                zipHref={zipHref}
              />
            )}
            {/* "Alle" + akzeptiert + archiv ergibt typisch viele Belege —
                Tabellenansicht ist da kompakter und scannbar. Eingang+Manuell
                bleiben Card-Ansicht, weil dort die Action-Buttons (Akzeptieren
                / Archivieren etc.) im Zentrum stehen. */}
            {status === 'all' || status === 'accepted' || status === 'archived' ? (
              <DocumentTable
                documents={data.documents}
                locale={i18n.locale}
                onAction={handleAction}
                isPending={updateStatusMutation.isPending}
                showAcceptedColumn={status !== 'all'}
                isSelected={isSelected}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                allSelected={allVisibleSelected}
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
                    isSelected={isSelected(doc.id)}
                    onToggleSelect={handleToggleSelect}
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
