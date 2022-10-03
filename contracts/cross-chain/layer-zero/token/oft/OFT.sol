// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-0.8/utils/introspection/IERC165.sol";
import "./IOFT.sol";
import "./OFTCore.sol";

// override decimal() function is needed
contract OFT is OFTCore, ERC20, IOFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) ERC20(_name, _symbol) OFTCore(_lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCore, IERC165) returns (bool) {
        return
            interfaceId == type(IOFT).interfaceId ||
            interfaceId == type(IERC20).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function circulatingSupply() public view virtual override returns (uint256) {
        return totalSupply();
    }

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint256 _amount
    ) internal virtual override {
        address spender = _msgSender();

        if (_from != spender) {
            uint256 currentAllowance = allowance(_from, spender);
            if (currentAllowance != type(uint256).max) {
                require(currentAllowance >= _amount, "ERC20: insufficient allowance");
                unchecked {
                    _approve(_from, spender, currentAllowance - _amount);
                }
            }
        }

        _burn(_from, _amount);
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint256 _amount
    ) internal virtual override {
        _mint(_toAddress, _amount);
    }
}
