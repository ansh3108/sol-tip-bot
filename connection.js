const { Connection, clusterApiUrl } = require('@solana/web3.js');
require('dotenv').config();

const network = process.env.SOLANA_NETWORK || 'devnet';
const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network);
const connection = new Connection(rpcUrl, 'confirmed');

module.exports = { connection, network };