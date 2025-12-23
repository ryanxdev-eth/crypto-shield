# CryptoShield

CryptoShield is a privacy-preserving ETH staking and lending prototype built on Zama FHEVM. Users stake ETH, borrow
confidential cZama, repay their debt, and withdraw ETH, while collateral and debt amounts are tracked as encrypted
values on-chain.

## Project overview
CryptoShield combines two smart contracts and a React front end to demonstrate how fully homomorphic encryption (FHE)
can enable confidential DeFi flows without relying on off-chain trust. The protocol stores encrypted stake and debt
values, checks collateralization with FHE-safe math, and mints a confidential token to represent borrowed value.

## Problems solved
- Privacy leakage in DeFi lending: typical protocols reveal collateral size, debt size, and user positions on-chain.
- Inability to enforce collateral limits without revealing amounts: FHE enables validation while keeping values hidden.
- Confidential accounting for debt and balances: cZama uses encrypted balances for user privacy.

## Advantages
- Confidential accounting: stake and debt are stored as encrypted euint64 values, usable for on-chain checks.
- No off-chain trust for core logic: collateral checks happen on-chain using FHE operations.
- Clear separation of roles: CryptoShield owns the lending logic, CZama owns the token logic.
- Minimal assumptions: no oracle, no liquidation system, and no interest model are required for the demo.
- Front-end compatibility: ethers is used for writes and viem for reads; wallet flow is integrated with RainbowKit.

## Features
- Stake ETH into the protocol.
- Track encrypted stake per account.
- Borrow cZama against encrypted collateral (borrow <= stake).
- Repay cZama to reduce encrypted debt.
- Withdraw ETH as long as plain collateral remains available.
- Decrypt encrypted balances and positions via the FHEVM CLI tasks.

## How it works
### Contracts
- `CryptoShield` (contracts/CryptoShield.sol)
  - Accepts ETH deposits and stores two values per user:
    - Plain stake for ETH accounting and withdrawals.
    - Encrypted stake (euint64) for confidential collateral checks.
  - Stores encrypted debt (euint64) per user.
  - Uses `FHESafeMath` to prevent overflow/underflow on encrypted values.
  - Mints or burns cZama when users borrow or repay.

- `CZama` (contracts/CZama.sol)
  - Confidential ERC7984-compatible token with encrypted balances.
  - The minter is set to `CryptoShield` in the deploy script.

### Confidential flow
1. Stake
   - User sends ETH to `stake()`.
   - The contract stores an encrypted euint64 amount and updates the plain stake.
2. Borrow
   - User sends an encrypted amount and proof to `borrow()`.
   - The contract checks (encrypted) that the new debt does not exceed encrypted stake.
   - If valid, it mints cZama with the encrypted amount.
3. Repay
   - User sends an encrypted amount and proof to `repay()`.
   - The contract reduces encrypted debt and burns cZama.
4. Withdraw
   - User calls `withdraw(amount)`.
   - ETH is transferred after plain stake checks pass.

### What is private vs public
- Encrypted values: stake and debt stored as euint64, and cZama balances.
- Public values: ETH transfer amounts and plain stake bookkeeping are visible on-chain.

## Tech stack
- Solidity 0.8.27
- Hardhat + hardhat-deploy
- Zama FHEVM Solidity library
- OpenZeppelin Confidential Contracts (ERC7984)
- TypeScript + ethers v6
- React + Vite + TypeScript
- viem for reads, ethers for writes
- RainbowKit + wagmi

## Repository layout
- `contracts/` smart contracts
- `deploy/` deployment scripts
- `tasks/` Hardhat tasks for FHE interactions
- `test/` contract tests
- `app/` React front end
- `deployments/` deployed artifacts and ABIs
- `docs/` Zama integration docs

## Development and usage
### Prerequisites
- Node.js 20+
- npm 7+

### Install dependencies (root)
```bash
npm install
```

### Environment variables
Create a `.env` file in the repo root with the following values:
```
PRIVATE_KEY=your_sepolia_private_key
INFURA_API_KEY=your_infura_project_id
ETHERSCAN_API_KEY=optional_for_verification
```
Notes:
- `PRIVATE_KEY` is required for Sepolia deployment.
- Do not use a mnemonic-based configuration.

### Compile and test
```bash
npm run compile
npm run test
```

### Local node and local deployment
```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Sepolia deployment
```bash
npm run deploy:sepolia
```

### Verify on Sepolia (optional)
```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

### Run Hardhat tasks
Examples:
```bash
npx hardhat --network localhost task:shield-address
npx hardhat --network localhost task:stake --amount 0.5
npx hardhat --network localhost task:borrow --amount 0.1
npx hardhat --network localhost task:repay --amount 0.1
npx hardhat --network localhost task:withdraw --amount 0.2
npx hardhat --network localhost task:decrypt-stake
npx hardhat --network localhost task:decrypt-debt
npx hardhat --network localhost task:decrypt-czama
```

## Frontend
### Install dependencies
```bash
cd app
npm install
```

### Configure contract addresses and ABIs
- Update `app/src/config/contracts.ts` with:
  - The deployed `CryptoShield` and `CZama` addresses.
  - The ABIs copied from `deployments/sepolia` (do not import JSON in the frontend).

### Run the app
```bash
npm run dev
```

### Frontend expectations
- Reads use viem and writes use ethers.
- Contract interaction is designed for Sepolia (no localhost network usage).
- The UI avoids local storage and relies on wallet state.

## Security considerations and limitations
- Borrow limit is 1:1 against encrypted stake; there is no interest model or liquidation.
- Amounts are limited to uint64 in encrypted form.
- ETH transfers are visible on-chain even though encrypted accounting is used for logic.
- This project is a prototype and has not been audited.

## Future roadmap
- Add interest rate models and configurable collateral ratios.
- Add liquidation mechanics with confidential price feeds.
- Support multiple collateral assets beyond ETH.
- Introduce role-based access control for protocol administration.
- Expand front-end analytics with privacy-preserving summaries.
- Add comprehensive property-based tests and fuzzing for encrypted flows.
- Improve UX for encrypted input creation and error recovery.
- Explore gas optimizations for FHE operations.

## License
BSD-3-Clause-Clear. See `LICENSE`.
