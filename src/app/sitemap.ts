import type { MetadataRoute } from 'next';

const SITE_BASE = 'https://blazeandbun.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_BASE}/menu`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_BASE}/faqs`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_BASE}/careers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_BASE}/allergen-info`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}