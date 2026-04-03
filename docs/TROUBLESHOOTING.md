# Troubleshooting

Operational notes for **bundles-fi-mobile** (Expo SDK 55 · React Native · TypeScript). Prefer fixing issues in this order: **high-friction setup** first, then the numbered sections.

## Table of contents

1. **[High-friction local setup](#high-friction-local-setup-read-this-first)** — start here for the worst local onboarding issues (A–L).
2. **Numbered sections 1–11** — use your editor outline or search (`Ctrl+F`) for `## 1)`, `## 2)`, … `## 11)`.
3. **Web preview** — search for `Web preview` for `import.meta` / wallet extensions.

---

## High-friction local setup (read this first)

These are the issues that most often block a clean **local** environment. They are expanded later in numbered sections.

### A. Android 16 KB page size (emulator / device / Play)

- **Symptom:** System dialog *“App isn’t 16 KB compatible”* / ELF alignment errors for `.so` under `lib/arm64-v8a/`.
- **Why it’s annoying:** Native tooling + two different checks (**ZIP** vs **ELF**), plus Windows path quirks for Bash scripts.
- **Minimum fix path:** `npx expo install --fix`, rebuild native (`npx expo run:android`). Validate with **`zipalign`** (Build-Tools 35+) and Google’s **`check_elf_alignment.sh`** — see [§7](#7-android-warning-app-not-16-kb-page-size-compatible).
- **Git Bash on Windows:** Do **not** pass `C:\...` with backslashes to Bash; use a **relative** path, `/c/...`, or `C:/.../app.apk`. If the script prints a **NOTICE** about `zipalign`, add Build-Tools to `PATH` in Bash **or** rely on a separate **PowerShell** `zipalign` run.

### B. Expo SDK / package drift

- **Symptom:** `expo start` warns about incompatible package versions; `expo-doctor` fails.
- **Fix:** `npx expo install --fix` until SDK-aligned. See [§2](#2-expo-package-compatibility-warnings).

### C. `app.json` / `expo-doctor` schema (`minSdkVersion`)

- **Symptom:** `expo-doctor` — *Field: android — should NOT have additional property `minSdkVersion`*.
- **Fix:** Keep **`minSdkVersion`** only under the **`expo-build-properties`** plugin (not duplicated under `expo.android`). Same pattern for other native overrides.

### D. `npm ci` / `EPERM` on Windows

- **Symptom:** `npm ci` fails unlinking files under `node_modules` (e.g. native addons).
- **Mitigation:** Close apps locking files (Metro, IDE, antivirus scan), retry; or delete `node_modules` and run `npm install` once. Prefer a clean terminal after long installs.

### E. `@bundlesfi/universal-router` missing or no `dist/`

- **Symptom:** Metro cannot resolve the package or `dist/index.js` is missing.
- **Fix:** Use the **versioned tarball** under `vendor/*.tgz` produced by `npm pack` after building the router repo — **commit the tarball**. See [§4](#4-metro-cannot-resolve-bundlesfiuniversal-router-or-missing-distindexjs).

### F. `react-native-mmkv` / Coinbase (`overrides`)

- **Symptom:** Old MMKV v2 binaries misaligned on 16 KB devices; Coinbase SDK asks for `^2.x`.
- **Fix:** If this repo pins MMKV v3 for alignment, it appears under `package.json` → `overrides` (e.g. `"react-native-mmkv": "3.3.3"`). **Verify the override is actually present** — if missing, add it only if you rely on Coinbase-linked native paths, then `npm install` + **clean native rebuild**. See [§7 — MMKV](#mmkv--coinbase-libreactnativemmkvso).

### G. thirdweb / Metro optional imports

- **Symptom:** `Unable to resolve module ...` from `thirdweb` (Coinbase, AWS, passkey, etc.).
- **Fix:** Install the peer packages listed in `package.json` (this repo lists them explicitly). See [§5](#5-thirdweb-react-native-optional-modules-not-resolved-at-bundle-time).

### H. Sentry config warning at build

- **Symptom:** `[@sentry/react-native/expo] Missing config for organization, project`.
- **Impact:** Usually **non-blocking**; Sentry falls back to env vars. Configure `organization` / `project` in the Sentry plugin or env for production if you need upload/source maps.

### I. `git` not found (Windows)

- **Symptom:** `git` is not recognized in PowerShell.
- **Fix:** Install [Git for Windows](https://git-scm.com/download/win) and ensure **“Git from the command line”** is on PATH; restart the terminal.

### J. npm peer warnings (`valtio` / React 19)

- **Symptom:** `ERESOLVE` / peer warnings for `use-sync-external-store` vs React 19.
- **Impact:** Often **non-blocking** for this app if install completes. See [§8 — Residual warnings](#residual-warnings).

### K. `git pull` + uncommitted work (merge aborts, “lost” changes)

- **Symptom:** `git pull` fails with *local changes would be overwritten by merge*; later a merge runs and files you had edited “disappear” from `git status`; remote may delete tracked files (`AGENTS.md`, `PLAN.md`, `docs/E2E-TESTING.md`) while your local edits were never committed.
- **Why it’s annoying:** Git may create an **automatic stash** (`WIP on main: …`) before merging. If the merge fails partway (*Index was not unstashed*), your working tree can look empty even though the snapshot still exists as a **dangling commit**.
- **Prevention (best practice):** Before `git pull`: **`git status`** → either **commit** your work, or **`git stash push -u -m "wip"`** (include untracked if needed with `-u`). Never rely on implicit stash during a noisy merge.
- **Recovery:** See [§9) Git: recovering work after a failed or messy pull](#9-git-recovering-work-after-a-failed-or-messy-pull).

### L. Android emulator stuck on launcher / “cannot launch” AVD (Pixel, etc.)

- **Symptom:** `npx expo run:android` prints *Opening emulator Pixel_7* then hangs; **`Error: It took too long to start the Android emulator: Pixel_7`** (Expo CLI timeout); emulator stays on **home screen**; or CLI reports it **cannot start** the AVD.
- **Unlikely cause:** Recovering work from a **Git orphan commit** does **not** break the Android emulator — that is **ADB / AVD / GPU / Windows hypervisor** territory, not JS app code.
- **First steps:** Cold boot or wipe AVD data in Android Studio → Device Manager; **close all emulators** and run `adb kill-server` then `adb start-server`; ensure **only one** `ANDROID_SDK_ROOT` / SDK path. Full steps: [§10](#10-android-emulator-wont-start-stuck-on-home-or-expo-cant-open-avd).

---

## 1) Expo DevTools error on Linux/WSL

### Symptom

`expo start` prints:

`react-native-devtools: error while loading shared libraries: libasound.so.2: cannot open shared object file`

### Impact

Non-blocking for Metro/app runtime. Bundler still starts, QR code is available, app can run.

### Root cause

Missing ALSA runtime library on the host environment.

### Fix

Install ALSA package:

```bash
sudo apt-get update && sudo apt-get install -y libasound2
```

### Verify

```bash
npm run start
```

DevTools error should disappear.

---

## 2) Expo package compatibility warnings

### Symptom

`expo start` warns that some packages are not the expected versions for current Expo SDK.

### Impact

App may still run, but incompatibility can cause runtime issues.

### Root cause

Dependency versions drifted from Expo SDK recommendations.

### Fix

Align versions with Expo:

```bash
npx expo install --check
npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo @sentry/react-native react-native-svg
npx expo install --dev @types/jest jest
```

### Verify

```bash
npx expo-doctor
```

No compatibility warnings expected.

---

## 3a) `getEnv` / Zod: `EXPO_PUBLIC_*` “required” while `.env` is set

### Symptom

`Metro error` with `ZodError` on `EXPO_PUBLIC_THIRDWEB_CLIENT_ID` or `EXPO_PUBLIC_GRAPH_API_KEY` during web bundling (SSR) or on first `getEnv()` import.

### Root cause

In `app.json` → `expo.extra`, **empty strings** (`""`) for those keys **overrode** `.env`: merging used `extra ?? process.env`, and `""` is not `null`/`undefined`.

### Fix

- Do not put empty placeholders in `extra` for secrets/keys (remove them or keep values only in `.env` / EAS).
- App code should merge with a **`pick()`**-style rule: first **non-empty** value between `extra` and `process.env` wins.

---

## 3) The Graph auth error ("missing authorization header")

### Symptom

Direct call to:
`https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>`
returns auth error.

### Root cause

Gateway endpoint requires API key in URL path form.

### Correct format

```text
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

### Current project setup

- Env var: `EXPO_PUBLIC_GRAPH_API_KEY`
- URL built in `services/graph/bundles-graph-client.ts`

---

## 4) Metro cannot resolve `@bundlesfi/universal-router` (ou `dist/index.js` manquant)

### Symptom

- `Unable to resolve module @bundlesfi/universal-router`, **ou**
- Package trouvé mais `main` / `exports` pointent vers `dist/index.js` qui **n’existe pas**.

### Root cause

1. **`file:../universal-router`** : fragile (chemins, symlinks, machines différentes).
2. **Dépendance Git (`git+https://...`)** : `npm` installe le repo, mais **`dist/` n’est pas versionné** (gitignore) et le champ **`files`** du `package.json` n’inclut pas les fichiers de build (`vite.config.ts`, etc.). Résultat : **pas de bundle précompilé** → Metro ne peut pas résoudre l’entrée publiée.
3. Bundler les **sources** (`src/`) dans Expo est possible mais **non trivial** : les imports TypeScript utilisent des chemins `.js` vers des fichiers `.ts`, ce que Metro ne mappe pas comme `tsc`.

### Fix recommandé (reproductible)

**Tarball `npm pack` après un build local** qui inclut `dist/` :

```bash
cd ../universal-router
npm run build
npm pack --pack-destination ../bundles-fi-mobile/vendor
```

Puis dans `package.json` :

```json
"@bundlesfi/universal-router": "file:vendor/bundlesfi-universal-router-0.0.12.tgz"
```

Réinstaller et vider le cache Metro :

```bash
npm install
npx expo start -c
```

**Commit** le fichier `vendor/*.tgz` dans le dépôt app pour que les autres devs aient le même artefact (documenter le commit Git source utilisé pour le pack dans le README ou un commentaire PR).

### Alternatives long terme

- Publier `@bundlesfi/universal-router` sur npm avec **`dist/`** inclus dans le package publié.
- Ou automatiser un build du pack côté release (script interne) qui publie / attache le `.tgz`.

---

## 5) Thirdweb (React Native) : modules optionnels non résolus au bundle

### Symptom

`Unable to resolve module ...` depuis `node_modules/thirdweb/...` (Coinbase, passkeys, AWS, etc.) lors du bundling web ou natif.

### Root cause

`thirdweb` déclare beaucoup de **peerDependencies** comme *optionnelles* dans npm, mais **Metro résout le graphe d'imports statique** dans `dist/esm/...`. En particulier, `thirdweb/wallets` (condition React Native) ré-exporte `createWallet` depuis `wallets/native/create-wallet.js`, qui référence Coinbase / mobile-wallet-protocol / AWS (KMS, Lambda) au niveau du module — même si le MVP n'expose que `inAppWallet` et Transak. Les composants **`ConnectButton`** / **`AutoConnect`** tirent aussi `useAutoConnect` vers ce même `create-wallet`.

Ce n'est pas « une dépendance npm par feature activée », c'est un **coût de bundling** lié à l'architecture du SDK.

### Fix A — Recommandé pour la simplicité (ce repo)

Installer les peers que le bundle attend (voir `package.json`) : coût taille/audit, mais **stable** et aligné sur l'intention « optional peer » de thirdweb.

```bash
npx expo install \
  @coinbase/wallet-mobile-sdk \
  @mobile-wallet-protocol/client \
  react-native-passkey \
  react-native-aes-gcm-crypto \
  react-native-quick-crypto

npm install \
  @aws-sdk/client-kms \
  @aws-sdk/client-lambda \
  @aws-sdk/credential-providers
```

(`ethers` : seulement si tu l'utilises.)

### Fix B — Plus « minimal deps » (avancé, fragile)

- Remplacer **`ConnectButton`** par une UI maison (`useConnect` + `inAppWallet` uniquement) pour réduire un peu le graphe UI.
- **`useAutoConnect` / `AutoConnect`** restent difficiles à découpler de `create-wallet` sans changer de SDK.
- Alternative expérimentale : **stubs Metro** (`resolver.resolveRequest`) vers des modules vides pour Coinbase/AWS — risque de crash si un chemin d'exécution les appelle ; tester tous les flux wallet.

### Note

Si un nouvel import thirdweb échoue encore, ouvre `node_modules/thirdweb/package.json` → `peerDependencies` / `peerDependenciesMeta` et ajoute le module manquant.

---

## Web preview — écran noir, `import.meta`, extensions wallet

### Symptôme

- Preview navigateur **noire**, console : `Uncaught SyntaxError: Cannot use 'import.meta' outside a module` (souvent dans `entry.bundle`).
- En parallèle : `Cannot redefine property: ethereum` / MetaMask / Core — **extensions navigateur** qui injectent `window.ethereum`.

### Cause `import.meta`

Des deps (ex. **viem**, chaîne **thirdweb**) utilisent `import.meta`. Le bundle web Metro n’est pas servi comme script ES module ; il faut la transformation Babel prévue par Expo.

### Fix `import.meta`

Dans `babel.config.js`, **`unstable_transformImportMeta: true` doit être au niveau racine** des options de `babel-preset-expo`, pas seulement dans `web: { ... }` : sinon, si `caller.platform` ne fusionne pas `options.web`, l’option ne s’applique pas et le preset laisse `import.meta` tel quel sur le web (bundle Metro ≠ module ES).

Après changement :

```bash
npx expo start --web --clear
```

### Extensions wallet

Les erreurs `inpage.js` / `evmAsk.js` viennent de **plusieurs wallets** (MetaMask, Core, etc.) en même temps. Ce n’est en général **pas** la cause de l’écran noir si l’app charge ; pour tester sans bruit : fenêtre **navigation privée** sans extensions, ou désactiver temporairement les extensions crypto.

---

## 6) ConnectButton thirdweb: connected in button, app not redirected

### Symptom

- After clicking `Connect Wallet`, the button shows a connected wallet state, but the app does not transition to the authenticated flow (`/(tabs)`).
- Can also surface with React Query/provider errors depending on web/native mix.

### Root cause

- Mixed `thirdweb/react` and `thirdweb/react-native` providers/components inside `components/connect-wallet-button.tsx`.
- Creating local/secondary thirdweb provider trees can isolate wallet connection state from the app-level provider in `app/_layout.tsx`.

### Fix

- Keep a single source of truth for wallet session: app-level `ThirdwebProvider` in `app/_layout.tsx`.
- Use `ConnectButton` from `thirdweb/react-native` in app components for this project.
- Do not add local `ThirdwebProvider`/`QueryClientProvider` wrappers around `ConnectButton` unless architecture is explicitly redesigned.

### Verify

```bash
npm run typecheck
```

Manual verification:
- Open login screen.
- Click `Connect Wallet` and complete auth.
- Confirm redirection to app tabs and no "connected card replacing CTA" regression on onboarding.

---

## 7) Android warning: app not 16 KB page-size compatible

### Symptom

On Android 15+ emulator/device, Android shows:
- `This app isn't 16 KB compatible`
- `ELF alignment check failed`
- List of native libraries in `lib/x86_64/*.so` or `lib/arm64-v8a/*.so` not aligned.

### Root cause

The app contains native `.so` libraries (Expo/React Native modules or third-party dependencies) that are not packaged/compiled with 16 KB-compatible alignment.

Even if the app launches in compatibility mode, Google Play requires 16 KB support for apps targeting Android 15+.

### Fix

1. Update Expo-managed dependencies first:

```bash
npx expo install --fix
```

2. Rebuild from scratch (clean native artifacts), then retest on Android:

```bash
npx expo run:android
```

3. If warning persists, identify offending native libs and upgrade/patch the corresponding packages.
   - Typical candidates in this repo: crypto/storage/native modules (for example quick-crypto / ssl / mmkv-style libs).
   - Prefer upstream versions that explicitly mention Android 16 KB page-size support.

#### MMKV / Coinbase (`libreactnativemmkv.so`)

`@coinbase/wallet-mobile-sdk` (wallet / thirdweb peer) declares `react-native-mmkv@^2.11.0`. Older MMKV v2 binaries are a common source of **LOAD segment** misalignment on 16 KB devices.

If you pin **MMKV v3** for alignment, add it under `package.json` → `overrides` (example):

```json
"react-native-mmkv": "3.3.3"
```

Check that this block is **actually present** in your branch before assuming v3 is active.

After any override change: `npm install`, then a **clean** native rebuild (`expo prebuild --clean` if you use prebuild, or delete `android/build` and rebuild). Re-test Coinbase-linked flows (connect wallet) because the SDK is only tested upstream against MMKV v2.

Official background: [Android 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes) and [Expo FYI — 16 KB](https://raw.githubusercontent.com/expo/fyi/main/android-16kb-page-sizes.md).

### Verify

Use Android Studio APK Analyzer:
- `Build > Analyze APK...`
- Check `lib/**/*.so` alignment warnings.

#### Where the APK is (local Gradle build)

After `npx expo run:android`, a typical debug APK path is:

`android/app/build/outputs/apk/debug/app-debug.apk`

Release (if you build it):

`android/app/build/outputs/apk/release/app-release.apk`

EAS / Play: download the `.apk` / `.aab` from the build artifact; there is no committed APK in the repo.

#### `zipalign` (PowerShell) — ZIP side of the APK

Requires **Android SDK Build-Tools 35.0.0+**. Use the **full path** to `zipalign.exe` if it is not on `PATH`.

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0\zipalign.exe" -v -c -P 16 4 ".\android\app\build\outputs\apk\debug\app-debug.apk"
```

(`-h` is not supported; the tool still prints usage if you pass it.)

Success: output ends with **Verification successful** / **verification completed** (wording depends on build-tools version).

This checks **ZIP alignment** for uncompressed `.so` files; it does **not** replace the ELF check below.

#### `check_elf_alignment.sh` — ELF side (recommended by Google)

Official guide: [Support 16 KB page sizes — ELF alignment](https://developer.android.com/guide/practices/page-sizes#elf-alignment). The AOSP script lives [here](https://android.googlesource.com/platform/system/extras/+/refs/heads/main/tools/check_elf_alignment.sh).

**Download on Windows (Gitiles serves base64):** from the project root in PowerShell:

```powershell
$r = Invoke-WebRequest `
  -Uri "https://android.googlesource.com/platform/system/extras/+/refs/heads/main/tools/check_elf_alignment.sh?format=TEXT" `
  -UseBasicParsing
$b64 = $r.Content.Trim()
[IO.File]::WriteAllText(
  "$PWD\check_elf_alignment.sh",
  [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
)
```

Or open the Gitiles page in a browser and save the script manually.

**Run with Git Bash** (not PowerShell). Do **not** pass Windows paths with backslashes (`C:\...`): Git Bash strips them and the script reports `Invalid file: C:dev...`. Use one of:

```bash
bash check_elf_alignment.sh android/app/build/outputs/apk/debug/app-debug.apk
# or
bash check_elf_alignment.sh /c/dev/bundles-fi-mobile/android/app/build/outputs/apk/debug/app-debug.apk
# or forward slashes:
bash check_elf_alignment.sh "C:/dev/bundles-fi-mobile/android/app/build/outputs/apk/debug/app-debug.apk"
```

**If you see:** `NOTICE: Zip alignment check requires build-tools version 35.0.0-rc3 or higher` — the script skipped its **embedded** `zipalign` step because `zipalign` (Build-Tools 35+) is not on the **Git Bash** `PATH`. ELF analysis still runs. Either add Build-Tools to `PATH` in Git Bash:

```bash
export PATH="/c/Users/YOUR_USER/AppData/Local/Android/Sdk/build-tools/35.0.0:$PATH"
bash check_elf_alignment.sh android/app/build/outputs/apk/debug/app-debug.apk
```

or rely on the separate **PowerShell `zipalign`** check above.

**Good ELF outcome:** `ELF Verification Successful` in the script output.

#### Manual `llvm-objdump` (alternative)

See [Android docs — command-line tools](https://developer.android.com/guide/practices/page-sizes#alignment-use-tools): unzip the APK, then run `llvm-objdump -p` on each `lib/arm64-v8a/*.so` and ensure every `LOAD` line shows **`align 2**14`** (or higher), not `2**12` / `2**13`.

```powershell
Expand-Archive -Path .\app-debug.apk -DestinationPath .\apk_elf_check -Force
# Then per .so, e.g.:
# ...\ndk\VERSION\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-objdump.exe -p .\apk_elf_check\lib\arm64-v8a\libhermes.so | Select-String "LOAD"
```

#### Success criteria (full picture)

- No 16 KB compatibility warning on device/emulator for the tested build.
- **`zipalign -c -P 16 4`** succeeds on the same APK you ship or analyze.
- **`check_elf_alignment.sh`** reports **ELF Verification Successful** (or manual `llvm-objdump` shows `2**14` on `LOAD` for `arm64-v8a` / `x86_64` libs as required).
- Prefer re-running checks on a **release** APK or **Play AAB** before store submission; debug can differ slightly.

---

## 8) `npm install` / `npx expo install --fix` fails: `expo-router` vs `@expo/log-box` (ERESOLVE)

### Symptom

`npm` exits with `ERESOLVE` after `npx expo install --fix`, for example:

- `Could not resolve dependency: expo-router@"~55.0.8" from the root project`
- `Conflicting peer dependency: @expo/log-box@55.0.8`

### Root cause

The lockfile / `node_modules` can keep an older `expo-router` (e.g. `55.0.7`) that pulls `@expo/metro-runtime@55.0.6` → `@expo/log-box@55.0.7`, while `expo@55.0.9` and `expo-router@55.0.8` expect `@expo/log-box@55.0.8`. npm then cannot reconcile peers in one step.

### Fix (no `--force`, no `--legacy-peer-deps`)

1. Add explicit, SDK-aligned direct dependencies so the resolver picks one chain:

In `package.json` → `dependencies`:

- `"@expo/log-box": "~55.0.8"`
- `"@expo/metro-runtime": "~55.0.7"`
- `"expo-router": "~55.0.8"` (and keep `expo-linking` at `~55.0.9` as required by `expo-router` peers)

2. Install pinned versions and refresh the lockfile:

```bash
npm install @expo/log-box@55.0.8 @expo/metro-runtime@55.0.7 expo-router@55.0.8
```

3. Confirm a single `expo-router` and `@expo/log-box@55.0.8` in the tree:

```bash
npm ls @expo/log-box expo-router @expo/metro-runtime
```

### Verify

```bash
npm install
npx expo-doctor
npm run typecheck
```

### Residual warnings

`npm` may still warn about `valtio` → `use-sync-external-store` vs `react@19` (peer range stops at React 18). That is unrelated to Expo SDK pinning and does not block install if resolution succeeds.

---

## 9) Git: recovering work after a failed or messy pull

### Symptom

- `git pull` prints *Your local changes to the following files would be overwritten by merge* and **aborts**, or merge starts and leaves *Index was not unstashed*.
- After a subsequent successful pull, **large local edits are gone** from `git status`, or **tracked files** were removed on `origin/main` while you still had local modifications.

### Root cause

- Git may **stash your index/worktree automatically** (message like **`WIP on main: <commit>`**) to run the merge. If something fails, that stash is not always reapplied cleanly.
- A **dangling commit** can remain in the object database: it is a full snapshot of your files at stash time, but **no branch points to it** until you recover it.

### Recovery (find the snapshot)

1. List **dangling commits** (safe, read-only):

   ```bash
   git fsck --lost-found
   ```

   Look for lines like `dangling commit <hash>`.

2. Inspect candidates (replace `<hash>`):

   ```bash
   git show --stat <hash>
   ```

   You want a commit whose message is **`WIP on main:`** and whose diff lists **your missing files** (e.g. `package.json`, `README.md`, `features/...`).

3. Restore **tracked files** from that commit into your working tree and index:

   ```bash
   git restore --source=<hash> --worktree --staged .
   ```

   Review with `git status`, then commit when satisfied.

4. **Optional safety net** — keep a named branch pointing at the recovery commit before you run garbage collection:

   ```bash
   git branch recovery/wip-before-pull <hash>
   ```

### If `git stash list` shows entries

```bash
git stash list
git stash show -p stash@{0}
git stash pop   # or git stash apply
```

Prefer explicit `git stash push` before future pulls so the stash has a clear message.

### Prevention checklist

| Step | Action |
|------|--------|
| Before pull | `git status` — know what is modified / untracked |
| If you have local commits not on remote | `git pull --rebase origin main` may be smoother than merge (team policy permitting) |
| If many uncommitted files | **`git stash push -u -m "describe work"`** then pull, then **`git stash pop`** |
| After bad experience | Commit or branch often; **`git branch backup/$(date +%Y%m%d)`** before risky operations |

### Verify

- `git status` shows your expected files.
- `npm install` and `npm run typecheck` pass after restoring `package.json` / lockfile.

---

## 10) Android emulator won’t start, stuck on home, or Expo can’t open AVD

### Symptom

- `expo run:android` / Gradle waits forever after *Opening emulator …*
- **Expo CLI timeout (common):**

  `Error: It took too long to start the Android emulator: Pixel_7. You can try starting the emulator manually from the terminal with: ...\Sdk\emulator\emulator @Pixel_7`

  This means **Expo gave up waiting** — the AVD is slow to boot, stuck, or ADB never reported `device` in time. It is **not** an app-code or 16 KB issue.

- Emulator window shows only the **Android launcher** (no app install).
- Other errors: **cannot launch emulator**, **PANIC**, **ADB** offline.

### Root cause (common)

| Cause | Notes |
|--------|--------|
| **Boot slower than Expo’s wait** | First boot after update, antivirus scanning `Sdk`, or slow disk. |
| **ADB wedged** | Stale `adb` after sleep, VPN, or multiple SDK installs. |
| **AVD cold state** | Corrupted snapshot; needs cold boot or wipe. |
| **Hyper-V / virtualization** | On Windows, ensure [emulator acceleration](https://developer.android.com/studio/run/emulator-acceleration) is supported. |
| **GPU mode** | Try **Software** graphics in AVD **Edit** → Advanced. |

### Fix (order to try)

1. **Start the AVD yourself, then build** (bypasses Expo’s launcher timeout):

   PowerShell (adjust SDK path if yours differs):

   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7
   ```

   Wait until the home screen is responsive. Then in another terminal:

   ```powershell
   adb devices
   ```

   You should see `emulator-5554    device`. Then:

   ```powershell
   npx expo run:android
   ```

   Expo will use the **already running** emulator and skip *Opening emulator …*.

2. **Restart ADB** if `adb devices` shows `offline` or empty:

   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" kill-server
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
   ```

3. **Android Studio** → **Device Manager** → Pixel_7 → **▼** → **Cold Boot Now**. If still bad: **Wipe Data** (emulator storage only).

4. **One SDK path:** `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk` (same as Studio). Restart terminal after env changes.

5. If the build never starts: only then consider `npx expo prebuild --clean` + `npx expo run:android` (CNG projects). **Not** required for a timeout on emulator start alone.

### Verify

- `adb devices` shows one emulator **device** online before you rely on Expo starting the app.
- `npx expo run:android` installs and launches the app after the emulator is already up.

### Relation to §7 (16 KB)

- **§7** = **in-app** “16 KB not compatible” and **ELF / zipalign** on a **built APK**.
- **§10** = **host** can’t boot or attach to the **emulator** in time. Fix boot/ADB first; use §7 only after you get a successful APK on device/emulator.

---

## 11) Gradle: `Could not find method jcenter()` (e.g. `react-native-aes-gcm-crypto`)

### Symptom

Android build fails during Gradle configuration, for example:

`Build file '.../node_modules/react-native-aes-gcm-crypto/android/build.gradle' line: 69`  
`Could not find method jcenter() for arguments [] on repository container`

### Root cause

**JCenter** was shut down and **`jcenter()` was removed** from Gradle’s repository API in modern Gradle versions (see [Gradle upgrading notes](https://docs.gradle.org/current/userguide/upgrading_version_8.html#deprecated_jcenter)). Older library `build.gradle` files still call `jcenter()`, which **fails at evaluation time**.

This repo depends on **`react-native-aes-gcm-crypto`** (thirdweb / wallet stack). Upstream **0.2.2** still contained `jcenter()` in `android/build.gradle`.

### Fix in this repo

- A **`patch-package`** patch removes the `jcenter()` line so only **`mavenCentral()`** and **`google()`** remain.
- **`npm install`** runs **`patch-package`** via **`postinstall`** and reapplies `patches/react-native-aes-gcm-crypto+0.2.2.patch`.

If you see this error after a clean clone: run **`npm install`** again (not only `npm ci` without patches present — the `patches/` folder must be committed).

### Verify

```bash
cd android
./gradlew.bat :react-native-aes-gcm-crypto:tasks
```

(or full `npx expo run:android` once the emulator is ready.)

### History note

This specific **Gradle / jcenter** failure was **not** spelled out in earlier troubleshooting drafts; **`react-native-aes-gcm-crypto`** was only listed as a peer install for thirdweb ([§5](#5-thirdweb-react-native-optional-modules-not-resolved-at-bundle-time)).

