require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } = require('@solana/web3.js');
const { PrismaClient } = require('./prisma/client');
const prisma = new PrismaClient();
const { encrypt, decrypt } = require('./encryption.js');

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function getOrCreateWallet(userId) {
    let userRecord = await prisma.user.findUnique({
        where: { discordId: userId }
    });

    if (userRecord) {
        const decryptedString = decrypt(userRecord.encryptedWallet);
        const secretKey = Uint8Array.from(JSON.parse(decryptedString));
        return Keypair.fromSecretKey(secretKey);
    } else {
        const newKeypair = Keypair.generate();
        const secretKeyArray = Array.from(newKeypair.secretKey);

        const encryptedWalletString = encrypt(JSON.stringify(secretKeyArray));

        await prisma.user.create({
            data: {
                discordId: userId,
                encryptedWallet: encryptedWalletString
            }
        });

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

    require('./commands/withdraw.js').data
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.')
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
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

    const userWallet = await getOrCreateWallet(user.id);

    if (commandName === 'withdraw') {
        return require('./commands/withdraw.js').execute(interaction, userWallet, connection);
    }

    if(commandName === 'wallet') {
        await interaction.reply({
            content: `Your deposit address: \`${userWallet.publicKey.toBase58()}\`\n*Deposit funds to this address using Solana Devnet.*`,
            ephemeral: true
        })
    }

    if (commandName === 'balance') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const balanceInLamports = await connection.getBalance(userWallet.publicKey);
            const balanceInSol = balanceInLamports / LAMPORTS_PER_SOL;
            await interaction.editReply(`Your wallet balance is **${balanceInSol} SOL**`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to fetch balance. Try again later.');
        }
    }

    if (commandName === 'tip') {
        await interaction.deferReply();

        const recipientUser = interaction.options.getUser('user');
        const amountSol = interaction.options.getNumber('amount');

        if (recipientUser.id === user.id) {
            return interaction.editReply("You can't tip yourself!")
        }

        try {
            const recipientWallet = await getOrCreateWallet(recipientUser.id);
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