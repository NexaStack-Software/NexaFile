// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors
import { env } from '@nexasign/lib/utils/env';

import type {
  DiscoveryContext,
  DiscoveryDocument,
  DiscoveryDocumentStatus,
  DiscoveryFilter,
  DiscoveryPage,
  DiscoveryReader,
} from '../types';

/**
 * Discovery-Provider auf Basis eines externen Indexdienstes (REST-Backend).
 *
 * Konfiguration via Environment:
 *   NEXT_PRIVATE_DISCOVERY_TRANSPORT=paperless
 *   NEXT_PRIVATE_DISCOVERY_PAPERLESS_URL=https://<host>
 *   NEXT_PRIVATE_DISCOVERY_PAPERLESS_TOKEN=<api-token>
 *
 * Hinweis (Lizenz): Dieser Provider spricht mit Paperless-ngx (GPL-3.0).
 * Die Erwähnung an dieser Stelle erfüllt die Attribution-Pflicht. Im
 * NexaFile-UI wird der Backend-Name nicht angezeigt.
 */

type PaperlessDocument = {
  id: number;
  title: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  created: string;
  added: string;
  modified: string;
  content?: string;
  archive_serial_number?: string | null;
  original_file_name?: string;
};

type PaperlessListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaperlessDocument[];
};

type LookupCache = {
  correspondents: Map<number, string>;
  tags: Map<number, string>;
  documentTypes: Map<number, string>;
  fetchedAt: number;
};

const LOOKUP_TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 25;
const STATUS_TAG_MANUAL = 'manuell-zu-ziehen';
const STATUS_TAG_PROCESSED = 'verarbeitet';

let lookupCache: LookupCache | null = null;

const getConfig = () => {
  const baseUrl = env('NEXT_PRIVATE_DISCOVERY_PAPERLESS_URL');
  const token = env('NEXT_PRIVATE_DISCOVERY_PAPERLESS_TOKEN');

  if (!baseUrl || !token) {
    throw new Error(
      'Discovery-Provider nicht vollständig konfiguriert: ' +
        'NEXT_PRIVATE_DISCOVERY_PAPERLESS_URL und _TOKEN müssen gesetzt sein.',
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
  };
};

const apiFetch = async <T>(path: string): Promise<T> => {
  const { baseUrl, token } = getConfig();
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Discovery-Backend antwortet mit ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

const refreshLookups = async (): Promise<LookupCache> => {
  if (lookupCache && Date.now() - lookupCache.fetchedAt < LOOKUP_TTL_MS) {
    return lookupCache;
  }

  type Named = { id: number; name: string };
  type ListOf<T> = { results: T[]; next: string | null };

  const fetchAll = async <T>(path: string): Promise<T[]> => {
    const all: T[] = [];
    let cursor: string | null = path;
    while (cursor) {
      const page: ListOf<T> = await apiFetch<ListOf<T>>(cursor);
      all.push(...page.results);
      cursor = page.next;
    }
    return all;
  };

  const [correspondents, tags, documentTypes] = await Promise.all([
    fetchAll<Named>('/api/correspondents/?page_size=100'),
    fetchAll<Named>('/api/tags/?page_size=100'),
    fetchAll<Named>('/api/document_types/?page_size=100'),
  ]);

  const nextLookupCache = {
    correspondents: new Map(correspondents.map((c) => [c.id, c.name])),
    tags: new Map(tags.map((t) => [t.id, t.name])),
    documentTypes: new Map(documentTypes.map((d) => [d.id, d.name])),
    fetchedAt: Date.now(),
  };

  // Benign: parallele Refreshes koennen denselben Lookup-Cache ueberschreiben.
  // eslint-disable-next-line require-atomic-updates
  lookupCache = nextLookupCache;
  return nextLookupCache;
};

const deriveStatus = (tagNames: string[]): DiscoveryDocumentStatus => {
  const lower = tagNames.map((t) => t.toLowerCase());
  if (lower.includes(STATUS_TAG_PROCESSED)) {
    return 'processed';
  }
  if (lower.includes(STATUS_TAG_MANUAL)) {
    return 'pending-manual';
  }
  return 'inbox';
};

const toDiscoveryDocument = (doc: PaperlessDocument, lookups: LookupCache): DiscoveryDocument => {
  const tagNames = doc.tags
    .map((id) => lookups.tags.get(id))
    .filter((name): name is string => Boolean(name));

  return {
    id: `paperless:${doc.id}`,
    nativeId: String(doc.id),
    title: doc.title || doc.original_file_name || `#${doc.id}`,
    correspondent:
      doc.correspondent !== null ? (lookups.correspondents.get(doc.correspondent) ?? null) : null,
    documentType:
      doc.document_type !== null ? (lookups.documentTypes.get(doc.document_type) ?? null) : null,
    tags: tagNames,
    documentDate: doc.created ? new Date(doc.created) : null,
    capturedAt: doc.added ? new Date(doc.added) : new Date(),
    status: deriveStatus(tagNames),
    // Paperless-Quellen liefern immer ein Document mit binär-Inhalt — daher
    // counted: 1 Anhang, hasArchive true. Kein File-System-Archive wie bei IMAP.
    attachmentCount: 1,
    hasArchive: true,
  };
};

const buildQueryString = (filter: DiscoveryFilter, cursor?: string | null): string => {
  const params = new URLSearchParams();
  params.set('page_size', String(PAGE_SIZE));
  params.set('ordering', '-added');

  if (cursor) {
    params.set('page', cursor);
  }
  if (filter.query) {
    params.set('query', filter.query);
  }
  if (filter.documentDateFrom) {
    params.set('created__date__gte', filter.documentDateFrom.toISOString().slice(0, 10));
  }
  if (filter.documentDateTo) {
    params.set('created__date__lt', filter.documentDateTo.toISOString().slice(0, 10));
  }
  if (filter.status === 'pending-manual') {
    params.set('tags__name__iexact', STATUS_TAG_MANUAL);
  }
  if (filter.status === 'processed') {
    params.set('tags__name__iexact', STATUS_TAG_PROCESSED);
  }

  return params.toString();
};

const extractCursorFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.searchParams.get('page');
  } catch {
    return null;
  }
};

