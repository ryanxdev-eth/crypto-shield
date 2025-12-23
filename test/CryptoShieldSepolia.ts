import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { CZama, CryptoShield } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("CryptoShieldSepolia", function () {
  let signers: Signers;
  let cryptoShield: CryptoShield;
  let czama: CZama;
  let cryptoShieldAddress: string;
  let czamaAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn("This hardhat test suite can only run on Sepolia Testnet");
      this.skip();
    }

    try {
      const cryptoShieldDeployment = await deployments.get("CryptoShield");
      cryptoShieldAddress = cryptoShieldDeployment.address;
      cryptoShield = await ethers.getContractAt("CryptoShield", cryptoShieldAddress);

      const czamaDeployment = await deployments.get("CZama");
      czamaAddress = czamaDeployment.address;
      czama = await ethers.getContractAt("CZama", czamaAddress);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  it("stakes and borrows on Sepolia", async function () {
    this.timeout(4 * 40000);

    const stakeAmount = ethers.parseEther("0.01");
    const borrowAmount = ethers.parseEther("0.002");

    const stakeTx = await cryptoShield.connect(signers.alice).stake({ value: stakeAmount });
    await stakeTx.wait();

    const borrowInput = await fhevm
      .createEncryptedInput(cryptoShieldAddress, signers.alice.address)
      .add64(borrowAmount)
      .encrypt();

    const borrowTx = await cryptoShield.connect(signers.alice).borrow(borrowInput.handles[0], borrowInput.inputProof);
    await borrowTx.wait();

    const encryptedDebt = await cryptoShield.getEncryptedDebt(signers.alice.address);
    const clearDebt = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedDebt,
      cryptoShieldAddress,
      signers.alice,
    );
    expect(clearDebt).to.eq(borrowAmount);

    const encryptedBalance = await czama.confidentialBalanceOf(signers.alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      czamaAddress,
      signers.alice,
    );
    expect(clearBalance).to.eq(borrowAmount);
  });
});
