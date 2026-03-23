import { t } from "@/lib/i18n";

/**
 * MVP: Transak only, consistent with `preferredProvider: "transak"`.
 * Allows both production (`*.transak.com`) and staging hosts.
 */
export function assertTrustedTransakOnRampUrl(link: string): void {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    throw new Error(t("errors.invalidOnRampUrl"));
  }
  if (u.protocol !== "https:") {
    throw new Error(t("errors.invalidOnRampUrl"));
  }
  const host = u.hostname.toLowerCase();
  const isTrustedHost = host === "transak.com" || host.endsWith(".transak.com");
  if (!isTrustedHost) {
    throw new Error(t("errors.untrustedOnRampProvider"));
  }
}
