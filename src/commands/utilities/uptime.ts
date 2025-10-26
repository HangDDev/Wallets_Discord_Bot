import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';

export default {
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Check how long the bot has been running'),
    category: 'Utilities',
    description: 'Check bot uptime and system information',
    async execute(interaction: ChatInputCommandInteraction) {
        // Calculate uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        // Memory usage
        const memoryUsage = process.memoryUsage();
        const usedMemory = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const totalMemory = Math.round(memoryUsage.heapTotal / 1024 / 1024);

        // Platform info
        const platform = process.platform;
        const nodeVersion = process.version;

        // Calculate ready timestamp (when the bot became ready)
        const readyTimestamp = interaction.client.readyTimestamp;
        const readyTime = readyTimestamp ? `<t:${Math.floor(readyTimestamp / 1000)}:R>` : 'Unknown';

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🤖 Bot Uptime & Statistics')
            .addFields(
                {
                    name: '⏰ Uptime',
                    value: uptimeString,
                    inline: true
                },
                {
                    name: '🟢 Status',
                    value: interaction.client.ws.status === 0 ? 'Online' : 'Unknown',
                    inline: true
                },
                {
                    name: '📊 Memory Usage',
                    value: `${usedMemory}MB / ${totalMemory}MB`,
                    inline: true
                },
                {
                    name: '🔧 Platform',
                    value: platform.charAt(0).toUpperCase() + platform.slice(1),
                    inline: true
                },
                {
                    name: '⚙️ Node.js',
                    value: nodeVersion,
                    inline: true
                },
                {
                    name: '🏓 Ping',
                    value: `${interaction.client.ws.ping}ms`,
                    inline: true
                },
                {
                    name: '👥 Servers',
                    value: `${interaction.client.guilds.cache.size}`,
                    inline: true
                },
                {
                    name: '👤 Users',
                    value: `${interaction.client.users.cache.size}`,
                    inline: true
                },
                {
                    name: '🕐 Ready Since',
                    value: readyTime,
                    inline: false
                }
            )
            .setFooter({
                text: 'Bot System Information',
                iconURL: interaction.client.user?.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: false
        });
    },
} as Command;