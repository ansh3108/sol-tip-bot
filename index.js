require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } = require('@solana/web3.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const WALLET_FILE = path.join(__dirname, 'wallets.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function loadWallets() {
    if (!fs.existsSync(WALLET_FILE)) { 
        fs.writeFileSync(WALLET_FILE, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
}

function saveWallet(userId, secretKeyArray) {
    const wallets = loadWallets();
    wallets[userId] = secretKeyArray;
    fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
}

function getOrCreateWallet(userId) {
    const wallets = loadWallets();

    if (wallets[userId]) {
        const secretKey = Uint8Array.from(wallets[userId]);
        return Keypair.fromSecretKey(secretKey);
    } else {
        const newKeypair = Keypair.generate();
        const secretKeyArray = Array.from(newKeypair.secretKey);
        saveWallet(userId, secretKeyArray);
        return newKeypair;
    }
}

const commands = [
    new SlashCommandBuilder().setName('wallet').setDescription("View your custodial Solana deposit address"),
    new SlashCommandBuilder().setName('balance').setDescription("Check your current SOL Balance"),
    new SlashCommandBuilder().setName('tip').setDescription("Tip another user with SOL")
    .addUserOption(option => 
        option.setName('user').setDescription('The user to tip').setRequired(true))
    .addNumberOption(option => 
        option.setName('amount').setDescription('Amount of SOL to tip').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

