import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { CommandHandler } from '../../handlers/commandHandler';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with all commands and categories'),
    category: 'Utilities',
    description: 'Dynamic help command with category browsing',
    async execute(interaction: ChatInputCommandInteraction) {
        // Get command handler from client
        const commandHandler = (interaction.client as any).commandHandler as CommandHandler;

        if (!commandHandler) {
            await interaction.reply({
                content: '❌ Command handler not available. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const categories = commandHandler.getCommandCategories();

        if (!categories || categories.size === 0) {
            await interaction.reply({
                content: '❌ No commands loaded yet. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('💰 Finance Manager Bot Help')
            .setDescription('Welcome to the Finance Manager Discord bot! Here are all available commands organized by categories.\n\nSelect a category from the dropdown below to view specific commands.')
            .setColor(0x0099FF)
            .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
            .addFields(
                {
                    name: '📁 Available Categories',
                    value: Array.from(categories.keys())
                        .map(cat => `• **${cat}** - ${getCategoryDescription(cat)}`)
                        .join('\n')
                },
                {
                    name: '🔗 Getting Started',
                    value: '1. Use `/link account` to link your app account\n2. Start exploring your financial data!'
                }
            )
            .setFooter({ text: 'Use /help [category] for specific category help' });

        const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category')
                    .setPlaceholder('Select a category to view commands...')
                    .addOptions(
                        Array.from(categories.entries()).map(([category, commands]) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(category)
                                .setDescription(`${commands.length} commands available`)
                                .setValue(category)
                                .setEmoji(getCategoryEmoji(category))
                        )
                    )
            );

        await interaction.reply({
            embeds: [embed],
            components: [selectMenu],
            ephemeral: true
        });
    },
} as Command;

// Additional function to handle select menu interactions for help
export async function handleHelpSelect(interaction: any): Promise<void> {
    const category = interaction.values[0];
    const commandHandler = (interaction.client as any).commandHandler as CommandHandler;

    if (!commandHandler) {
        await interaction.reply({
            content: '❌ Command handler not available.',
            ephemeral: true
        });
        return;
    }

    const categories = commandHandler.getCommandCategories();
    const categoryCommands = categories.get(category) || [];

    const embed = new EmbedBuilder()
        .setTitle(`${getCategoryEmoji(category)} ${category} Commands`)
        .setColor(0x00AE86)
        .setDescription(getCategoryDescription(category));

    categoryCommands.forEach((command: Command) => {
        embed.addFields({
            name: `</${command.data.name}:${command.data.name}>`,
            value: `${command.description}\n**Usage:** \`/${command.data.name}${command.usage ? ` ${command.usage}` : ''}\``,
            inline: false
        });
    });

    await interaction.update({ embeds: [embed] });
}

function getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
        'Wallet': 'Balance checking and financial overview commands',
        'Transactions': 'Transaction management and viewing',
        'BorrowLend': 'Money borrowing and lending management',
        'Utilities': 'Bot utilities and account management'
    };

    return descriptions[category] || 'Various commands for financial management';
}

function getCategoryEmoji(category: string): string {
    const emojis: { [key: string]: string } = {
        'Wallet': '💰',
        'Transactions': '💳',
        'BorrowLend': '🤝',
        'Utilities': '🔧'
    };

    return emojis[category] || '❓';
}