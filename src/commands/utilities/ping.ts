import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../models/command';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency'),
    category: 'Utilities',
    description: 'Check bot latency and response time',
    async execute(interaction: ChatInputCommandInteraction) {
        const sent = await interaction.reply({
            content: 'Pinging...',
            fetchReply: true,
            ephemeral: true
        });

        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.editReply({
            content: `🏓 Pong!\n📡 Latency: ${latency}ms\n🔧 API Latency: ${apiLatency}ms`
        });
    },
} as Command;