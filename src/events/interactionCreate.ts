import { Events, Interaction } from 'discord.js';
import { handleHelpSelect } from '../commands/utilities/help';
import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/databaseService';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'help_category') {
                await handleHelpSelect(interaction);
            }
        }

        if (interaction.isButton()) {
            // Handle button interactions
            Logger.info(`Button clicked: ${interaction.customId} by ${interaction.user.tag}`);

            if (interaction.customId === 'refresh_balance') {
                await handleRefreshBalance(interaction);
            }
            if (interaction.customId === 'debug_balance') {
                let dbService = DatabaseService.getInstance();
                await interaction.deferReply({ ephemeral: true });

                const userLink = await dbService.getUserLink(interaction.user.id);
                if (userLink) {
                    await dbService.debugUserData(userLink.appUserId);
                    await interaction.editReply({
                        content: '🔧 Debug data has been logged to console. Check your server logs.'
                    });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'linkAccountModal') {
                await handleLinkModal(interaction);
            }
        }
    },
};

async function handleLinkModal(interaction: any): Promise<void> {
    const userId = interaction.fields.getTextInputValue('userIdInput');
    const email = interaction.fields.getTextInputValue('emailInput');

    const dbService = (interaction.client as any).dbService as DatabaseService;

    if (!dbService) {
        await interaction.reply({
            content: '❌ Database service not available. Please try again later.',
            ephemeral: true
        });
        return;
    }

    try {
        await dbService.linkUser(interaction.user.id, userId, email);

        await interaction.reply({
            content: `✅ Successfully linked your account!\n📧 Email: ${email}\n🆔 User ID: ${userId}`,
            ephemeral: true
        });
    } catch (error) {
        Logger.error('Error linking account:', error);
        await interaction.reply({
            content: '❌ Failed to link account. Please check your credentials and try again.',
            ephemeral: true
        });
    }
}

async function handleRefreshBalance(interaction: any): Promise<void> {
    await interaction.deferUpdate();

    // You can implement balance refresh logic here
    Logger.info(`Refresh balance requested by ${interaction.user.tag}`);

    // For now, just acknowledge the button press
    await interaction.followUp({
        content: '🔄 Balance refresh requested!',
        ephemeral: true
    });
}