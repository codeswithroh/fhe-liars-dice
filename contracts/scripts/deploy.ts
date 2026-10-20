import hre from "hardhat";
import fs from "fs";
import path from "path";

/** Previous FheLiarsDice deployment (cofhe-contracts 0.x) whose points carry over. */
const LEGACY_FHE_LIARS_DICE = process.env.LEGACY_FHE_LIARS_DICE ?? "0x20B850b6ddCF9dC4E6cf6a403B27d962B3B9F9Da";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  console.log(`Deploying FheLiarsDice from ${deployer.address} on chain ${net.chainId} (legacy ${LEGACY_FHE_LIARS_DICE})`);

  const game = await hre.ethers.deployContract("FheLiarsDice", [LEGACY_FHE_LIARS_DICE]);
  await game.waitForDeployment();
  const address = await game.getAddress();
  const tx = game.deploymentTransaction()!;
  const receipt = await tx.wait();
  console.log(`FheLiarsDice ${await game.VERSION()} deployed at ${address} (tx ${tx.hash}, block ${receipt!.blockNumber})`);

  const out = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        FheLiarsDice: address,
        version: await game.VERSION(),
        chainId: Number(net.chainId),
        txHash: tx.hash,
        blockNumber: receipt!.blockNumber,
        deployer: deployer.address,
        legacy: LEGACY_FHE_LIARS_DICE,
        cofhe: { sdk: "1.0.1", hardhatPlugin: "1.0.1", contracts: "1.0.1" },
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
