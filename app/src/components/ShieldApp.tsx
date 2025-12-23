import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, ethers } from 'ethers';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CRYPTO_SHIELD_ADDRESS, CRYPTO_SHIELD_ABI, CZAMA_ADDRESS, CZAMA_ABI } from '../config/contracts';
import '../styles/ShieldApp.css';

type StatusType = 'idle' | 'pending' | 'success' | 'error';

type StatusState = {
  type: StatusType;
  message: string;
  txHash?: string;
};

type DecryptedState = {
  stake: bigint;
  debt: bigint;
  balance: bigint;
};

const ZERO_HANDLE = ethers.ZeroHash;
const ZERO_ADDRESS = ethers.ZeroAddress;

const trimDecimals = (value: string, decimals = 6) => {
  const [whole, fraction] = value.split('.');
  if (!fraction) {
    return whole;
  }
  return `${whole}.${fraction.slice(0, decimals)}`;
};

const formatAmount = (value?: bigint) => {
  if (value === undefined) {
    return '--';
  }
  return trimDecimals(ethers.formatEther(value));
};

const shortenAddress = (address?: string) => {
  if (!address) {
    return 'Not connected';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatContractAddress = (address: string, label: string) => {
  if (address === ZERO_ADDRESS) {
    return `Set ${label} address`;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const parseAmount = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Enter an amount.');
  }
  const parsed = ethers.parseEther(trimmed);
  if (parsed <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }
  return parsed;
};

const toBigIntValue = (value: unknown) => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    return BigInt(value);
  }
  return 0n;
};

