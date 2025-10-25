import { WebhookClient } from 'discord.js';

const webhook = process.env.WEBHOOK_URL
    ? new WebhookClient({ url: process.env.WEBHOOK_URL })
    : null;

export async function sendAlert(message: string) {
    if (!webhook) {
        console.log('Webhook not configured:', message);
        return;
    }

    try {
        await webhook.send({
            content: `🔔 **Bot Alert**: ${message}`
        });
    } catch (error) {
        console.log('Failed to send webhook alert:', error);
    }
}