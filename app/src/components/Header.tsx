import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-brand">
          <div className="brand-mark">CS</div>
          <div>
            <p className="brand-title">CryptoShield</p>
            <p className="brand-subtitle">Private staking and credit</p>
          </div>
        </div>
        <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
      </div>
    </header>
  );
}
