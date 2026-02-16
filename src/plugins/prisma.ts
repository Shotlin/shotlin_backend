import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import path from 'path';

// Declare module to add prisma to FastifyInstance
declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}

const prismaPlugin: FastifyPluginAsync = async (server) => {
    const prisma = new PrismaClient();

    await prisma.$connect();

    // Make prisma available through server.prisma
    server.decorate('prisma', prisma);

    server.addHook('onClose', async (server) => {
        await server.prisma.$disconnect();
    });
};

export default fp(prismaPlugin);
