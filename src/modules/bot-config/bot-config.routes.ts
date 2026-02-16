import { FastifyInstance } from 'fastify';
import {
    listIntentsHandler,
    createIntentHandler,
    updateIntentHandler,
    deleteIntentHandler,
} from './bot-config.controller';

export async function botConfigRoutes(server: FastifyInstance) {
    // All routes require authentication
    server.addHook('onRequest', server.authenticate);

    const rateLimitConfig = { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } };

    server.get('/', rateLimitConfig, listIntentsHandler);
    server.post('/', rateLimitConfig, createIntentHandler);
    server.put('/:id', rateLimitConfig, updateIntentHandler);
    server.delete('/:id', rateLimitConfig, deleteIntentHandler);
}
