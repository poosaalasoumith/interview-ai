import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://interview-ai.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/signup', '/auth/callback'],
      disallow: ['/dashboard/*', '/interview/*'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
