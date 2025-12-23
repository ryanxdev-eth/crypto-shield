// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {euint64} from "@fhevm/solidity/lib/FHE.sol";

contract CZama is ERC7984, ZamaEthereumConfig {
    address public owner;
    address public minter;

    error UnauthorizedOwner(address caller);
    error UnauthorizedMinter(address caller);
    error InvalidMinter(address minter);

    constructor(address initialMinter) ERC7984("cZama", "cZama", "") {
        owner = msg.sender;
        if (initialMinter == address(0)) {
            revert InvalidMinter(initialMinter);
        }
        minter = initialMinter;
    }

    function updateMinter(address newMinter) external {
        if (msg.sender != owner) {
            revert UnauthorizedOwner(msg.sender);
        }
        if (newMinter == address(0)) {
            revert InvalidMinter(newMinter);
        }
        minter = newMinter;
    }

    function mint(address to, euint64 amount) external returns (euint64) {
        if (msg.sender != minter) {
            revert UnauthorizedMinter(msg.sender);
        }
        return _mint(to, amount);
    }

    function burnFrom(address from, euint64 amount) external returns (euint64) {
        if (msg.sender != minter) {
            revert UnauthorizedMinter(msg.sender);
        }
        return _burn(from, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
