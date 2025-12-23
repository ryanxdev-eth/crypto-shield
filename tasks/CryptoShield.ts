import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Examples (local hardhat):
 *   npx hardhat --network localhost task:shield-address
 *   npx hardhat --network localhost task:stake --amount 0.5
 *   npx hardhat --network localhost task:borrow --amount 0.1
 *   npx hardhat --network localhost task:repay --amount 0.1
 *   npx hardhat --network localhost task:withdraw --amount 0.2
 *   npx hardhat --network localhost task:decrypt-stake
 *   npx hardhat --network localhost task:decrypt-debt
 *   npx hardhat --network localhost task:decrypt-czama
 */

task("task:shield-address", "Prints the CryptoShield address").setAction(
  async function (_taskArguments: TaskArguments, hre) {
    const { deployments } = hre;
    const cryptoShield = await deployments.get("CryptoShield");
    console.log(`CryptoShield address is ${cryptoShield.address}`);
  },
);

task("task:czama-address", "Prints the CZama address").setAction(
  async function (_taskArguments: TaskArguments, hre) {
    const { deployments } = hre;
    const czama = await deployments.get("CZama");
    console.log(`CZama address is ${czama.address}`);
  },
);

task("task:stake", "Stakes ETH into CryptoShield")
  .addParam("amount", "Amount of ETH to stake")
  .addOptionalParam("address", "Optionally specify the CryptoShield address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const value = ethers.parseEther(taskArguments.amount);

    const cryptoShieldDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("CryptoShield");

    const signers = await ethers.getSigners();
    const cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldDeployment.address);

    const tx = await cryptoShield.connect(signers[0]).stake({ value });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:withdraw", "Withdraws staked ETH from CryptoShield")
  .addParam("amount", "Amount of ETH to withdraw")
  .addOptionalParam("address", "Optionally specify the CryptoShield address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const value = ethers.parseEther(taskArguments.amount);

    const cryptoShieldDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("CryptoShield");

    const signers = await ethers.getSigners();
    const cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldDeployment.address);

    const tx = await cryptoShield.connect(signers[0]).withdraw(value);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:borrow", "Borrows cZama from CryptoShield")
  .addParam("amount", "Amount of cZama to borrow (in ETH units)")
  .addOptionalParam("address", "Optionally specify the CryptoShield address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const value = ethers.parseEther(taskArguments.amount);

    await fhevm.initializeCLIApi();

    const cryptoShieldDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("CryptoShield");

    const signers = await ethers.getSigners();
    const cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldDeployment.address);

    const encryptedValue = await fhevm
      .createEncryptedInput(cryptoShieldDeployment.address, signers[0].address)
      .add64(value)
      .encrypt();

    const tx = await cryptoShield
      .connect(signers[0])
      .borrow(encryptedValue.handles[0], encryptedValue.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:repay", "Repays cZama debt to CryptoShield")
  .addParam("amount", "Amount of cZama to repay (in ETH units)")
  .addOptionalParam("address", "Optionally specify the CryptoShield address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const value = ethers.parseEther(taskArguments.amount);

    await fhevm.initializeCLIApi();

    const cryptoShieldDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("CryptoShield");

    const signers = await ethers.getSigners();
    const cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldDeployment.address);

    const encryptedValue = await fhevm
      .createEncryptedInput(cryptoShieldDeployment.address, signers[0].address)
      .add64(value)
      .encrypt();

    const tx = await cryptoShield
      .connect(signers[0])
      .repay(encryptedValue.handles[0], encryptedValue.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:decrypt-stake", "Decrypts the caller's encrypted stake")
  .addOptionalParam("address", "Optionally specify the CryptoShield address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const cryptoShieldDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("CryptoShield");

    const signers = await ethers.getSigners();
    const cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldDeployment.address);

    const encryptedStake = await cryptoShield.getEncryptedStake(signers[0].address);
    const clearStake = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStake,
      cryptoShieldDeployment.address,
      signers[0],
    );
    console.log(`Encrypted stake: ${encryptedStake}`);
    console.log(`Clear stake    : ${clearStake}`);
  });

task("task:decrypt-debt", "Decrypts the caller's encrypted debt")
  .addOptionalParam("address", "Optionally specify the CryptoShield address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const cryptoShieldDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("CryptoShield");

    const signers = await ethers.getSigners();
    const cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldDeployment.address);

    const encryptedDebt = await cryptoShield.getEncryptedDebt(signers[0].address);
    const clearDebt = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedDebt,
      cryptoShieldDeployment.address,
      signers[0],
    );
    console.log(`Encrypted debt: ${encryptedDebt}`);
    console.log(`Clear debt    : ${clearDebt}`);
  });

task("task:decrypt-czama", "Decrypts the caller's CZama balance")
  .addOptionalParam("address", "Optionally specify the CZama address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const czamaDeployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("CZama");

    const signers = await ethers.getSigners();
    const czama = await ethers.getContractAt("CZama", czamaDeployment.address);

    const encryptedBalance = await czama.confidentialBalanceOf(signers[0].address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      czamaDeployment.address,
      signers[0],
    );
    console.log(`Encrypted balance: ${encryptedBalance}`);
    console.log(`Clear balance    : ${clearBalance}`);
  });
