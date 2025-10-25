import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';
import {Logger} from "../../utils/logger";

const dbService = DatabaseService.getInstance();
export default {
    data: new SlashCommandBuilder()
        .setName('borrowlend')
        .setDescription('Manage borrow and lend records')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your borrow/lend records')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Filter by type')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Borrowed', value: 'BORROWED' },
                            { name: 'Lent', value: 'LENT' }
                        )
                )
                .addBooleanOption(option =>
                    option
                        .setName('settled')
                        .setDescription('Filter by settlement status')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('summary')
                .setDescription('Get summary of borrow/lend activities')
        ),
    category: 'BorrowLend',
    description: 'Manage money borrowing and lending records',
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
            await listRecords(interaction, userLink.appUserId);
        } else if (subcommand === 'summary') {
            await showSummary(interaction, userLink.appUserId);
        }
    },
} as Command;

async function listRecords(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    await interaction.deferReply();

    const typeFilter = interaction.options.getString('type') as 'BORROWED' | 'LENT' | undefined;
    const settledFilter = interaction.options.getBoolean('settled');

    let records = await dbService.getBorrowLendRecords(userId);

    if (typeFilter) {
        records = records.filter(record => record.type === typeFilter);
    }

    if (settledFilter !== null) {
        records = records.filter(record => record.isSettled === settledFilter);
    }

    const embed = new EmbedBuilder()
        .setTitle('🤝 Borrow/Lend Records')
        .setColor(0xFFA500)
        .setDescription(`Showing ${records.length} records`);

    if (records.length === 0) {
        embed.setDescription('No records found for the selected filters.');
    } else {
        records.slice(0, 10).forEach(record => {
            const emoji = record.type === 'BORROWED' ? '⬇️' : '⬆️';
            const status = record.isSettled ? '✅ Settled' : '⏳ Pending';

            // Safe date handling
            let dateText = 'Unknown date';
            let dueDateText = 'No due date';

            try {
                if (record.date) {
                    const date = record.date instanceof Date ? record.date : new Date(record.date);
                    dateText = date.toLocaleDateString();
                }

                if (record.dueDate) {
                    const dueDate = record.dueDate instanceof Date ? record.dueDate : new Date(record.dueDate);
                    dueDateText = dueDate.toLocaleDateString();
                }
            } catch (error) {
                dateText = 'Invalid date';
                dueDateText = 'Invalid due date';
            }

            embed.addFields({
                name: `${emoji} ${record.personName} - $${record.amount.toFixed(2)}`,
                value: `**Type:** ${record.type} | **Status:** ${status}\n**Date:** ${dateText} | **Due:** ${dueDateText}\n**Desc:** ${record.description || 'No description'}`,
                inline: false
            });
        });
    }
}

async function showSummary(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
    await interaction.deferReply();

    const records = await dbService.getBorrowLendRecords(userId);

    if (records.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Borrow/Lend Summary')
            .setColor(0xFFA500)
            .setDescription('No borrow or lend records found for your account')
            .addFields(
                { name: '💡 Information', value: 'Your transactions are working, but no borrow/lend records were found.' },
                { name: '🔍 Data Location', value: `We checked: users/${userId}/borrow_lend` }, // Updated to borrow_lend
                { name: '📱 App Check', value: 'Make sure you have created borrow/lend records in your Android app' }
            );

        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const totalBorrowed = records
        .filter(r => r.type === 'BORROWED' && !r.isSettled)
        .reduce((sum, r) => sum + r.amount, 0);

    const totalLent = records
        .filter(r => r.type === 'LENT' && !r.isSettled)
        .reduce((sum, r) => sum + r.amount, 0);

    const netPosition = totalLent - totalBorrowed;
    const pendingRecords = records.filter(r => !r.isSettled).length;

    const embed = new EmbedBuilder()
        .setTitle('📊 Borrow/Lend Summary')
        .setColor(0x00AE86)
        .setDescription('Summary of your outstanding borrow/lend activities')
        .addFields(
            { name: '💰 Total Lent (Pending)', value: `$${totalLent.toFixed(2)}`, inline: true },
            { name: '💸 Total Borrowed (Pending)', value: `$${totalBorrowed.toFixed(2)}`, inline: true },
            { name: '⚖️ Net Position', value: `$${netPosition.toFixed(2)}`, inline: true },
            { name: '📋 Pending Records', value: `${pendingRecords}`, inline: true },
            { name: '✅ Settled Records', value: `${records.length - pendingRecords}`, inline: true },
            { name: '📈 Total Records', value: `${records.length}`, inline: true }
        )
        .setTimestamp();

    if (netPosition > 0) {
        embed.addFields({
            name: '💡 Insight',
            value: 'You have more money lent out than borrowed. Great position!'
        });
    } else if (netPosition < 0) {
        embed.addFields({
            name: '⚠️ Insight',
            value: 'You owe more than what is owed to you. Consider settling debts.'
        });
    }

    await interaction.editReply({ embeds: [embed] }).catch(error => Logger.error('Error fetching borrow/lend:', error));
}