"use client";

import { ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePublicClient, useWalletClient } from "wagmi";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { WagmiProvider, useSetActiveWallet } from "@privy-io/wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { CofheProvider, useCofheAutoConnect } from "@cofhe/react";
import { wagmiConfig } from "@/lib/wagmi";
import { cofheConfig } from "@/lib/cofhe";

const queryClient = new QueryClient();

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// wagmi/@privy-io/wagmi registers a connector for every wallet Privy knows about --
// the embedded wallet AND any installed browser extension it detects (MetaMask etc) --
// even if the user never explicitly chose that extension. Without this, wagmi's "active"
// connector can end up pointing at a detected-but-unused MetaMask instead of the wallet
// the user actually authenticated with, so transactions pop MetaMask instead of using the
// Privy embedded wallet. Pin the active connector to Privy's own notion of the user's
// primary wallet (`user.wallet`, which is the embedded wallet for email/social logins and
// the connected extension for wallet-first logins) every time it changes.
function ActiveWalletSync() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  useEffect(() => {
    const primaryAddress = user?.wallet?.address;
    if (!primaryAddress) return;
    const match = wallets.find((w) => w.address.toLowerCase() === primaryAddress.toLowerCase());
    if (match) setActiveWallet(match);
  }, [user?.wallet?.address, wallets, setActiveWallet]);

  return null;
}

function CofheAutoConnector({ children }: { children: ReactNode }) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  useCofheAutoConnect({ walletClient, publicClient });
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Casual mode should stay wallet-optional to actually play (see /practice) --
        // Privy is only the on-chain path's connect flow, so give it a broad set of
        // login options (email/social for newcomers, plus real wallets) rather than
        // assuming everyone who clicks "Connect Wallet" already has one installed.
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#22d3ee",
        },
        defaultChain: arbitrumSepolia,
        supportedChains: [arbitrumSepolia],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ActiveWalletSync />
          <CofheProvider config={cofheConfig}>
            <CofheAutoConnector>{children}</CofheAutoConnector>
          </CofheProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
