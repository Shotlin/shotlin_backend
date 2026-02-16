import 'dotenv/config';
import path from 'path';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const server = Fastify({
  logger: process.env.NODE_ENV === 'production'
    ? true  // JSON logs in production
    : {
      transport: {
        target: 'pino-pretty',
      },
    },
});

// Zod Validation Setup
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Plugins
import prismaPlugin from './plugins/prisma';

// Register Plugins
server.register(prismaPlugin);

// Security Plugins
// Security Plugins
server.register(helmet);
server.register(import('@fastify/cookie'), {
  secret: process.env.JWT_SECRET, // Use the same secret for signing cookies
  hook: 'onRequest',
});

server.register(cors, {
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// Register Multipart & Static BEFORE routes
server.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});
server.register(fastifyStatic, {
  root: path.join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
});

// Fail fast — check JWT secret BEFORE registering the plugin
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not defined in .env");
  process.exit(1);
}

// JWT Setup
server.register(import('@fastify/jwt'), {
  secret: process.env.JWT_SECRET,
});

server.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = request.cookies.token; // Check cookie first
    if (token) {
      if (!request.headers.authorization) {
        request.headers.authorization = `Bearer ${token}`;
      }
    }
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ message: "Unauthorized" });
  }
});

// Routes — AFTER all plugins are registered
import { contactRoutes } from './modules/contact/contact.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { uploadRoutes } from './modules/upload/upload.routes';
import { botConfigRoutes } from './modules/bot-config/bot-config.routes';
import { bookingsRoutes } from './modules/bookings/bookings.routes';
import { blogRoutes } from './modules/blog/blog.routes';
import { testimonialRoutes } from './modules/testimonials/testimonials.routes';
import { serviceRoutes } from './modules/services/service.routes';
import { userRoutes } from './modules/users/users.routes';
import { promotionRoutes } from './modules/promotions/promotion.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { settingRoutes } from './modules/settings/setting.routes';

server.register(contactRoutes, { prefix: '/api/v1/contact' });
server.register(authRoutes, { prefix: '/api/v1/auth' });
server.register(uploadRoutes, { prefix: '/api/v1/upload' });
server.register(botConfigRoutes, { prefix: '/api/v1/bot-config' });
server.register(bookingsRoutes, { prefix: '/api/v1/bookings' });
server.register(blogRoutes, { prefix: '/api/v1/blog' });
server.register(testimonialRoutes, { prefix: '/api/v1/testimonials' });
server.register(serviceRoutes, { prefix: '/api/v1/services' });
server.register(userRoutes, { prefix: '/api/v1/users' });
server.register(promotionRoutes, { prefix: '/api/v1/promotions' });
server.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
server.register(settingRoutes, { prefix: '/api/v1/settings' });

// Health Check
server.get('/', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 4000, host: '0.0.0.0' });
    console.log('🚀 Server running at http://localhost:4000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
