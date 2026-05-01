import { type MessageDescriptor, i18n } from '@lingui/core';

import { NEXT_PUBLIC_WEBAPP_URL } from '@nexasign/lib/constants/app';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'NexaFile ist die deutsche, selbstgehostete Open-Source-Plattform für Dokumente: erstellen, finden, signieren und GoBD-orientiert archivieren.';

  return [
    {
      title: title ? `${i18n._(title)} – NexaFile` : 'NexaFile – Dokumente im eigenen Stack',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'NexaFile, NexaStack, Dokumentenmanagement, digitale Signatur, elektronische Unterschrift, GoBD, Open Source, DSGVO, Self-Hosted, Deutschland',
    },
    {
      name: 'author',
      content: 'NexaStack',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'NexaFile – Dokumente erstellen, finden, signieren und archivieren',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
