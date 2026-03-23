# Assets média (alignés bundles-frontend)

## Tokens ERC-20 (nombreux)

Les logos **ne sont pas** copiés dans le repo : le web et le mobile utilisent le même CDN :

`https://media.bundles.fi/tokens/{chainId}/{addressChecksummed}.svg`

Helpers : `@/lib/media` → `getErc20TokenIconUrl`, `bundleIconUrl` (index), composant `TokenIcon`.

## Marque bundles.fi

Fichiers SVG depuis `bundles-frontend/public/assets/img/logo` (+ favicon) : `assets/brand/`, exports dans `bundles-brand.tsx`.

## Chaînes & placeholders

- `assets/chains/` — icônes réseau (`ChainIcon`).
- `assets/utility/` — `token-generic` / `index-generic` (fallbacks comme sur le web).

## Index / bundles (images upload)

PNG sur le bucket uploads (comme `IndexToken.getIconUrl()`). Helper : `bundleIconUrl` dans `@/lib/media` (défaut `https://api.bundles.fi/uploads`, surcharge via `EXPO_PUBLIC_UPLOADS_URL_ROOT`).
