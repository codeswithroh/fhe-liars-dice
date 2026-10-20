import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  console.log(`Deploying LiarsDice from ${deployer.address} on chain ${net.chainId}`);

  const game = await hre.ethers.deployContract("LiarsDice");
  await game.waitForDeployment();
  const address = await game.getAddress();
  const tx = game.deploymentTransaction()!;
  console.log(`LiarsDice ${await game.VERSION()} deployed at ${address} (tx ${tx.hash})`);

  const out = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        LiarsDice: address,
        version: await game.VERSION(),
        chainId: Number(net.chainId),
        txHash: tx.hash,
        deployer: deployer.address,
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
