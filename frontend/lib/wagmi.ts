import { http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { createConfig } from "@privy-io/wagmi";

// Config comes from @privy-io/wagmi's own createConfig (not raw wagmi's) -- it's a
// drop-in replacement that Privy's WagmiProvider expects, so its wagmi Config instance
// tracks whichever wallet Privy has active (embedded, external, email/social login) as
// the connection. No manual connectors (injected/walletConnect) needed here anymore;
// Privy's own login modal is what offers those choices now.
export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export const TARGET_CHAIN_ID = arbitrumSepolia.id;
