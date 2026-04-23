import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    host: 'https://nexasign.nexastack.co/docs',
    sitemap: 'https://nexasign.nexastack.co/docs/sitemap.xml',
  };
}
