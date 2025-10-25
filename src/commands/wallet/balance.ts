import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';
import { UniversalDataService } from '../../services/universalDataService';

const universalService = new UniversalDataService();
const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current wallet balance and financial overview'),
    category: 'Wallet',
    description: 'View your current balance and wallet breakdown',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const userLink = await dbService.getUserLink(interaction.user.id);

        if (!userLink) {
            await interaction.editReply({
                content: '❌ Please link your account first using `/link account`'
            });
            return;
        }

        try {
            // Use the flexible search method
            const userData = await universalService.findUserFinancialData(interaction.user.id);
            const transactions = userData.transactions;

            if (userData.transactions.length === 0) {
                // Show helpful error with data location info
                const embed = new EmbedBuilder()
                    .setTitle('💰 Wallet Balance')
                    .setColor(0xFFA500)
                    .setDescription('No transactions found for your account')
                    .addFields(
                        { name: '🔍 Search Method', value: userData.dataLocation },
                        { name: '💡 Next Steps', value: 'Use `/universal-explorer` to see detailed data structure' }
                    );

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Calculate balance from found transactions
            const balanceByMethod: { [key: string]: number } = {};
            let total = 0;

            userData.transactions.forEach(transaction => {
                const method = transaction.paymentMethod || 'UNKNOWN';
                const amount = transaction.isExpense ? -transaction.amount : transaction.amount;

                balanceByMethod[method] = (balanceByMethod[method] || 0) + amount;
                total += amount;
            });

            const embed = new EmbedBuilder()
                .setTitle('💰 Wallet Balance')
                .setColor(total >= 0 ? 0x00FF00 : 0xFF0000)
                .setDescription(`Balance overview for **${interaction.user.username}**`)
                .addFields(
                    { name: '📊 Total Balance', value: `$${total.toFixed(2)}`, inline: true },
                    { name: '📈 Total Transactions', value: `${transactions.length}`, inline: true },
                    { name: '👤 Linked Account', value: userLink.email, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Finance Manager Bot' });

            // Add payment method breakdown
            Object.entries(balanceByMethod).forEach(([method, amount]) => {
                embed.addFields({
                    name: `💳 ${method}`,
                    value: `$${(amount as number).toFixed(2)}`,
                    inline: true
                });
            });

            // Add debug button
            const debugButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('debug_balance')
                        .setLabel('🔧 Debug Data')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
                embeds: [embed],
                components: [debugButton]
            });

        } catch (error) {
            console.error('Error fetching balance:', error);
            await interaction.editReply({
                content: '❌ Error fetching balance data. Please try again later.'
            });
        }
    },
} as Command;