import React from 'react';
import { Helmet } from 'react-helmet-async';
import data from './routes.json';

export const SITE = data.site;
export const ROUTES = data.routes;
export const CLIENT_ONLY_PATHS = data.clientOnly;
export const getRoute = (key) => ROUTES.find((r) => r.key === key);
export const canonicalUrl = (path) => `${SITE.origin}${path}`;

// Sets a page's title, description and canonical address from src/seo/routes.json.
// scripts/prerender.mjs writes the same values into each page's HTML at build time, so crawlers that
// do not run JavaScript see them too. Pass `title`/`description` to override (e.g. a page for one ticker).
export default function RouteMeta({ routeKey, title, description }) {
  const route = getRoute(routeKey);
  if (!route) return null;
  return (
    <Helmet>
      <title>{title || route.title}</title>
      <meta name="description" content={description || route.description} />
      <link rel="canonical" href={canonicalUrl(route.path)} />
    </Helmet>
  );
}
