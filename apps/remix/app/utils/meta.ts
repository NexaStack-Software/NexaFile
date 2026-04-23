import { type MessageDescriptor, i18n } from '@lingui/core';

import { NEXT_PUBLIC_WEBAPP_URL } from '@nexasign/lib/constants/app';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'NexaSign ist die deutsche, selbstgehostete Alternative für digitale Signaturen. Open Source, DSGVO-konform und in Deutschland betreibbar. Unterschreiben Sie Verträge in Ihrer eigenen Infrastruktur, ohne Abo und ohne Drittpartei-Server.';

  return [
    {
      title: title ? `${i18n._(title)} – NexaSign` : 'NexaSign – Dokumente digital unterzeichnen',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'NexaSign, NexaStack, digitale Signatur, elektronische Unterschrift, Open Source, DSGVO, Self-Hosted, Deutschland',
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
      content: 'NexaSign – die deutsche DocuSign-Alternative, selbstgehostet',
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
