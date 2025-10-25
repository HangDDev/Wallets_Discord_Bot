import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { DatabaseService } from './services/databaseService';
import { Logger } from './utils/logger';
import { sendAlert } from './utils/alerts';
import { setupHealthCheck } from './utils/health'; // Remove the express import and server from here

declare module 'discord.js' {
    interface Client {
        commandHandler: CommandHandler;
        dbService: DatabaseService;
    }
}

config();

class FinanceBot {
    public client: Client;
    private commandHandler: CommandHandler;
    private eventHandler: EventHandler;
    private dbService: DatabaseService;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
            presence: {
                activities: [{
                    name: 'Your Finances 💰',
                    type: ActivityType.Watching
                }]
            }
        }) as Client;

        this.dbService = DatabaseService.getInstance();
        this.commandHandler = new CommandHandler(this.client);
        this.eventHandler = new EventHandler(this.client, this.commandHandler);

        // Attach handlers to client for global access
        this.client.commandHandler = this.commandHandler;
        this.client.dbService = this.dbService;
    }

    public async start(): Promise<void> {
        try {
            await this.dbService.initialize();
            await this.commandHandler.loadCommands();
            await this.eventHandler.loadEvents();

            setupHealthCheck();

            await this.client.login(process.env.DISCORD_TOKEN);

            Logger.success('Finance bot started successfully!');
            sendAlert('Bot started successfully!');
        } catch (error) {
            Logger.error('Failed to start bot:', error);
            sendAlert(`Failed to start bot: ${error}`);
            process.exit(1);
        }
    }
}

const bot = new FinanceBot();
bot.start();