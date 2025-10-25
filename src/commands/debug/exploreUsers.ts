import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('explore-users')
        .setDescription('Explore the users collection to understand your data structure'),
    category: 'Debug',
    description: 'Explore users collection structure',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const embed = new EmbedBuilder()
                .setTitle('👥 Users Collection Explorer')
                .setColor(0x0099FF);

            // Get all users
            const usersSnapshot = await dbService['db'].collection('users').limit(10).get();

            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    data: data
                };
            });

            embed.addFields({
                name: `📊 Users Found (${usersSnapshot.size})`,
                value: usersData.length > 0
                    ? usersData.map(user => `**ID:** \`${user.id}\`\n**Data:** \`\`\`json\n${JSON.stringify(user.data, null, 2).substring(0, 200)}...\`\`\``).join('\n\n')
                    : 'No users found'
            });

            // Check if our linked user exists in users collection
            const userLink = await dbService.getUserLink(interaction.user.id);
            if (userLink) {
                const specificUserDoc = await dbService['db'].collection('users').doc(userLink.appUserId).get();

                embed.addFields({
                    name: '🔍 Your Linked User',
                    value: specificUserDoc.exists
                        ? `✅ Found in users collection!\n**Data:** \`\`\`json\n${JSON.stringify(specificUserDoc.data(), null, 2)}\`\`\``
                        : `❌ NOT found in users collection!\nWe looked for ID: \`${userLink.appUserId}\``
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error exploring users:', error);
            await interaction.editReply({
                content: `❌ Error exploring users: ${error.message}`
            });
        }
    },
} as Command;