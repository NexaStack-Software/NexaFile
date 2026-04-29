// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  Loader2Icon,
  PlayCircleIcon,
  RefreshCwIcon,
  TrashIcon,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { trpc } from '@nexasign/trpc/react';
import { Button } from '@nexasign/ui/primitives/button';
import { Card } from '@nexasign/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@nexasign/ui/primitives/dialog';
import { Skeleton } from '@nexasign/ui/primitives/skeleton';
import { useToast } from '@nexasign/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Quelle`);
}

const formatDateTime = (date: Date | null, locale: string): string => {
  if (!date) return '–';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export default function SettingsSourceDetail() {
  const params = useParams();
  const sourceId = params.id ?? '';
  const navigate = useNavigate();
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.sources.listSources.useQuery();
  const source = sources?.find((s) => s.id === sourceId);

  const test = trpc.sources.testSource.useMutation({
    onSuccess: (result) => {
      toast({
        title: result.ok ? _(msg`Verbindung erfolgreich`) : _(msg`Verbindung fehlgeschlagen`),
        description: result.error,
        variant: result.ok ? 'default' : 'destructive',
      });
    },
    onError: (err) =>
      toast({
        title: _(msg`Test fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      }),
  });

  const triggerSync = trpc.sources.triggerSync.useMutation({
    onSuccess: () => {
      void utils.sources.listSources.invalidate();
      void utils.discovery.findDocuments.invalidate();
      toast({
        title: _(msg`Sync angestoßen`),
        description: _(msg`Neue Belege erscheinen in Kürze im Eingang.`),
      });
    },
    onError: (err) =>
      toast({
        title: _(msg`Sync fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      }),
  });

  const reactivate = trpc.sources.reactivateSource.useMutation({
    onSuccess: () => {
      void utils.sources.listSources.invalidate();
      toast({ title: _(msg`Quelle reaktiviert`) });
    },
    onError: (err) =>
      toast({
        title: _(msg`Reaktivieren fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      }),
  });

  const remove = trpc.sources.deleteSource.useMutation({
    onSuccess: () => {
      void utils.sources.listSources.invalidate();
      void utils.discovery.findDocuments.invalidate();
      toast({ title: _(msg`Quelle entfernt`) });
      void navigate('/settings/sources');
    },
    onError: (err) =>
      toast({
        title: _(msg`Entfernen fehlgeschlagen`),
        description: err.message,
        variant: 'destructive',
      }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!source) {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <AlertCircleIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">
            <Trans>Quelle nicht gefunden</Trans>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <Trans>Diese Quelle existiert nicht oder wurde gelöscht.</Trans>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/settings/sources">
            <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden />
            <Trans>Zurück zur Liste</Trans>
          </Link>
        </Button>
      </Card>
    );
  }

  const isSuspended = source.lastSyncStatus === 'SUSPENDED';

  return (
    <div>
      <SettingsHeader
        title={source.label}
        subtitle={_(msg`IMAP-Konto · Belege fließen in Team „${source.teamName}"`)}
      >
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings/sources">
            <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden />
            <Trans>Alle Quellen</Trans>
          </Link>
        </Button>
      </SettingsHeader>

      {isSuspended && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-destructive bg-destructive/5 p-4">
          <div className="text-sm text-destructive">
            <p className="font-semibold">
              <Trans>Diese Quelle ist gesperrt.</Trans>
            </p>
            <p className="mt-1">
              <Trans>
                Drei aufeinanderfolgende Login-Fehler. Bitte Zugangsdaten prüfen und reaktivieren.
              </Trans>
            </p>
          </div>
          <Button
            variant="outline"
            disabled={reactivate.isPending}
            onClick={() => reactivate.mutate({ sourceId: source.id })}
          >
            {reactivate.isPending && (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            <Trans>Reaktivieren</Trans>
          </Button>
        </Card>
      )}

      <Card className="mt-6 grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Trans>Status</Trans>
          </p>
          <p className="mt-1 text-sm font-semibold">{source.lastSyncStatus}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Trans>Letzter erfolgreicher Sync</Trans>
          </p>
          <p className="mt-1 text-sm">{formatDateTime(source.lastSyncAt, i18n.locale)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Trans>Letzter Versuch</Trans>
          </p>
          <p className="mt-1 text-sm">{formatDateTime(source.lastSyncAttemptedAt, i18n.locale)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Trans>Aufeinanderfolgende Fehler</Trans>
          </p>
          <p className="mt-1 text-sm">{source.consecutiveFailures}</p>
        </div>
        {source.lastSyncError && (
          <div className="col-span-full">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              <Trans>Letzte Fehlermeldung</Trans>
            </p>
            <p className="mt-1 text-sm text-destructive">{source.lastSyncError}</p>
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={test.isPending}
          onClick={() => test.mutate({ sourceId: source.id })}
        >
          {test.isPending ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <PlayCircleIcon className="mr-2 h-4 w-4" aria-hidden />
          )}
          <Trans>Verbindung testen</Trans>
        </Button>

        <Button
          disabled={triggerSync.isPending || isSuspended}
          onClick={() => triggerSync.mutate({ sourceId: source.id })}
        >
          {triggerSync.isPending ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCwIcon className="mr-2 h-4 w-4" aria-hidden />
          )}
          <Trans>Jetzt synchronisieren</Trans>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="ml-auto">
              <TrashIcon className="mr-2 h-4 w-4" aria-hidden />
              <Trans>Quelle entfernen</Trans>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Quelle wirklich entfernen?</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Bereits importierte Belege bleiben erhalten. Neue Belege werden ab sofort nicht
                  mehr automatisch eingelesen.
                </Trans>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ sourceId: source.id })}
              >
                {remove.isPending && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                <Trans>Endgültig entfernen</Trans>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
