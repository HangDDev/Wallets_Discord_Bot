import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('advanced-debug')
        .setDescription('Advanced debugging for Firebase data issues'),
    category: 'Utilities',
    description: 'Advanced Firebase data debugging',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const userLink = await dbService.getUserLink(interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('🔧 Advanced Debug')
            .setColor(0xFF6B6B);

        if (!userLink) {
            embed.setDescription('❌ Your account is not linked.');
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Get data using multiple possible user IDs
        const userData = await dbService.findUserDataByMultipleFields(interaction.user.id);

        // Get all user IDs in the database to see what's available
        const allUserIds = await dbService.getAllUserIdsInDatabase();

        embed.setDescription(`Debug information for linked account`)
            .addFields(
                { name: '🔗 Linked User ID', value: `\`${userLink.appUserId}\``, inline: true },
                { name: '📧 Email', value: userLink.email, inline: true },
                { name: '🕒 Linked At', value: userLink.linkedAt.toLocaleDateString(), inline: true }
            )
            .addFields(
                { name: '📊 Transactions Found', value: `${userData.transactions.length}`, inline: true },
                { name: '🤝 Borrow/Lend Found', value: `${userData.borrowLend.length}`, inline: true },
                { name: '🔍 User IDs Tried', value: `${userData.possibleUserIds.length}`, inline: true }
            );

        // Show the user IDs we tried
        if (userData.possibleUserIds.length > 0) {
            embed.addFields({
                name: '🎯 User IDs Attempted',
                value: userData.possibleUserIds.map(id => `• \`${id}\``).join('\n')
            });
        }

        // Show sample of user IDs in database
        if (allUserIds.length > 0) {
            embed.addFields({
                name: `👥 User IDs in Database (${allUserIds.length} total)`,
                value: allUserIds.slice(0, 5).map(id => {
                    const isMatch = userData.possibleUserIds.includes(id);
                    return `${isMatch ? '✅' : '❌'} \`${id}\``;
                }).join('\n') + (allUserIds.length > 5 ? `\n... and ${allUserIds.length - 5} more` : '')
            });
        }

        // If we found data with alternative user IDs
        if (userData.transactions.length > 0 || userData.borrowLend.length > 0) {
            embed.addFields({
                name: '🎉 Data Found!',
                value: 'We found your data using an alternative user ID format. The system will now use this automatically.'
            });
        } else {
            embed.addFields({
                name: '❓ Next Steps',
                value: `1. Check if your app user ID matches \`${userLink.appUserId}\`\n2. Use \`/explore-firebase\` to see database structure\n3. Try linking with a different user ID`
            });
        }

        const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('explore_firebase')
                    .setLabel('🔍 Explore Firebase')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('relink_account')
                    .setLabel('🔄 Relink Account')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    },
} as Command;