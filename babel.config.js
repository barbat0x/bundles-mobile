module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          /**
           * Must be **top-level**, not only under `web: { ... }`.
           *
           * `babel-preset-expo` merges `options.web` / `options.native` only when
           * `caller.platform` is exactly `'web'` or native. If platform is missing or
           * the merge doesn’t apply, `unstable_transformImportMeta` stays off.
           *
           * When it’s off, the preset **intentionally leaves** `import.meta` in source
           * on web (see `import-meta-transform-plugin.js`) — but Metro’s web bundle is
           * not executed as `<script type="module">`, so the browser throws
           * `Cannot use 'import.meta' outside a module`.
           *
           * Enabling the polyfill maps `import.meta` → `globalThis.__ExpoImportMetaRegistry`
           * for all platforms (Hermes also doesn’t support raw `import.meta`).
           *
           * @see https://github.com/expo/expo/issues/36384
           */
          unstable_transformImportMeta: true,
        },
      ],
      "nativewind/babel",
    ],
  };
};
