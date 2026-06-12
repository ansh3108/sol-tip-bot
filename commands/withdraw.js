const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } = require('@solana/web3.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw SOL to an external Phantom or Solflare wallet')
        .addStringOption(option => 
            option.setName('address').setDescription('Your external Solana wallet address').setRequired(true))
        .addNumberOption(option => 
            option.setName('amount').setDescription('Amount of SOL to withdraw').setRequired(true)),
        
    async execute(interaction, userWallet, connection) {
        await interaction.deferReply({ ephemeral: true });

        const targetAddressString = interaction.options.getString('address');
        const amountSol = interaction.options.getNumber('amount');

        let toPubkey;
        try {
            toPubkey = new PublicKey(targetAddressString);
        } catch (error) {
            return interaction.editReply('❌ Invalid Solana address provided.');
        }

        const currentLamports = await connection.getBalance(userWallet.publicKey);
        const lamportsToWithdraw = amountSol * LAMPORTS_PER_SOL;
        const estimatedFee = 5000; 

        if (currentLamports < (lamportsToWithdraw + estimatedFee)) {
            const maxWithdrawable = Math.max(0, currentLamports - estimatedFee) / LAMPORTS_PER_SOL;
            return interaction.editReply(`❌ Insufficient balance. Maximum you can withdraw is **${maxWithdrawable} SOL**.`);
        }

        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: userWallet.publicKey,
                    toPubkey: toPubkey,
                    lamports: lamportsToWithdraw,
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userWallet.publicKey;

            transaction.sign(userWallet);
            const signature = await connection.sendRawTransaction(transaction.serialize());

            const embed = new EmbedBuilder()
                .setColor(0x14F195)
                .setTitle('🚀 Withdrawal Successful!')
                .setDescription(`Successfully sent **${amountSol} SOL** to \`${targetAddressString}\``)
                .addFields({ name: 'Transaction Explorer', value: `[View on Solana Explorer](https://explorer.solana.com/tx/${signature}?cluster=devnet)` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Withdrawal error:", error);
            await interaction.editReply('❌ Transaction failed. Check the terminal logs for details.');
        }
    }
};