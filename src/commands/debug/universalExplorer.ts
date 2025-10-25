import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { UniversalDataService } from '../../services/universalDataService';

const universalService = new UniversalDataService();

export default {
    data: new SlashCommandBuilder()
        .setName('universal-explorer')
        .setDescription('Universal explorer for all data structures'),
    category: 'Debug',
    description: 'Universal data structure explorer',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const embed = new EmbedBuilder()
                .setTitle('🌐 Universal Data Explorer')
                .setColor(0x0099FF);

            // 1. Explore all collections
            const allCollections = await universalService.exploreAllCollections();

            embed.addFields({
                name: '📁 All Collections',
                value: Object.keys(allCollections).map(collectionName =>
                    `• **${collectionName}**: ${allCollections[collectionName].length} documents`
                ).join('\n') || 'No collections found'
            });

            // 2. Try to find user financial data
            const userData = await universalService.findUserFinancialData(interaction.user.id);

            embed.addFields({
                name: '🔍 Your Financial Data Search',
                value: `**Strategy Used:** ${userData.dataLocation}\n**Transactions Found:** ${userData.transactions.length}\n**Borrow/Lend Found:** ${userData.borrowLend.length}`
            });

            // 3. Show sample of what was found
            if (userData.transactions.length > 0) {
                const sample = userData.transactions.slice(0, 3);
                embed.addFields({
                    name: '💰 Sample Transactions',
                    value: sample.map(t =>
                        `• $${t.amount} - ${t.description || 'No description'}`
                    ).join('\n')
                });
            }

            if (userData.borrowLend.length > 0) {
                const sample = userData.borrowLend.slice(0, 3);
                embed.addFields({
                    name: '🤝 Sample Borrow/Lend',
                    value: sample.map(b =>
                        `• $${b.amount} - ${b.personName} (${b.type})`
                    ).join('\n')
                });
            }

            // 4. Show user structure info
            if (userData.userStructure) {
                embed.addFields({
                    name: '🏗️ Data Structure',
                    value: `Your data is stored as: **${userData.userStructure}**`
                });
            }

            // 5. Show what's in the users collection specifically
            if (allCollections.users && allCollections.users.length > 0) {
                const userSamples = allCollections.users.slice(0, 2);
                embed.addFields({
                    name: '👥 Users Collection Samples',
                    value: userSamples.map(user =>
                        `**ID:** \`${user.id}\`\n**Fields:** ${Object.keys(user).filter(k => k !== 'id').join(', ')}`
                    ).join('\n\n')
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in universal explorer:', error);
            await interaction.editReply({
                content: `❌ Error exploring data: ${error.message}`
            });
        }
    },
} as Command;