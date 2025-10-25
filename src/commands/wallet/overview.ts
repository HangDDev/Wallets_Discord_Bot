import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('overview')
        .setDescription('Get a comprehensive financial overview')
        .addStringOption(option =>
            option
                .setName('period')
                .setDescription('Time period for overview')
                .setRequired(true)
                .addChoices(
                    { name: 'Weekly', value: 'weekly' },
                    { name: 'Monthly', value: 'monthly' },
                    { name: 'Quarterly', value: 'quarterly' }
                )
        ),
    category: 'Wallet',
    description: 'Get detailed financial overview with insights',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const userLink = await dbService.getUserLink(interaction.user.id);

        if (!userLink) {
            await interaction.editReply({
                content: '❌ Please link your account first using `/link account`'
            });
            return;
        }

        const period = interaction.options.getString('period', true);

        try {
            const transactions = await dbService.getUserTransactions(userLink.appUserId, 50);
            const borrowRecords = await dbService.getBorrowLendRecords(userLink.appUserId);

            const income = transactions
                .filter(t => !t.isExpense)
                .reduce((sum, t) => sum + t.amount, 0);

            const expenses = transactions
                .filter(t => t.isExpense)
                .reduce((sum, t) => sum + t.amount, 0);

            const netBalance = income - expenses;
            const savingsRate = income > 0 ? (netBalance / income) * 100 : 0;

            const embed = new EmbedBuilder()
                .setTitle(`📈 Financial Overview - ${period}`)
                .setColor(0x0099FF)
                .setDescription(`Comprehensive financial analysis for **${interaction.user.username}**`)
                .addFields(
                    { name: '💰 Total Income', value: `$${income.toFixed(2)}`, inline: true },
                    { name: '💸 Total Expenses', value: `$${expenses.toFixed(2)}`, inline: true },
                    { name: '⚖️ Net Balance', value: `$${netBalance.toFixed(2)}`, inline: true },
                    { name: '📊 Savings Rate', value: `${savingsRate.toFixed(1)}%`, inline: true },
                    { name: '🔄 Total Transactions', value: `${transactions.length}`, inline: true },
                    { name: '🤝 Active Borrow/Lend', value: `${borrowRecords.filter(r => !r.isSettled).length}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Finance Manager Bot - Smart Financial Insights' });

            // Add insights based on data
            const insights: string[] = [];

            if (savingsRate > 20) {
                insights.push('🎉 Great savings rate! Keep it up!');
            } else if (savingsRate < 0) {
                insights.push('⚠️ You\'re spending more than you earn. Consider reviewing expenses.');
            }

            if (expenses > income * 0.8) {
                insights.push('💡 High expense ratio. Look for cost-saving opportunities.');
            }

            if (insights.length > 0) {
                embed.addFields({
                    name: '💡 Financial Insights',
                    value: insights.join('\n')
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await interaction.editReply({
                content: '❌ Error generating financial overview. Please try again later.'
            });
        }
    },
} as Command;