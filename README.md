# Solana Discord Bot

A discord bot built to seamlessly tip, manage and transfer SOL within a Discord server. 

-------

## Tech Stack

* **Runtime:** Node.js
* Discord.js
* **Blockchain:** `@solana/web3.js`
* **Database & ORM:** SQLite + Prisma(v6)
* **RPC Provider:** Helius


## Installation 

### 1. Prerequisites
* Node.js
* Discord Developer Application (Bot Token and Client ID)
* [Helius](https://helius.dev/) API Key

### 2. Clone & Install
```bash
git clone https://github.com/ansh3108/sol-tip-bot.git
cd sol-tip-bot
npm install
```

-----------

## Commands

* `/wallet`: Displays your custodial Solana deposit address. Generates a new wallet if you don't have one.
  <img width="472" height="258" alt="wallet" src="https://github.com/user-attachments/assets/97d91c58-c3d1-4468-94e0-bca0bf0b45a3" />


* `/balance`: Checks your current live SOL balance on the blockchain.
 <img width="474" height="240" alt="balance" src="https://github.com/user-attachments/assets/56194726-2212-4034-a661-5fbeb7472c4b" />


* `/tip <@user> <amount>`: Instantly transfers SOL from your wallet to another user's wallet.
  <img width="616" height="220" alt="tip" src="https://github.com/user-attachments/assets/44e3dd8f-8a47-4b7d-8dca-beca53c989fb" />


* `/withdraw <address> <amount>`: Withdraws SOL from your bot wallet to an external Phantom/Solflare address.

  <img width="800" height="234" alt="withdraw" src="https://github.com/user-attachments/assets/33fbf282-625e-4b8a-999d-f11ee8ca6d63" />
