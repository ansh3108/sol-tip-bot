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

(async () => {
    try {
        console.log('Started refreshing application (/) commands.')
        await rest.put(
            Routes.applicationCommand(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}) ();

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user } = interaction;
    const userWallet = getOrCreateWallet(user.id);

    if(commandName === 'wallet') {
        await interaction.reply({
            content: `Your deposit address: \`{userWallet.publicKey.toBase58()}\`\`n*Deposit funds to this address using Solana Devnet.*`,
            ephemeral: true
        })
    }

    if (commandName === 'tip') {
        await interaction.deferReply();

        const recipientUser = interaction.options.getUser('user');
        const amountSol = interaction.options.getNumber('amount');

        if (recipientUser.id === user.id) {
            return interaction.editReply("Amount must be greater than 0 SOL.")
        }

        try {
            const recipientWallet = getOrCreateWallet(recipientUser.id);
            const lamportsToSend = amountSol * LAMPORTS_PER_SOL;

            const currentBalance = await connection.getBalance(userWallet.publicKey);

            const estimatedFee = 5000;
            if (currentBalance < (lamportsToSend + estimatedFee)) {
                return interaction.editReply(`Insufficient balance. You need **${amountSol} SOL** plus network fees.`);
            }

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: userWallet.publicKey,
                    toPubkey: recipientWallet.publicKey,
                    lamports: lamportsToSend,
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userWallet.publicKey;

            transaction.sign(userWallet);
            const signature = await connection.sendRawTransaction(transaction.serialize());

            const embed = new EmbedBuilder()
                .setColor(0x14F195)
                .setTitle('💸 Tip Successful!')
                .setDescription(`${user} tipped ${recipientUser} **${amountSol} SOL**`)
                .addFields({ name: 'Transaction Explorer', value: `[View on Solana Explorer](https://explorer.solana.com/tx/${signature}?cluster=devnet)` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('Transaction failed. Check if your wallet has enough funds to cover gas fees.')
        }
    }
});

client.login(process.env.DISCORD_TOKEN);