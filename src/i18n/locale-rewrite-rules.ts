export type LocaleRoutes = Record<string, string>;

export function generateLocaleRewrites(
  defaultLocale: string,
  routesByLocale: Record<string, LocaleRoutes>
) {
  const defaultRoutes = routesByLocale[defaultLocale] ?? {};

  return Object.entries(routesByLocale).flatMap(([locale, routes]) => {
    if (locale === defaultLocale) {
      return [];
    }

    return Object.entries(routes).flatMap(([key, localizedPath]) => {
      const defaultPath = defaultRoutes[key];

      if (!defaultPath || localizedPath === defaultPath) {
        return [];
      }

      return [{
        source: `/${locale}${localizedPath}`,
        destination: `/${locale}${defaultPath}`
      }];
    });
  });
}