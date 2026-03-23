/**
 * MVP : Transak uniquement — même contrat que `preferredProvider: "transak"`.
 * Autorise prod (`*.transak.com`) et staging (`global-stg.transak.com`, etc.).
 */
export function assertTrustedTransakOnRampUrl(link: string): void {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    throw new Error("URL on-ramp invalide");
  }
  if (u.protocol !== "https:") {
    throw new Error("URL on-ramp invalide");
  }
  const host = u.hostname.toLowerCase();
  const isTrustedHost = host === "transak.com" || host.endsWith(".transak.com");
  if (!isTrustedHost) {
    throw new Error("Fournisseur on-ramp non autorisé");
  }
}
