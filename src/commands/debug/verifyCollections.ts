import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('verify-collections')
        .setDescription('Verify all collections are accessible with correct names'),
    category: 'Utilities',
    description: 'Verify collection access',
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
                .setTitle('🔍 Collection Verification')
                .setColor(0x0099FF)
                .setDescription(`Verifying collections for user: \`${userLink.appUserId}\``);

            // Test transactions collection
            const transactions = await dbService.getUserTransactions(userLink.appUserId, 3);
            embed.addFields({
                name: '✅ Transactions Collection',
                value: transactions.length > 0
                    ? `✓ Accessible\nSample: ${transactions.length} transactions found\nFirst: $${transactions[0]?.amount} - ${transactions[0]?.description}`
                    : '❌ No transactions found'
            });

            // Test borrow_lend collection
            const borrowLend = await dbService.getBorrowLendRecords(userLink.appUserId);
            embed.addFields({
                name: '✅ Borrow_Lend Collection',
                value: borrowLend.length > 0
                    ? `✓ Accessible\nSample: ${borrowLend.length} records found\nFirst: $${borrowLend[0]?.amount} - ${borrowLend[0]?.personName}`
                    : '❌ No borrow/lend records found (collection exists but empty)'
            });

            // Test user document
            const userDoc = await dbService['db'].collection('users').doc(userLink.appUserId).get();
            embed.addFields({
                name: '👤 User Document',
                value: userDoc.exists ? '✓ Exists (but may be empty)' : '⚠️ Does not exist (using subcollections only)'
            });

            embed.addFields({
                name: '🎯 Final Status',
                value: transactions.length > 0 && borrowLend.length >= 0
                    ? '✅ All collections working correctly!'
                    : '⚠️ Some collections may have issues'
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in verify-collections:', error);
            await interaction.editReply({
                content: `❌ Error verifying collections: ${error.message}`
            });
        }
    },
} as Command;