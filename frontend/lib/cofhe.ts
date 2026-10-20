import { createCofheConfig } from "@cofhe/react";
import { chains } from "@cofhe/sdk/chains";

export const cofheConfig = createCofheConfig({
  supportedChains: [chains.arbSepolia],
});