const parseId = (id: string): string => {
  return id.startsWith('paperless:') ? id.slice('paperless:'.length) : id;
};

export const paperlessDiscoveryReader: DiscoveryReader = {
  id: 'paperless',

  async findDocuments(
    filter: DiscoveryFilter,
    cursor?: string | null,
    _ctx?: DiscoveryContext,
  ): Promise<DiscoveryPage> {
    const lookups = await refreshLookups();
    const qs = buildQueryString(filter, cursor);
    const page = await apiFetch<PaperlessListResponse>(`/api/documents/?${qs}`);

    let documents = page.results.map((doc) => toDiscoveryDocument(doc, lookups));

    // Status-Filter „inbox" lässt sich nicht direkt abfragen (Abwesenheit von Tags),
    // daher clientseitig nachfiltern.
    if (filter.status === 'inbox') {
      documents = documents.filter((d) => d.status === 'inbox');
    }

    if (filter.correspondent) {
      const needle = filter.correspondent.toLowerCase();
      documents = documents.filter((d) => d.correspondent?.toLowerCase().includes(needle));
    }

    return {
      documents,
      total: page.count,
      nextCursor: extractCursorFromUrl(page.next),
    };
  },

  async getDocument(id: string, _ctx?: DiscoveryContext): Promise<DiscoveryDocument | null> {
    const lookups = await refreshLookups();
    try {
      const doc = await apiFetch<PaperlessDocument>(`/api/documents/${parseId(id)}/`);
      return toDiscoveryDocument(doc, lookups);
    } catch {
      return null;
    }
  },

  async getDocumentContent(id: string, _ctx?: DiscoveryContext): Promise<Uint8Array | null> {
    const { baseUrl, token } = getConfig();
    const response = await fetch(`${baseUrl}/api/documents/${parseId(id)}/download/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  },
};
