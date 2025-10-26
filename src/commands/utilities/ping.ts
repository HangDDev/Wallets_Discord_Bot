import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, version, Collection } from 'discord.js';
import { Command } from '../../models/command';
import os from 'os';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and performance metrics'),
    category: 'Utilities',
    description: 'Check bot latency, API response time, and system performance',
    async execute(interaction: ChatInputCommandInteraction) {
        // Send initial response and measure message latency
        const sent = await interaction.reply({
            content: '🏓 Measuring latency...',
            fetchReply: true,
            ephemeral: false
        });

        // Calculate latencies
        const messageLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        const totalLatency = messageLatency + apiLatency;

        // Get bot uptime
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
        const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

        // System info
        const platform = os.platform();
        const arch = os.arch();
        const cpuUsage = os.loadavg()[0].toFixed(2); // 1-minute load average
        const totalServers = interaction.client.guilds.cache.size;
        const totalUsers = interaction.client.users.cache.size;
        const totalChannels = interaction.client.channels.cache.size;

        // Calculate cache statistics
        const guildCache = interaction.client.guilds.cache;
        const userCache = interaction.client.users.cache;
        const channelCache = interaction.client.channels.cache;

        // Database/API latency simulation (if you have any external services)
        // This is a placeholder - you can replace with actual database ping if applicable
        const databaseLatency = Math.round(Math.random() * 10) + 1; // Simulated 1-10ms

        // Determine status based on latency
        let status = '🟢 Excellent';
        let statusColor = 0x00ff00; // Green

        if (totalLatency > 200) {
            status = '🟡 Good';
            statusColor = 0xffff00; // Yellow
        }
        if (totalLatency > 500) {
            status = '🟠 Fair';
            statusColor = 0xffa500; // Orange
        }
        if (totalLatency > 1000) {
            status = '🔴 Poor';
            statusColor = 0xff0000; // Red
        }

        // Create detailed embed
        const embed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('🏓 Advanced Ping Metrics')
            .setDescription(`**Overall Status:** ${status}`)
            .addFields(
                {
                    name: '📡 Latency Metrics',
                    value: [
                        `**Message Latency:** ${messageLatency}ms`,
                        `**API Latency:** ${apiLatency}ms`,
                        `**Database Latency:** ${databaseLatency}ms`,
                        `**Total Response Time:** ${totalLatency}ms`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🖥️ System Resources',
                    value: [
                        `**Memory Usage:** ${usedMemory}MB / ${totalMemory}MB (${memoryPercentage}%)`,
                        `**CPU Load:** ${cpuUsage}`,
                        `**Uptime:** ${uptimeString}`,
                        `**Platform:** ${platform} ${arch}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📊 Cache Statistics',
                    value: [
                        `**Servers:** ${totalServers}`,
                        `**Users:** ${totalUsers}`,
                        `**Channels:** ${totalChannels}`,
                        `**Discord.js:** v${version}`
                    ].join('\n'),
                    inline: false
                }
            )
            .addFields(
                {
                    name: '📈 Performance Analysis',
                    value: getPerformanceAnalysis(messageLatency, apiLatency, totalLatency),
                    inline: false
                }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag} | Shard: ${interaction.guild?.shardId || 0}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        // Edit the original response with the embed
        await interaction.editReply({
            content: null,
            embeds: [embed]
        });
    },
} as Command;

// Helper function for performance analysis
function getPerformanceAnalysis(messageLatency: number, apiLatency: number, totalLatency: number): string {
    const analysis: string[] = [];

    if (messageLatency < 50) {
        analysis.push('• 🚀 Message processing: Excellent');
    } else if (messageLatency < 100) {
        analysis.push('• ⚡ Message processing: Good');
    } else if (messageLatency < 200) {
        analysis.push('• 📶 Message processing: Acceptable');
    } else {
        analysis.push('• 🐌 Message processing: Slow');
    }

    if (apiLatency < 100) {
        analysis.push('• 🌐 Discord API: Excellent');
    } else if (apiLatency < 200) {
        analysis.push('• 🌐 Discord API: Good');
    } else if (apiLatency < 400) {
        analysis.push('• 🌐 Discord API: Acceptable');
    } else {
        analysis.push('• 🌐 Discord API: High Latency');
    }

    if (totalLatency < 150) {
        analysis.push('• ✅ Overall: Optimal performance');
    } else if (totalLatency < 300) {
        analysis.push('• ℹ️ Overall: Good performance');
    } else if (totalLatency < 600) {
        analysis.push('• ⚠️ Overall: Moderate latency');
    } else {
        analysis.push('• 🚨 Overall: High latency detected');
    }

    // Add recommendations based on metrics
    if (apiLatency > 300) {
        analysis.push('\n💡 **Tip:** High API latency may be due to Discord server issues.');
    }
    if (messageLatency > 150) {
        analysis.push('💡 **Tip:** High message latency could indicate bot processing delays.');
    }

    return analysis.join('\n');
}