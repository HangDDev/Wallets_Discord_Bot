import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../models/command';
import { DatabaseService } from '../../services/databaseService';

const dbService = DatabaseService.getInstance();

export default {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Debug your linked account and data')
        .addSubcommand(subcommand =>
            subcommand
                .setName('data')
                .setDescription('Check your linked data and transactions')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Check your link status')
        ),
    category: 'Debug',
    description: 'Debug your account data',
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'link') {
            await debugLink(interaction);
        } else if (subcommand === 'data') {
            await debugData(interaction);
        }
    },
} as Command;

async function debugLink(interaction: ChatInputCommandInteraction): Promise<void> {
    const userLink = await dbService.getUserLink(interaction.user.id);

    const embed = new EmbedBuilder()
        .setTitle('🔧 Account Link Debug')
        .setColor(0x0099FF);

    if (userLink) {
        // Safe date handling
        let linkedAtText: string;
        try {
            if (userLink.linkedAt && typeof userLink.linkedAt === 'object' && 'toDate' in userLink.linkedAt) {
                // It's a Firestore Timestamp
                linkedAtText = (userLink.linkedAt as any).toDate().toLocaleDateString();
            } else if (userLink.linkedAt instanceof Date) {
                // It's already a Date object
                linkedAtText = userLink.linkedAt.toLocaleDateString();
            } else {
                // Fallback
                linkedAtText = String(userLink.linkedAt);
            }
        } catch (error) {
            linkedAtText = 'Invalid Date';
        }

        embed.setDescription('✅ Your account is linked!')
            .addFields(
                { name: 'Discord ID', value: interaction.user.id, inline: true },
                { name: 'App User ID', value: userLink.appUserId, inline: true },
                { name: 'Email', value: userLink.email, inline: true },
                { name: 'Linked At', value: linkedAtText, inline: true }
            );
    } else {
        embed.setDescription('❌ Your account is not linked.')
            .addFields(
                { name: 'Discord ID', value: interaction.user.id, inline: true },
                { name: 'Next Steps', value: 'Use `/link account` to link your app account' }
            );
    }

    await interaction.editReply({ embeds: [embed] });
}

async function debugData(interaction: ChatInputCommandInteraction): Promise<void> {
    const userLink = await dbService.getUserLink(interaction.user.id);

    if (!userLink) {
        await interaction.editReply({
            content: '❌ Please link your account first using `/link account`'
        });
        return;
    }

    // Run debug on user data
    await dbService.debugUserData(userLink.appUserId);

    // Get actual data
    const transactions = await dbService.getUserTransactions(userLink.appUserId, 10);
    const borrowLend = await dbService.getBorrowLendRecords(userLink.appUserId);

    const embed = new EmbedBuilder()
        .setTitle('🔧 Data Debug Information')
        .setColor(0xFFA500)
        .setDescription(`Debug data for user: ${userLink.appUserId}`)
        .addFields(
            {
                name: '📊 Transactions Found',
                value: `${transactions.length} transactions`,
                inline: true
            },
            {
                name: '🤝 Borrow/Lend Records',
                value: `${borrowLend.length} records`,
                inline: true
            },
            {
                name: '🔗 Link Status',
                value: '✅ Linked',
                inline: true
            }
        );

    if (transactions.length > 0) {
        const totalIncome = transactions
            .filter(t => !t.isExpense)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = transactions
            .filter(t => t.isExpense)
            .reduce((sum, t) => sum + t.amount, 0);

        embed.addFields(
            { name: '💰 Total Income', value: `$${totalIncome.toFixed(2)}`, inline: true },
            { name: '💸 Total Expenses', value: `$${totalExpense.toFixed(2)}`, inline: true },
            { name: '⚖️ Net', value: `$${(totalIncome - totalExpense).toFixed(2)}`, inline: true }
        );

        // Show sample transactions
        const sample = transactions.slice(0, 3);
        const sampleText = sample.map(t =>
            `${t.isExpense ? '🔴' : '🟢'} $${t.amount} - ${t.description || 'No description'}`
        ).join('\n');

        embed.addFields({
            name: '📋 Sample Transactions',
            value: sampleText || 'No transactions to show'
        });
    } else {
        embed.addFields({
            name: '⚠️ No Transactions Found',
            value: `We searched for user ID: \`${userLink.appUserId}\`\nMake sure this matches your app's user ID exactly.`
        });
    }

    if (borrowLend.length > 0) {
        const totalLent = borrowLend
            .filter(r => r.type === 'LENT' && !r.isSettled)
            .reduce((sum, r) => sum + r.amount, 0);

        const totalBorrowed = borrowLend
            .filter(r => r.type === 'BORROWED' && !r.isSettled)
            .reduce((sum, r) => sum + r.amount, 0);

        embed.addFields(
            { name: '📤 Total Lent', value: `$${totalLent.toFixed(2)}`, inline: true },
            { name: '📥 Total Borrowed', value: `$${totalBorrowed.toFixed(2)}`, inline: true }
        );
    } else {
        embed.addFields({
            name: '📝 No Borrow/Lend Records',
            value: 'No borrow or lend records found for your account.'
        });
    }

    await interaction.editReply({ embeds: [embed] });
}