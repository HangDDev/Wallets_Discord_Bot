import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('confirm-structure')
        .setDescription('Confirm your data structure and test data access'),
    category: 'Debug',
    description: 'Confirm data structure and test access',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const userLink = await dbService.getUserLink(interaction.user.id);

        if (!userLink) {
            await interaction.editReply({
                content: '❌ Please link your account first using `/link account`'
            });
            return;
        }

        try {
            const embed = new EmbedBuilder()
                .setTitle('✅ Data Structure Confirmed!')
                .setColor(0x00FF00)
                .setDescription(`Your data is stored in user subcollections for user ID: \`${userLink.appUserId}\``);

            // Check data existence
            const dataExists = await dbService.checkUserDataExists(userLink.appUserId);

            embed.addFields(
                {
                    name: '🏗️ Storage Structure',
                    value: 'User Subcollections\n`users/{userId}/transactions`\n`users/{userId}/borrow_lend`', // Updated to borrow_lend
                    inline: true
                },
                { name: '📊 Transactions', value: dataExists.hasTransactions ? `✅ ${dataExists.transactionCount}+ records` : '❌ No transactions', inline: true },
                { name: '🤝 Borrow/Lend', value: dataExists.hasBorrowLend ? `✅ ${dataExists.borrowLendCount}+ records` : '❌ No records', inline: true }
            );

            // Test actual data retrieval
            const transactions = await dbService.getUserTransactions(userLink.appUserId, 5);
            const borrowLend = await dbService.getBorrowLendRecords(userLink.appUserId);

            if (transactions.length > 0) {
                const totalIncome = transactions
                    .filter(t => !t.isExpense)
                    .reduce((sum, t) => sum + t.amount, 0);

                const totalExpense = transactions
                    .filter(t => t.isExpense)
                    .reduce((sum, t) => sum + t.amount, 0);

                embed.addFields(
                    { name: '💰 Recent Transactions Test', value: `Successfully retrieved ${transactions.length} transactions`, inline: false },
                    { name: 'Sample Income', value: `$${totalIncome.toFixed(2)}`, inline: true },
                    { name: 'Sample Expenses', value: `$${totalExpense.toFixed(2)}`, inline: true },
                    { name: 'Net', value: `$${(totalIncome - totalExpense).toFixed(2)}`, inline: true }
                );

                // Show a couple of sample transactions
                const sampleText = transactions.slice(0, 3).map(t =>
                    `${t.isExpense ? '🔴' : '🟢'} $${t.amount} - ${t.description || 'No description'}`
                ).join('\n');

                embed.addFields({
                    name: '📋 Sample Transactions',
                    value: sampleText
                });
            }

            if (borrowLend.length > 0) {
                embed.addFields({
                    name: '🤝 Borrow/Lend Test',
                    value: `Successfully retrieved ${borrowLend.length} borrow/lend records`
                });
            }

            embed.addFields({
                name: '🚀 Next Steps',
                value: 'Your data structure is now confirmed! Try using:\n• `/balance` - Check your wallet balance\n• `/transactions list` - View your transactions\n• `/overview monthly` - Financial overview'
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in confirm-structure:', error);
            await interaction.editReply({
                content: `❌ Error confirming structure: ${error.message}`
            });
        }
    },
} as Command;