import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';

export default {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get information about a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)
        ),
    category: 'Utilities',
    description: 'Get detailed information about a user',
    async execute(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const targetMember = interaction.options.getMember('user') as GuildMember || interaction.member as GuildMember;

        if (!targetMember) {
            await interaction.reply({
                content: '❌ Unable to fetch member information.',
                ephemeral: true
            });
            return;
        }

        // Calculate account age
        const accountAge = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));

        // Calculate server join age (if member is in the guild)
        const joinAge = targetMember.joinedAt ? Math.floor((Date.now() - targetMember.joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 'Unknown';

        // Get roles (excluding @everyone)
        const roles = targetMember.roles.cache
            .filter(role => role.id !== interaction.guild?.id)
            .map(role => role.toString())
            .join(', ') || 'None';

        // Get permissions
        const permissions = targetMember.permissions.toArray().slice(0, 10).join(', ') + (targetMember.permissions.toArray().length > 10 ? '...' : '');

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor || '#0099ff')
            .setAuthor({
                name: `${targetUser.tag}`,
                iconURL: targetUser.displayAvatarURL()
            })
            .setThumbnail(targetUser.displayAvatarURL({ size: 512 }))
            .addFields(
                {
                    name: '👤 User Information',
                    value: [
                        `**Username:** ${targetUser.tag}`,
                        `**ID:** ${targetUser.id}`,
                        `**Account Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
                        `**Account Age:** ${accountAge} days`,
                        `**Bot:** ${targetUser.bot ? 'Yes' : 'No'}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🛡️ Server Information',
                    value: [
                        `**Nickname:** ${targetMember.nickname || 'None'}`,
                        `**Joined Server:** ${targetMember.joinedAt ? `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:R>` : 'Unknown'}`,
                        `**Join Age:** ${joinAge} days`,
                        `**Boosted Server:** ${targetMember.premiumSince ? 'Yes' : 'No'}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `🎭 Roles [${targetMember.roles.cache.size - 1}]`,
                    value: roles.length > 1024 ? 'Too many roles to display' : roles,
                    inline: false
                },
                {
                    name: '🔑 Key Permissions',
                    value: permissions || 'None',
                    inline: false
                }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: false
        });
    },
} as Command;