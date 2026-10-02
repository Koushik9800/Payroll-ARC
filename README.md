# Arc Payroll MVP

A static, GitHub-Pages-friendly USDC payroll dashboard for Circle's Arc blockchain.

## Files
- `index.html`
- `style.css`
- `config.js`
- `app.js`

## Features
- Arc Testnet / Mainnet switch
- EVM wallet connection
- USDC ERC-20 balance + native USDC gas balance
- Add/edit/remove employees
- CSV employee import
- Single payment
- Bulk payroll flow (up to the number of employees stored; UI is designed for 100+)
- Monthly transaction history
- CSV history export
- Explorer links
- No private key or seed phrase storage

## Important
This MVP performs bulk payroll as sequential ERC-20 transfers. The wallet will ask for a signature for each transfer. It does NOT pretend this is a single on-chain batch transaction.

For a production payroll system, deploy an audited batch-payment smart contract and replace the sequential loop with one contract call. Add company authentication, role-based approvals, audit logs, backend persistence, rate limits, address verification and monitoring before handling real payroll.

Arc USDC uses 6 decimals through the ERC-20 interface. Arc's native USDC balance is 18 decimals and is used for gas.
