import { Client, Collection, REST, Routes, ApplicationCommandDataResolvable } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from '../models/command';
import { Logger } from '../utils/logger';

export class CommandHandler {
    private client: Client;
    private commands: Collection<string, Command> = new Collection();
    private commandCategories: Map<string, Command[]> = new Map();

    constructor(client: Client) {
        this.client = client;
    }

    public async loadCommands(): Promise<void> {
        try {
            const commandsPath = join(__dirname, '../commands');
            const categoryFolders = readdirSync(commandsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            Logger.info(`Found ${categoryFolders.length} command categories: ${categoryFolders.join(', ')}`);

            for (const category of categoryFolders) {
                const categoryPath = join(commandsPath, category);
                const commandFiles = readdirSync(categoryPath).filter(file =>
                    file.endsWith('.ts') || file.endsWith('.js')
                );

                const categoryCommands: Command[] = [];

                Logger.info(`Loading ${commandFiles.length} commands from ${category} category`);

                for (const file of commandFiles) {
                    try {
                        const commandModule = await import(join(categoryPath, file));
                        const command: Command = commandModule.default;

                        if (!command.data?.name) {
                            Logger.warn(`Command in ${file} is missing data or name`);
                            continue;
                        }

                        this.commands.set(command.data.name, command);
                        categoryCommands.push(command);

                        Logger.info(`✓ Loaded command: ${command.data.name} from ${category}`);
                    } catch (error) {
                        Logger.error(`Error loading command ${file}:`, error);
                    }
                }

                this.commandCategories.set(category, categoryCommands);
                Logger.info(`Category ${category} loaded with ${categoryCommands.length} commands`);
            }

            await this.registerCommands();
        } catch (error) {
            Logger.error('Error loading commands:', error);
            throw error;
        }
    }

    private async registerCommands(): Promise<void> {
        if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
            throw new Error('Missing DISCORD_TOKEN or CLIENT_ID in environment variables');
        }

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const commands: ApplicationCommandDataResolvable[] = this.commands.map(command => command.data);

        try {
            Logger.info(`Started refreshing ${commands.length} application (/) commands.`);

            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );

            Logger.success(`Successfully reloaded ${commands.length} application (/) commands.`);
        } catch (error) {
            Logger.error('Error registering commands:', error);
        }
    }

    public getCommands(): Collection<string, Command> {
        return this.commands;
    }

    public getCommandCategories(): Map<string, Command[]> {
        return this.commandCategories;
    }

    public getCommand(name: string): Command | undefined {
        return this.commands.get(name);
    }
}