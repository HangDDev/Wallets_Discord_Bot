import { Client, Events, Interaction, Message } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { CommandHandler } from './commandHandler';
import { Logger } from '../utils/logger';

interface Event {
    name: string;
    once?: boolean;
    execute: (...args: any[]) => void;
}

export class EventHandler {
    private client: Client;
    private commandHandler: CommandHandler;

    constructor(client: Client, commandHandler: CommandHandler) {
        this.client = client;
        this.commandHandler = commandHandler;
    }

    public async loadEvents(): Promise<void> {
        const eventsPath = join(__dirname, '../events');
        const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of eventFiles) {
            try {
                const eventModule = await import(join(eventsPath, file));
                const event: Event = eventModule.default;

                if (event.once) {
                    this.client.once(event.name, (...args) => event.execute(...args));
                } else {
                    this.client.on(event.name, (...args) => event.execute(...args));
                }

                Logger.info(`Loaded event: ${event.name}`);
            } catch (error) {
                Logger.error(`Error loading event ${file}:`, error);
            }
        }

        this.loadDefaultEvents();
    }

    private loadDefaultEvents(): void {
        // Interaction Create Event
        this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
            if (interaction.isChatInputCommand()) {
                const command = this.commandHandler.getCommand(interaction.commandName);

                if (!command) {
                    Logger.warn(`No command matching ${interaction.commandName} was found.`);
                    return;
                }

                try {
                    await command.execute(interaction);
                    Logger.info(`Executed command: ${interaction.commandName} for user: ${interaction.user.tag}`);
                } catch (error) {
                    Logger.error(`Error executing command ${interaction.commandName}:`, error);

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({
                            content: 'There was an error while executing this command!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: 'There was an error while executing this command!',
                            ephemeral: true
                        });
                    }
                }
            }

            // Handle button interactions
            if (interaction.isButton()) {
                // Handle button clicks here
                Logger.info(`Button interaction: ${interaction.customId}`);
            }

            // Handle select menu interactions
            if (interaction.isStringSelectMenu()) {
                // Handle select menu interactions here
                Logger.info(`Select menu interaction: ${interaction.customId}`);
            }
        });

        // Client Ready Event
        this.client.once(Events.ClientReady, (readyClient: Client<true>) => {
            Logger.success(`Ready! Logged in as ${readyClient.user.tag}`);
        });
    }
}