export function ShieldApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: isZamaLoading, error: zamaError } = useZamaInstance();

  const [stakeInput, setStakeInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [repayInput, setRepayInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedState | null>(null);

  const hasShieldAddress = CRYPTO_SHIELD_ADDRESS !== ZERO_ADDRESS;
  const hasCzamaAddress = CZAMA_ADDRESS !== ZERO_ADDRESS;

  const { data: encryptedStake } = useReadContract({
    address: CRYPTO_SHIELD_ADDRESS,
    abi: CRYPTO_SHIELD_ABI,
    functionName: 'getEncryptedStake',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && hasShieldAddress,
    },
  });

  const { data: encryptedDebt } = useReadContract({
    address: CRYPTO_SHIELD_ADDRESS,
    abi: CRYPTO_SHIELD_ABI,
    functionName: 'getEncryptedDebt',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && hasShieldAddress,
    },
  });

  const { data: encryptedBalance } = useReadContract({
    address: CZAMA_ADDRESS,
    abi: CZAMA_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && hasCzamaAddress,
    },
  });

  const availableCollateral = useMemo(() => {
    if (!decrypted) {
      return undefined;
    }
    return decrypted.stake > decrypted.debt ? decrypted.stake - decrypted.debt : 0n;
  }, [decrypted]);

  const runTransaction = async (
    action: string,
    callback: () => Promise<{ hash: string; wait: () => Promise<unknown> }>,
  ) => {
    try {
      setBusyAction(action);
      setStatus({ type: 'pending', message: 'Preparing transaction...' });
      const tx = await callback();
      setStatus({ type: 'pending', message: 'Waiting for confirmation...', txHash: tx.hash });
      await tx.wait();
      setStatus({ type: 'success', message: 'Transaction confirmed.', txHash: tx.hash });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed.';
      setStatus({ type: 'error', message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleStake = async () => {
    if (!isConnected || !address) {
      setStatus({ type: 'error', message: 'Connect your wallet to stake.' });
      return;
    }
    if (!hasShieldAddress) {
      setStatus({ type: 'error', message: 'CryptoShield address is not set.' });
      return;
    }
    if (!signerPromise) {
      setStatus({ type: 'error', message: 'Wallet signer not ready.' });
      return;
    }

    await runTransaction('stake', async () => {
      const value = parseAmount(stakeInput);
      const signer = await signerPromise;
      const contract = new Contract(CRYPTO_SHIELD_ADDRESS, CRYPTO_SHIELD_ABI, signer);
      const tx = await contract.stake({ value });
      setStakeInput('');
      return tx;
    });
  };

  const handleWithdraw = async () => {
    if (!isConnected || !address) {
      setStatus({ type: 'error', message: 'Connect your wallet to withdraw.' });
      return;
    }
    if (!hasShieldAddress) {
      setStatus({ type: 'error', message: 'CryptoShield address is not set.' });
      return;
    }
    if (!signerPromise) {
      setStatus({ type: 'error', message: 'Wallet signer not ready.' });
      return;
    }

    await runTransaction('withdraw', async () => {
      const value = parseAmount(withdrawInput);
      const signer = await signerPromise;
      const contract = new Contract(CRYPTO_SHIELD_ADDRESS, CRYPTO_SHIELD_ABI, signer);
      const tx = await contract.withdraw(value);
      setWithdrawInput('');
      return tx;
    });
  };

  const handleBorrow = async () => {
    if (!isConnected || !address) {
      setStatus({ type: 'error', message: 'Connect your wallet to borrow.' });
      return;
    }
    if (!hasShieldAddress) {
      setStatus({ type: 'error', message: 'CryptoShield address is not set.' });
      return;
    }
    if (!hasCzamaAddress) {
      setStatus({ type: 'error', message: 'cZama address is not set.' });
      return;
    }
    if (!signerPromise) {
      setStatus({ type: 'error', message: 'Wallet signer not ready.' });
      return;
    }
    if (!instance) {
      setStatus({ type: 'error', message: 'Encryption service is not ready.' });
      return;
    }

    await runTransaction('borrow', async () => {
      const value = parseAmount(borrowInput);
      const encryptedInput = await instance
        .createEncryptedInput(CRYPTO_SHIELD_ADDRESS, address)
        .add64(value)
        .encrypt();

      const signer = await signerPromise;
      const contract = new Contract(CRYPTO_SHIELD_ADDRESS, CRYPTO_SHIELD_ABI, signer);
      const tx = await contract.borrow(encryptedInput.handles[0], encryptedInput.inputProof);
      setBorrowInput('');
      return tx;
    });
  };

  const handleRepay = async () => {
    if (!isConnected || !address) {
      setStatus({ type: 'error', message: 'Connect your wallet to repay.' });
      return;
    }
    if (!hasShieldAddress) {
      setStatus({ type: 'error', message: 'CryptoShield address is not set.' });
      return;
    }
    if (!hasCzamaAddress) {
      setStatus({ type: 'error', message: 'cZama address is not set.' });
      return;
    }
    if (!signerPromise) {
      setStatus({ type: 'error', message: 'Wallet signer not ready.' });
      return;
    }
    if (!instance) {
      setStatus({ type: 'error', message: 'Encryption service is not ready.' });
      return;
    }

    await runTransaction('repay', async () => {
      const value = parseAmount(repayInput);
      const encryptedInput = await instance
        .createEncryptedInput(CRYPTO_SHIELD_ADDRESS, address)
        .add64(value)
        .encrypt();

      const signer = await signerPromise;
      const contract = new Contract(CRYPTO_SHIELD_ADDRESS, CRYPTO_SHIELD_ABI, signer);
      const tx = await contract.repay(encryptedInput.handles[0], encryptedInput.inputProof);
      setRepayInput('');
      return tx;
    });
  };

  const decryptBalances = async () => {
    if (!isConnected || !address) {
      setStatus({ type: 'error', message: 'Connect your wallet to decrypt balances.' });
      return;
    }
    if (!hasShieldAddress || !hasCzamaAddress) {
      setStatus({ type: 'error', message: 'Contract addresses are not set.' });
      return;
    }
    if (!instance) {
      setStatus({ type: 'error', message: 'Encryption service is not ready.' });
      return;
    }
    if (!signerPromise) {
      setStatus({ type: 'error', message: 'Wallet signer not ready.' });
      return;
    }

    const stakeHandle = encryptedStake as string | undefined;
    const debtHandle = encryptedDebt as string | undefined;
    const balanceHandle = encryptedBalance as string | undefined;

    const handleContractPairs: { handle: string; contractAddress: string }[] = [];
    if (stakeHandle && stakeHandle !== ZERO_HANDLE) {
      handleContractPairs.push({ handle: stakeHandle, contractAddress: CRYPTO_SHIELD_ADDRESS });
    }
    if (debtHandle && debtHandle !== ZERO_HANDLE) {
      handleContractPairs.push({ handle: debtHandle, contractAddress: CRYPTO_SHIELD_ADDRESS });
    }
    if (balanceHandle && balanceHandle !== ZERO_HANDLE) {
      handleContractPairs.push({ handle: balanceHandle, contractAddress: CZAMA_ADDRESS });
    }

    if (!handleContractPairs.length) {
      setDecrypted({ stake: 0n, debt: 0n, balance: 0n });
      return;
    }

    try {
      setBusyAction('decrypt');
      setStatus({ type: 'pending', message: 'Requesting decryption signature...' });
      const signer = await signerPromise;
      const keypair = instance.generateKeypair();
      const contractAddresses = Array.from(
        new Set(handleContractPairs.map((item) => item.contractAddress)),
      );
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays,
      );

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const stakeValue = stakeHandle ? toBigIntValue(result[stakeHandle]) : 0n;
      const debtValue = debtHandle ? toBigIntValue(result[debtHandle]) : 0n;
      const balanceValue = balanceHandle ? toBigIntValue(result[balanceHandle]) : 0n;

      setDecrypted({
        stake: stakeValue,
        debt: debtValue,
        balance: balanceValue,
      });
      setStatus({ type: 'success', message: 'Balances decrypted.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decryption failed.';
      setStatus({ type: 'error', message });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="shield-app">
      <Header />
      <main className="shield-main">
        <section className="hero">
          <div className="hero-text">
            <p className="hero-eyebrow">Encrypted Staking Protocol</p>
            <h2 className="hero-title">Stake ETH, borrow cZama, keep the numbers private.</h2>
            <p className="hero-subtitle">
              CryptoShield stores your stake and debt as encrypted balances using Zama FHE. Only you can
              decrypt them, while the protocol keeps the flows secure.
            </p>
          </div>
          <div className="hero-panel">
            <div className="panel-row">
              <span className="panel-label">Wallet</span>
              <span className="panel-value">{shortenAddress(address)}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">Network</span>
              <span className="panel-value">Sepolia</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">Encryption</span>
              <span className={`panel-value ${zamaError ? 'panel-error' : ''}`}>
                {zamaError ? 'Unavailable' : isZamaLoading ? 'Initializing' : 'Ready'}
              </span>
            </div>
            <div className="panel-row">
              <span className="panel-label">CryptoShield</span>
              <span className="panel-value mono">{formatContractAddress(CRYPTO_SHIELD_ADDRESS, 'CryptoShield')}</span>
            </div>
            <div className="panel-row">
              <span className="panel-label">cZama</span>
              <span className="panel-value mono">{formatContractAddress(CZAMA_ADDRESS, 'cZama')}</span>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Encrypted Stake</p>
            <h3 className="stat-value">{decrypted ? `${formatAmount(decrypted.stake)} ETH` : '***'}</h3>
            <p className="stat-helper">Available: {decrypted ? `${formatAmount(availableCollateral)} ETH` : '***'}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Encrypted Debt</p>
            <h3 className="stat-value">{decrypted ? `${formatAmount(decrypted.debt)} cZama` : '***'}</h3>
            <p className="stat-helper">Debt stays confidential until you decrypt.</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">cZama Balance</p>
            <h3 className="stat-value">{decrypted ? `${formatAmount(decrypted.balance)} cZama` : '***'}</h3>
            <p className="stat-helper">Minted balance lives on-chain in FHE form.</p>
          </div>
          <div className="stat-card stat-action">
            <p className="stat-label">Decrypt Balances</p>
            <p className="stat-helper">Sign once to view your encrypted positions.</p>
            <button
              type="button"
              className="primary-button"
              onClick={decryptBalances}
              disabled={busyAction === 'decrypt' || !isConnected || isZamaLoading}
            >
              {busyAction === 'decrypt' ? 'Decrypting...' : 'Decrypt Now'}
            </button>
            {decrypted && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDecrypted(null)}
                disabled={busyAction === 'decrypt'}
              >
                Hide Values
              </button>
            )}
          </div>
        </section>

        <section className="actions-grid">
          <div className="action-card">
            <h3 className="action-title">Stake & Withdraw</h3>
            <p className="action-description">
              Deposit ETH to unlock encrypted borrowing capacity. Withdraw when you want to exit.
            </p>
            <div className="field-group">
              <label className="field-label" htmlFor="stake-amount">Amount (ETH)</label>
              <input
                id="stake-amount"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.25"
                value={stakeInput}
                onChange={(event) => setStakeInput(event.target.value)}
                className="text-input"
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={handleStake}
                disabled={busyAction !== null || !isConnected}
              >
                {busyAction === 'stake' ? 'Staking...' : 'Stake ETH'}
              </button>
            </div>

            <div className="divider" />

            <div className="field-group">
              <label className="field-label" htmlFor="withdraw-amount">Withdraw (ETH)</label>
              <input
                id="withdraw-amount"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.10"
                value={withdrawInput}
                onChange={(event) => setWithdrawInput(event.target.value)}
                className="text-input"
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                className="ghost-button"
                onClick={handleWithdraw}
                disabled={busyAction !== null || !isConnected}
              >
                {busyAction === 'withdraw' ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </div>

          <div className="action-card">
            <h3 className="action-title">Borrow & Repay</h3>
            <p className="action-description">
              Borrow cZama with encrypted debt tracking. Repay whenever you are ready.
            </p>
            <div className="field-group">
              <label className="field-label" htmlFor="borrow-amount">Borrow (cZama)</label>
              <input
                id="borrow-amount"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.15"
                value={borrowInput}
                onChange={(event) => setBorrowInput(event.target.value)}
                className="text-input"
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={handleBorrow}
                disabled={busyAction !== null || !isConnected || isZamaLoading}
              >
                {busyAction === 'borrow' ? 'Borrowing...' : 'Borrow cZama'}
              </button>
            </div>

            <div className="divider" />

            <div className="field-group">
              <label className="field-label" htmlFor="repay-amount">Repay (cZama)</label>
              <input
                id="repay-amount"
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.05"
                value={repayInput}
                onChange={(event) => setRepayInput(event.target.value)}
                className="text-input"
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                className="ghost-button"
                onClick={handleRepay}
                disabled={busyAction !== null || !isConnected || isZamaLoading}
              >
                {busyAction === 'repay' ? 'Repaying...' : 'Repay Debt'}
              </button>
            </div>
          </div>
        </section>

        <section className={`status-panel ${status ? `status-${status.type}` : ''}`}>
          <div>
            <h4>Status</h4>
            <p>
              {status ? status.message : 'Ready for your next encrypted action.'}
            </p>
          </div>
          {status?.txHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${status.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="status-link"
            >
              View transaction
            </a>
          ) : null}
        </section>
      </main>
    </div>
  );
}
