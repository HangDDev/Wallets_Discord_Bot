import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';
import {Logger} from "../../utils/logger";

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('transactions')
        .setDescription('Manage and view your transactions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your recent transactions')
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Number of transactions to show (default: 10)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Filter by transaction type')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Income', value: 'income' },
                            { name: 'Expense', value: 'expense' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('categories')
                .setDescription('View spending by categories')
        ),
    category: 'Transactions',
    description: 'View and manage transactions',
    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        const userLink = await dbService.getUserLink(interaction.user.id);

        if (!userLink) {
            await interaction.reply({
                content: '❌ Please link your account first using `/link account`',
                ephemeral: true
            });
            return;
        }

        if (subcommand === 'list') {
            await listTransactions(interaction, userLink.appUserId);
        } else if (subcommand === 'categories') {
            await showCategories(interaction, userLink.appUserId);
        }
    },
} as Command;

async function listTransactions(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const typeFilter = interaction.options.getString('type');

    const transactions = await dbService.getUserTransactions(userId, 50); // Get more for filtering

    let filteredTransactions = transactions;
    if (typeFilter === 'income') {
        filteredTransactions = transactions.filter(t => !t.isExpense);
    } else if (typeFilter === 'expense') {
        filteredTransactions = transactions.filter(t => t.isExpense);
    }

    filteredTransactions = filteredTransactions.slice(0, limit);

    const embed = new EmbedBuilder()
        .setTitle('📋 Recent Transactions')
        .setColor(0x00AE86)
        .setDescription(`Showing ${filteredTransactions.length} most recent transactions`);

    if (filteredTransactions.length === 0) {
        embed.setDescription('No transactions found for the selected filters.');
    } else {
        filteredTransactions.forEach(transaction => {
            const emoji = transaction.isExpense ? '🔴' : '🟢';
            const type = transaction.isExpense ? 'Expense' : 'Income';
            const date = new Date(transaction.date).toLocaleDateString();

            embed.addFields({
                name: `${emoji} ${transaction.description || 'No description'}`,
                value: `**$${transaction.amount.toFixed(2)}** • ${type} • ${transaction.category} • ${date}`,
                inline: false
            });
        });
    }

    // Create filter select menu
    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('transaction_filter')
                .setPlaceholder('Filter transactions...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('All Transactions')
                        .setValue('all'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Income Only')
                        .setValue('income'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Expenses Only')
                        .setValue('expense')
                )
        );

    await interaction.editReply({
        embeds: [embed],
        components: [selectMenu]
    });
}

async function showCategories(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    await interaction.deferReply();

    const transactions = await dbService.getUserTransactions(userId, 1000);
    const expenses = transactions.filter(t => t.isExpense);

    const categoryTotals: { [key: string]: number } = {};

    expenses.forEach(transaction => {
        const category = transaction.category;
        categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
    });

    const embed = new EmbedBuilder()
        .setTitle('📊 Spending by Category')
        .setColor(0xFF6B6B)
        .setDescription('Breakdown of your expenses by category');

    Object.entries(categoryTotals)
        .sort(([,a], [,b]) => b - a)
        .forEach(([category, total]) => {
            embed.addFields({
                name: `• ${category}`,
                value: `$${total.toFixed(2)}`,
                inline: true
            });
        });

    const totalExpenses = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    embed.addFields({
        name: '💰 Total Expenses',
        value: `$${totalExpenses.toFixed(2)}`,
        inline: false
    });

    await interaction.editReply({ embeds: [embed] }).catch(error => Logger.error('Error fetching transactions:', error));
}