import { createThirdwebClient, type ThirdwebClient } from "thirdweb";

import { getEnv } from "@/lib/env";

let client: ThirdwebClient | null = null;

export function getThirdwebBrowserClient(): ThirdwebClient {
  if (!client) {
    client = createThirdwebClient({ clientId: getEnv().EXPO_PUBLIC_THIRDWEB_CLIENT_ID });
  }
  return client;
}
