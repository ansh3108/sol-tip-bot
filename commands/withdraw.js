const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { connection, network } = require('../connection');
const fs = require('fs');

function getUserKeypair(userId) {
    const wallets = JSON.parse(fs.readFileSync('./wallets.json', 'utf-8'));
    if(!wallets[userId]) return null;

    return Keypair.fromSecretKey(Uint8Array.from(wallets[userId]));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw SOL to an external wallet')
        .addStringOption(option => 
            option.setName('address').setDescription('The destination Solana address').setRequired(true))
        .addNumberOption(option => 
            option.setName('amount').setDescription('Amount of SOL').setRequired(true)),

        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const toAddressStr = interaction.options.getString('address');
            const amount = interaction.options.getNumber('amount');

            const userWallet = getUserKeypair(userId);
            if (!userWallet) {
                return interaction.editReply('❌ Use `/wallet` to generate your account first.');
            }

            let toPublicKey;
            try {
                toPublicKey = new PublicKey(toAddressStr);
                if (!PublicKey.isOnCurve(toPublicKey.toBuffer())) {
                    throw new Error("Invalid address");
                }
            } catch (err) {
                return interaction.editReply('❌ Invalid Solana address. Please check and try again.')
            }

            const lamportsToWithdraw = amount * LAMPORTS_PER_SOL;

            try {
                const balanceInLamports = await connection.getBalance(userWallet.publicKey);

                const feeReserve = 5000;
                if (balanceInLamports < (lamportsToWithdraw + feeReserve)) {
                    const availableSol = (balanceInLamports - feeReserve) / LAMPORTS_PER_SOL;

                    return interaction.editReply(
                        `❌ Insufficient balance. Maximum you can withdraw is roughly **${availableSol > 0 ? availableSol.toFixed(6) : 0} SOL**.`
                    );
                }

                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: userWallet.publicKey,
                        toPubkey: toPublicKey,
                        lamports: lamportsToWithdraw,
                    })
                );

                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = userWallet.publicKey;

                const signature  = await connection.sendTransaction(transaction, [userWallet], {
                    preflightCommitment: 'confirmed'
                });

                await connection.confirmTransaction({ signature, blockhash,lastValidBlockHeight });

                const solscanUrl = network === 'mainnet-beta'
                    ? `https://solscan.io/tx/${signature}`
                    : `https://solscan.io/tx/${signature}?cluster=devnet`;

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FFA3)
                    .setTitle('Withdrawal Successful')
                    .setDescription(`Successfully transferred funds out of your custodial bot wallet.`)
                    .addFields(
                        { name: 'From (Bot Wallet)', value: `\`${userWallet.publicKey.toBase58()}\``, inline: false },
                        { name: 'To (External Wallet)', value: `\`${toPublicKey.toBase58()}\``, inline: false },
                        { name: 'Amount Sent', value: `**${amount} SOL**`, inline: true },
                        { name: 'Network', value: `\`${network}\``, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({
                    content: `Transaction finalized! [View on Solscan](${solscanUrl})`,
                    embeds: [successEmbed]
                });
            } catch (error) {
                console.error('Withdrawl error: ', error);
                return interaction.editReply('❌ An error occured processing the transaction.')
            }
        }
}