import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { DatabaseService } from '../../services/databaseService';
import { Logger } from '../../utils/logger';
import { Command } from "../../models/command";

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Discord account to your Finance Manager app account')
        .addSubcommand(subcommand =>
            subcommand
                .setName('account')
                .setDescription('Link your account using app credentials')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your current linking status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setDescription('Unlink your Discord account from the app')
        ),
    category: 'Utilities',
    description: 'Manage Discord app account linking',
    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'account':
                await showLinkModal(interaction);
                break;
            case 'status':
                await checkLinkStatus(interaction);
                break;
            case 'unlink':
                await unlinkAccount(interaction);
                break;
        }
    },
} as Command;

async function showLinkModal(interaction: ChatInputCommandInteraction): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId('linkAccountModal')
        .setTitle('Link Finance Manager Account');

    const userIdInput = new TextInputBuilder()
        .setCustomId('userIdInput')
        .setLabel('Your App User ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter your user ID from the app');

    const emailInput = new TextInputBuilder()
        .setCustomId('emailInput')
        .setLabel('Your Registered Email')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter your email used in the app');

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput);

    modal.addComponents(firstActionRow, secondActionRow);

    await interaction.showModal(modal);
}

async function checkLinkStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    const userLink = await dbService.getUserLink(interaction.user.id);

    if (userLink) {
        await interaction.reply({
            content: `✅ Your account is linked!\n📧 Email: ${userLink.email}\n🔗 Linked since: ${userLink.linkedAt.toLocaleDateString()}`,
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: '❌ Your account is not linked. Use `/link account` to link your account.',
            ephemeral: true
        });
    }
}

async function unlinkAccount(interaction: ChatInputCommandInteraction): Promise<void> {
    const userLink = await dbService.getUserLink(interaction.user.id);

    if (!userLink) {
        await interaction.reply({
            content: '❌ Your account is not linked.',
            ephemeral: true
        });
        return;
    }

    await dbService.unlinkUser(interaction.user.id);

    await interaction.reply({
        content: '✅ Your account has been unlinked successfully.',
        ephemeral: true
    });
}