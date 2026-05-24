import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import type { ReactNode } from "react";

const { networkConfig } = createNetworkConfig({
  mainnet: { url: "https://fullnode.mainnet.sui.io:443", network: "mainnet" as const },
});

export default function SuiProviders({ children }: { children: ReactNode }) {
  return (
    <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
      <WalletProvider autoConnect preferredWallets={["Sui Wallet", "Suiet"]}>
        {children}
      </WalletProvider>
    </SuiClientProvider>
  );
}
