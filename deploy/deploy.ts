import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedCZama = await deploy("CZama", {
    from: deployer,
    args: [deployer],
    log: true,
  });

  const deployedCryptoShield = await deploy("CryptoShield", {
    from: deployer,
    args: [deployedCZama.address],
    log: true,
  });

  const czama = await hre.ethers.getContractAt("CZama", deployedCZama.address);
  const tx = await czama.updateMinter(deployedCryptoShield.address);
  await tx.wait();

  console.log(`CZama contract: `, deployedCZama.address);
  console.log(`CryptoShield contract: `, deployedCryptoShield.address);
};
export default func;
func.id = "deploy_cryptoShield";
func.tags = ["CZama", "CryptoShield"];
