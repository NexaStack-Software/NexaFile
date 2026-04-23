import satori from 'satori';
import { P, match } from 'ts-pattern';

import { NEXT_PUBLIC_WEBAPP_URL } from '@nexasign/lib/constants/app';
import { getRecipientOrSenderByShareLinkSlug } from '@nexasign/lib/server-only/document/get-recipient-or-sender-by-share-link-slug';
import { svgToPng } from '@nexasign/lib/utils/images/svg-to-png';

import type { Route } from './+types/share.$slug.opengraph';

export const runtime = 'edge';

const CARD_OFFSET_TOP = 173;
const CARD_OFFSET_LEFT = 307;
const CARD_WIDTH = 590;
const CARD_HEIGHT = 337;

const IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { slug } = params;

  // QR codes are not supported for OpenGraph images
  if (slug.startsWith('qr_')) {
    return new Response('Not found', { status: 404 });
  }

  const baseUrl = NEXT_PUBLIC_WEBAPP_URL();

  const [interSemiBold, interRegular, caveatRegular] = await Promise.all([
    fetch(new URL(`${baseUrl}/fonts/inter-semibold.ttf`, import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL(`${baseUrl}/fonts/inter-regular.ttf`, import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL(`${baseUrl}/fonts/caveat-regular.ttf`, import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
  ]);

  // NexaSign-Wortmarke: Satori fetcht das Image selbst, solange die URL absolut ist.
  // 2x-Variante für scharfes Rendering auf der 1200×630-Card.
  const logoUrl = `${baseUrl}/logo-2x.png`;

  const recipientOrSender = await getRecipientOrSenderByShareLinkSlug({
    slug,
  });

  if ('error' in recipientOrSender) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const isRecipient = 'Signature' in recipientOrSender;

  const signatureImage = match(recipientOrSender)
    .with({ signatures: P.array(P._) }, (recipient) => {
      return recipient.signatures?.[0]?.signatureImageAsBase64 || null;
    })
    .otherwise((sender) => {
      return sender.signature || null;
    });

  const signatureName = match(recipientOrSender)
    .with({ signatures: P.array(P._) }, (recipient) => {
      return recipient.name || recipient.email;
    })
    .otherwise((sender) => {
      return sender.name || sender.email;
    });

  // Generate SVG using Satori
  const svg = await satori(
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        backgroundColor: 'white',
        position: 'relative',
      }}
    >
      {/* Das Upstream-Bild og-share-frame2.png enthält ein „NexaSign"-Wasserzeichen
          und „Join NexaSign" oben rechts — für NexaSign passt das nicht. Wir rendern
          stattdessen einen neutralen Rahmen + dezenten NexaSign-Hinweis unten rechts. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#fdf9f3',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: CARD_OFFSET_TOP - 16,
          left: CARD_OFFSET_LEFT - 16,
          width: CARD_WIDTH + 32,
          height: CARD_HEIGHT + 32,
          border: '1.5px solid #e6d8cc',
          borderRadius: 16,
          background: '#ffffff',
          display: 'flex',
        }}
      />
      <img
        src={logoUrl}
        alt="NexaSign"
        width={300}
        height={72}
        style={{
          position: 'absolute',
          right: 48,
          bottom: 40,
        }}
      />

      {signatureImage ? (
        <div
          style={{
            position: 'absolute',
            padding: '24px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            top: CARD_OFFSET_TOP,
            left: CARD_OFFSET_LEFT,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          }}
        >
          <img
            src={signatureImage}
            alt="signature"
            style={{
              opacity: 0.6,
              height: '100%',
              maxWidth: '100%',
            }}
          />
        </div>
      ) : (
        <p
          style={{
            position: 'absolute',
            padding: '24px 48px',
            marginTop: '-8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#64748b',
            fontFamily: 'Caveat',
            fontSize: Math.max(Math.min((CARD_WIDTH * 1.5) / signatureName.length, 80), 36),
            top: CARD_OFFSET_TOP,
            left: CARD_OFFSET_LEFT,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          }}
        >
          {signatureName}
        </p>
      )}

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          width: '100%',
          top: CARD_OFFSET_TOP - 78,
          left: CARD_OFFSET_LEFT,
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            color: '#828282',
            fontFamily: 'Inter',
            fontWeight: 700,
          }}
        >
          {isRecipient ? 'Document Signed!' : 'Document Sent!'}
        </h2>
      </div>
    </div>,
    {
      width: IMAGE_SIZE.width,
      height: IMAGE_SIZE.height,
      fonts: [
        {
          name: 'Caveat',
          data: caveatRegular,
          style: 'italic',
        },
        {
          name: 'Inter',
          data: interRegular,
          weight: 400,
        },
        {
          name: 'Inter',
          data: interSemiBold,
          weight: 600,
        },
      ],
    },
  );

  const pngBuffer = await svgToPng(svg.toString());

  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length.toString(),
      // Kurzes Cache-TTL (5 Min), damit Branding-Updates bei fork-/image-
      // Änderungen nicht 1 Jahr im Client/CDN stehen bleiben.
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
};
