import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
    collectHandler,
    heartbeatHandler,
    getStatsHandler,
    getTimeSeriesHandler,
    getTopPagesHandler,
    getGeoHandler,
    getDevicesHandler,
    getReferrersHandler,
    getRealtimeHandler,
} from "./analytics.controller";

export async function analyticsRoutes(server: FastifyInstance) {
    // ── Public Endpoints (tracking beacons) ──

    server.post(
        "/collect",
        {
            schema: {
                body: z.object({
                    visitorId: z.string().min(1),
                    sessionId: z.string().optional(),
                    path: z.string().min(1),
                    title: z.string().optional(),
                    referrer: z.string().optional(),
                    utmSource: z.string().optional(),
                    utmMedium: z.string().optional(),
                    utmCampaign: z.string().optional(),
                    deviceType: z.string().optional(),
                    browser: z.string().optional(),
                    browserVersion: z.string().optional(),
                    os: z.string().optional(),
                    osVersion: z.string().optional(),
                    screenWidth: z.number().optional(),
                    screenHeight: z.number().optional(),
                    language: z.string().optional(),
                }),
            },
        },
        collectHandler
    );

    server.post(
        "/heartbeat",
        {
            schema: {
                body: z.object({
                    sessionId: z.string().min(1),
                    scrollDepth: z.number().min(0).max(100).optional(),
                    path: z.string().optional(),
                }),
            },
        },
        heartbeatHandler
    );

    // ── Authenticated Endpoints (dashboard queries) ──

    server.get(
        "/stats",
        { onRequest: [server.authenticate] },
        getStatsHandler
    );

    server.get(
        "/time-series",
        { onRequest: [server.authenticate] },
        getTimeSeriesHandler
    );

    server.get(
        "/top-pages",
        { onRequest: [server.authenticate] },
        getTopPagesHandler
    );

    server.get(
        "/geo",
        { onRequest: [server.authenticate] },
        getGeoHandler
    );

    server.get(
        "/devices",
        { onRequest: [server.authenticate] },
        getDevicesHandler
    );

    server.get(
        "/referrers",
        { onRequest: [server.authenticate] },
        getReferrersHandler
    );

    server.get(
        "/realtime",
        { onRequest: [server.authenticate] },
        getRealtimeHandler
    );
}
