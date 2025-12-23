// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";
import {CZama} from "./CZama.sol";

contract CryptoShield is ZamaEthereumConfig {
    CZama public immutable czama;

    mapping(address account => euint64) private _stakedEncrypted;
    mapping(address account => euint64) private _debtEncrypted;
    mapping(address account => uint256) private _stakedPlain;

    error ZeroStakeAmount();
    error StakeTooLarge();
    error NoStake();
    error ZeroWithdrawAmount();
    error InsufficientStake();
    error EthTransferFailed();

    event StakeDeposited(address indexed account, uint256 amount);
    event StakeWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, euint64 amount);
    event Repaid(address indexed account, euint64 amount);

    constructor(address czamaAddress) {
        czama = CZama(czamaAddress);
    }

    function stake() external payable {
        if (msg.value == 0) {
            revert ZeroStakeAmount();
        }

        uint256 nextPlain = _stakedPlain[msg.sender] + msg.value;
        if (nextPlain > type(uint64).max) {
            revert StakeTooLarge();
        }

        _stakedPlain[msg.sender] = nextPlain;

        euint64 amount = FHE.asEuint64(uint64(msg.value));
        (, euint64 updated) = FHESafeMath.tryIncrease(_stakedEncrypted[msg.sender], amount);
        _stakedEncrypted[msg.sender] = updated;
        FHE.allowThis(updated);
        FHE.allow(updated, msg.sender);

        emit StakeDeposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) {
            revert ZeroWithdrawAmount();
        }

        uint256 currentPlain = _stakedPlain[msg.sender];
        if (amount > currentPlain) {
            revert InsufficientStake();
        }
        if (amount > type(uint64).max) {
            revert StakeTooLarge();
        }

        _stakedPlain[msg.sender] = currentPlain - amount;

        euint64 encryptedAmount = FHE.asEuint64(uint64(amount));
        (, euint64 updated) = FHESafeMath.tryDecrease(_stakedEncrypted[msg.sender], encryptedAmount);
        _stakedEncrypted[msg.sender] = updated;
        FHE.allowThis(updated);
        FHE.allow(updated, msg.sender);

        emit StakeWithdrawn(msg.sender, amount);

        (bool sent, ) = msg.sender.call{value: amount}("");
        if (!sent) {
            revert EthTransferFailed();
        }
    }

    function borrow(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        if (_stakedPlain[msg.sender] == 0) {
            revert NoStake();
        }

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentDebt = _debtEncrypted[msg.sender];

        (ebool increasedOk, euint64 increasedDebt) = FHESafeMath.tryIncrease(currentDebt, amount);
        ebool withinCollateral = FHE.le(increasedDebt, _stakedEncrypted[msg.sender]);
        ebool canBorrow = FHE.and(increasedOk, withinCollateral);

        euint64 finalDebt = FHE.select(canBorrow, increasedDebt, currentDebt);
        _debtEncrypted[msg.sender] = finalDebt;
        FHE.allowThis(finalDebt);
        FHE.allow(finalDebt, msg.sender);

        euint64 mintAmount = FHE.select(canBorrow, amount, FHE.asEuint64(0));
        FHE.allow(mintAmount, address(czama));
        czama.mint(msg.sender, mintAmount);

        emit Borrowed(msg.sender, mintAmount);
    }

    function repay(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentDebt = _debtEncrypted[msg.sender];

        (ebool canRepay, euint64 updatedDebt) = FHESafeMath.tryDecrease(currentDebt, amount);
        _debtEncrypted[msg.sender] = updatedDebt;
        FHE.allowThis(updatedDebt);
        FHE.allow(updatedDebt, msg.sender);

        euint64 burnAmount = FHE.select(canRepay, amount, FHE.asEuint64(0));
        FHE.allow(burnAmount, address(czama));
        czama.burnFrom(msg.sender, burnAmount);

        emit Repaid(msg.sender, burnAmount);
    }

    function getEncryptedStake(address account) external view returns (euint64) {
        return _stakedEncrypted[account];
    }

    function getEncryptedDebt(address account) external view returns (euint64) {
        return _debtEncrypted[account];
    }
}
