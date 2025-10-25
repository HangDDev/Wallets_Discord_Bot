import express from 'express';

let healthServer: any = null;

export function setupHealthCheck() {
    const app = express();
    const port = process.env.PORT || 3000;

    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });

    healthServer = app.listen(port, () => {
        console.log(`Health check server running on port ${port}`);
    });

    return healthServer;
}

export function stopHealthCheck() {
    if (healthServer) {
        healthServer.close();
    }
}