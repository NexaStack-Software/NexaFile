// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HashIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
  PaperclipIcon,
  XCircleIcon,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { trpc } from '@nexasign/trpc/react';
import type {
  TDiscoveryArtifact,
  TDiscoveryDocumentAction,
} from '@nexasign/trpc/server/discovery-router/schema';
import { Badge } from '@nexasign/ui/primitives/badge';
import { Button } from '@nexasign/ui/primitives/button';
import { Card } from '@nexasign/ui/primitives/card';
import { Skeleton } from '@nexasign/ui/primitives/skeleton';
import { useToast } from '@nexasign/ui/primitives/use-toast';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Beleg-Detail`);
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: Date | null, locale: string): string => {
  if (!date) return '–';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
};

const ArtifactRow = ({ artifact }: { artifact: TDiscoveryArtifact }) => {
  const Icon = artifact.kind === 'ATTACHMENT' ? PaperclipIcon : FileTextIcon;
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-medium">{artifact.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(artifact.fileSize)} · {artifact.contentType}
          </p>
        </div>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <HashIcon className="h-3 w-3" aria-hidden />
          {artifact.sha256}
        </p>
      </div>
      <Button asChild variant="ghost" size="sm" className="h-8 flex-shrink-0 px-2">
        <a href={`artifacts/${artifact.id}`} download>
          <DownloadIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          <Trans>Laden</Trans>
        </a>
      </Button>
    </div>
  );
};

export default function FindDocumentsDetail() {
  const params = useParams();
  const id = params.id ?? '';
  const navigate = useNavigate();
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.discovery.getDocumentDetail.useQuery({ id });

  const updateStatusMutation = trpc.discovery.updateStatus.useMutation({
    onSuccess: () => {
      void utils.discovery.findDocuments.invalidate();
      void utils.discovery.getDocumentDetail.invalidate({ id });
      toast({ title: _(msg`Aktion ausgeführt`) });
    },
    onError: (err) => {
      toast({
        title: _(msg`Aktion fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleAction = (action: TDiscoveryDocumentAction) => {
    updateStatusMutation.mutate({ id, action });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-8 md:px-8">
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-8 md:px-8">
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertCircleIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">
            <Trans>Beleg nicht gefunden</Trans>
          </h2>
          <Button asChild variant="outline" onClick={() => navigate(-1)}>
            <span>
              <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden />
              <Trans>Zurück</Trans>
            </span>
          </Button>
        </Card>
      </div>
    );
  }

  const { document: doc, artifacts, absoluteArchivePath, gmailDeepLink } = data;
  const isAccepted = Boolean(doc.acceptedAt);
  const isPending = updateStatusMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-8 md:px-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link to="..">
              <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden />
              <Trans>Alle Belege</Trans>
            </Link>
          </Button>
          <h1 className="break-words text-2xl font-bold tracking-tight md:text-3xl">
            {doc.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {doc.correspondent && <span>{doc.correspondent}</span>}
            <span>{formatDate(doc.documentDate ?? doc.capturedAt, i18n.locale)}</span>
            {doc.sourceLabel && (
              <span className="inline-flex items-center gap-1">
                <MailIcon className="h-3.5 w-3.5" aria-hidden />
                {doc.sourceLabel}
              </span>
            )}
            {isAccepted && (
              <Badge variant="secondary" className="gap-1.5">
                <LockIcon className="h-3 w-3" aria-hidden />
                <Trans>Akzeptiert · GoBD-gesperrt</Trans>
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Aktions-Buttons */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {!isAccepted && doc.status === 'inbox' && (
          <>
            <Button onClick={() => handleAction('accept')} disabled={isPending}>
              {isPending ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircleIcon className="mr-2 h-4 w-4" aria-hidden />
              )}
              <Trans>Als Beleg akzeptieren</Trans>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('mark-pending-manual')}
              disabled={isPending}
            >
              <ClockIcon className="mr-2 h-4 w-4" aria-hidden />
              <Trans>Manuell zu ziehen</Trans>
            </Button>
            <Button variant="outline" onClick={() => handleAction('ignore')} disabled={isPending}>
              <XCircleIcon className="mr-2 h-4 w-4" aria-hidden />
              <Trans>Ignorieren</Trans>
            </Button>
          </>
        )}
        {!isAccepted && doc.status === 'pending-manual' && (
          <Button onClick={() => handleAction('archive')} disabled={isPending}>
            <ArchiveIcon className="mr-2 h-4 w-4" aria-hidden />
            <Trans>Archivieren</Trans>
          </Button>
        )}
        {isAccepted && doc.status !== 'processed' && (
          <Button variant="outline" onClick={() => handleAction('archive')} disabled={isPending}>
            <ArchiveIcon className="mr-2 h-4 w-4" aria-hidden />
            <Trans>Archivieren</Trans>
          </Button>
        )}
        {gmailDeepLink && (
          <Button asChild variant="outline">
            <a href={gmailDeepLink} target="_blank" rel="noreferrer noopener">
              <ExternalLinkIcon className="mr-2 h-4 w-4" aria-hidden />
              <Trans>In Gmail öffnen</Trans>
            </a>
          </Button>
        )}
      </div>

      {/* Erkannte Felder */}
      {(doc.detectedAmount || doc.detectedInvoiceNumber || doc.portalHint) && (
        <Card className="mb-6 grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          {doc.detectedAmount && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <Trans>Erkannter Betrag</Trans>
              </p>
              <p className="mt-1 font-medium">{doc.detectedAmount}</p>
            </div>
          )}
          {doc.detectedInvoiceNumber && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <Trans>Rechnungs-Nr.</Trans>
              </p>
              <p className="mt-1 font-mono text-sm">{doc.detectedInvoiceNumber}</p>
            </div>
          )}
          {doc.portalHint && (
            <div className="md:col-span-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <Trans>Portal-Hinweis (Mail enthält)</Trans>
              </p>
              <p className="mt-1 text-sm italic">{doc.portalHint}</p>
            </div>
          )}
        </Card>
      )}

      {/* Mail-Body — als Klartext, niemals dangerouslySetInnerHTML */}
      {doc.bodyText && (
        <Card className="mb-6 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              <Trans>Mail-Inhalt</Trans>
            </h2>
            {doc.bodyHasHtml && (
              <p className="text-xs text-muted-foreground">
                <Trans>HTML-Variante als Datei verfügbar — wird aus Sicherheitsgründen nicht inline angezeigt.</Trans>
              </p>
            )}
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-3 text-xs leading-relaxed">
            {doc.bodyText}
          </pre>
        </Card>
      )}

      {/* Artifact-Liste */}
      {artifacts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">
            <Trans>Dateien im Archiv</Trans>
          </h2>
          <div className="flex flex-col gap-2">
            {artifacts.map((art) => (
              <ArtifactRow key={art.id} artifact={art} />
            ))}
          </div>
        </div>
      )}

      {/* Server-Pfad-Hinweis fürs FTP/SCP-Reingucken */}
      {absoluteArchivePath && (
        <Card className="p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Trans>Pfad auf dem Server</Trans>
          </p>
          <p className="mt-1 break-all font-mono text-xs">{absoluteArchivePath}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            <Trans>
              Per FTP/SCP erreichbar. Dateien sind read-only (0440); zum Verschieben einer Kopie
              benutzen Sie `cp` statt `mv`.
            </Trans>
          </p>
        </Card>
      )}
    </div>
  );
}
