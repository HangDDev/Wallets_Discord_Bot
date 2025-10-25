import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | any;
    category: string;
    description: string;
    usage?: string;
    cooldown?: number;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}