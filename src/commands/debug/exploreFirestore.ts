import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('explore-firebase')
        .setDescription('Explore your Firebase database structure')
        .addStringOption(option =>
            option
                .setName('userid')
                .setDescription('Specific user ID to check (optional)')
                .setRequired(false)
        ),
    category: 'Debug',
    description: 'Explore Firebase collections and data structure',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const specificUserId = interaction.options.getString('userid');

        try {
            const embed = new EmbedBuilder()
                .setTitle('🔍 Firebase Structure Explorer')
                .setColor(0x0099FF);

            // Get all collections
            const collections = await dbService['db'].listCollections();
            const collectionNames = collections.map(col => col.id);

            embed.addFields({
                name: '📁 Available Collections',
                value: collectionNames.map(name => `• ${name}`).join('\n') || 'No collections found'
            });

            // Check transactions collection structure
            if (collectionNames.includes('transactions')) {
                const transactionsSnapshot = await dbService['db']
                    .collection('transactions')
                    .limit(5)
                    .get();

                const sampleTransactions = transactionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return `**ID:** ${doc.id}\n**Data:** ${JSON.stringify(data, null, 2).substring(0, 100)}...`;
                });

                embed.addFields({
                    name: `📋 Sample Transactions (${transactionsSnapshot.size} total)`,
                    value: sampleTransactions.join('\n\n') || 'No transactions found'
                });

                // If we found transactions, show the user IDs used
                const userIds = new Set();
                transactionsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.userId) {
                        userIds.add(data.userId);
                    }
                });

                if (userIds.size > 0) {
                    embed.addFields({
                        name: '👤 User IDs Found in Transactions',
                        value: Array.from(userIds).map(id => `• \`${id}\``).join('\n')
                    });
                }
            }

            // Check borrowLend collection structure
            if (collectionNames.includes('borrowLend')) {
                const borrowLendSnapshot = await dbService['db']
                    .collection('borrowLend')
                    .limit(5)
                    .get();

                const sampleBorrowLend = borrowLendSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return `**ID:** ${doc.id}\n**Data:** ${JSON.stringify(data, null, 2).substring(0, 100)}...`;
                });

                embed.addFields({
                    name: `🤝 Sample Borrow/Lend (${borrowLendSnapshot.size} total)`,
                    value: sampleBorrowLend.join('\n\n') || 'No borrow/lend records found'
                });
            }

            // Check if specific user ID exists in data
            if (specificUserId) {
                const userTransactions = await dbService['db']
                    .collection('transactions')
                    .where('userId', '==', specificUserId)
                    .get();

                const userBorrowLend = await dbService['db']
                    .collection('borrowLend')
                    .where('userId', '==', specificUserId)
                    .get();

                embed.addFields({
                    name: `🔎 Search for User: ${specificUserId}`,
                    value: `Transactions: ${userTransactions.size}\nBorrow/Lend: ${userBorrowLend.size}`
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error exploring Firebase:', error);
            await interaction.editReply({
                content: `❌ Error exploring Firebase: ${error.message}`
            });
        }
    },
} as Command;