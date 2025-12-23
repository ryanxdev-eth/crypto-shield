import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { CZama, CryptoShield, CZama__factory, CryptoShield__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture(deployer: HardhatEthersSigner) {
  const czamaFactory = (await ethers.getContractFactory("CZama")) as CZama__factory;
  const czama = (await czamaFactory.connect(deployer).deploy(deployer.address)) as CZama;
  const czamaAddress = await czama.getAddress();

  const cryptoShieldFactory = (await ethers.getContractFactory("CryptoShield")) as CryptoShield__factory;
  const cryptoShield = (await cryptoShieldFactory.connect(deployer).deploy(czamaAddress)) as CryptoShield;
  const cryptoShieldAddress = await cryptoShield.getAddress();

  await czama.connect(deployer).updateMinter(cryptoShieldAddress);

  return { czama, czamaAddress, cryptoShield, cryptoShieldAddress };
}

describe("CryptoShield", function () {
  let signers: Signers;
  let czama: CZama;
  let czamaAddress: string;
  let cryptoShield: CryptoShield;
  let cryptoShieldAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This hardhat test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ czama, czamaAddress, cryptoShield, cryptoShieldAddress } = await deployFixture(signers.deployer));
  });

  it("stakes ETH and stores encrypted balance", async function () {
    const stakeAmount = ethers.parseEther("1");

    await cryptoShield.connect(signers.alice).stake({ value: stakeAmount });

    const encryptedStake = await cryptoShield.getEncryptedStake(signers.alice.address);
    const clearStake = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStake,
      cryptoShieldAddress,
      signers.alice,
    );

    expect(clearStake).to.eq(stakeAmount);
  });

  it("borrows and repays cZama with encrypted debt tracking", async function () {
    const stakeAmount = ethers.parseEther("1");
    const borrowAmount = ethers.parseEther("0.4");

    await cryptoShield.connect(signers.alice).stake({ value: stakeAmount });

    const borrowInput = await fhevm
      .createEncryptedInput(cryptoShieldAddress, signers.alice.address)
      .add64(borrowAmount)
      .encrypt();

    await cryptoShield.connect(signers.alice).borrow(borrowInput.handles[0], borrowInput.inputProof);

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

    const repayInput = await fhevm
      .createEncryptedInput(cryptoShieldAddress, signers.alice.address)
      .add64(borrowAmount)
      .encrypt();

    await cryptoShield.connect(signers.alice).repay(repayInput.handles[0], repayInput.inputProof);

    const encryptedDebtAfter = await cryptoShield.getEncryptedDebt(signers.alice.address);
    const clearDebtAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedDebtAfter,
      cryptoShieldAddress,
      signers.alice,
    );
    expect(clearDebtAfter).to.eq(0n);

    const encryptedBalanceAfter = await czama.confidentialBalanceOf(signers.alice.address);
    const clearBalanceAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalanceAfter,
      czamaAddress,
      signers.alice,
    );
    expect(clearBalanceAfter).to.eq(0n);
  });

  it("withdraws staked ETH and updates encrypted stake", async function () {
    const stakeAmount = ethers.parseEther("1");
    const withdrawAmount = ethers.parseEther("0.25");

    await cryptoShield.connect(signers.alice).stake({ value: stakeAmount });
    await cryptoShield.connect(signers.alice).withdraw(withdrawAmount);

    const encryptedStake = await cryptoShield.getEncryptedStake(signers.alice.address);
    const clearStake = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStake,
      cryptoShieldAddress,
      signers.alice,
    );
    expect(clearStake).to.eq(stakeAmount - withdrawAmount);
  });

  it("reverts borrowing without a stake", async function () {
    const borrowAmount = ethers.parseEther("0.1");
    const borrowInput = await fhevm
      .createEncryptedInput(cryptoShieldAddress, signers.alice.address)
      .add64(borrowAmount)
      .encrypt();

    await expect(
      cryptoShield.connect(signers.alice).borrow(borrowInput.handles[0], borrowInput.inputProof),
    ).to.be.revertedWithCustomError(cryptoShield, "NoStake");
  });
});
