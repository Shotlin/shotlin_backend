import { FastifyRequest, FastifyReply } from "fastify";

// ── Helpers ──

function extractReferrerDomain(referrer: string | null | undefined): string | null {
    if (!referrer) return null;
    try {
        return new URL(referrer).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

function categorizeTrafficSource(referrerDomain: string | null, utmSource: string | null): string {
    if (utmSource) {
        const s = utmSource.toLowerCase();
        if (["google", "bing", "duckduckgo", "yahoo", "baidu"].includes(s)) return "Organic Search";
        if (["facebook", "instagram", "linkedin", "twitter", "tiktok", "reddit", "x"].includes(s)) return "Social Media";
        if (s.includes("email") || s.includes("newsletter")) return "Email";
        if (s.includes("cpc") || s.includes("ads") || s.includes("paid")) return "Paid Ads";
        return "Campaign";
    }
    if (!referrerDomain) return "Direct";
    const d = referrerDomain.toLowerCase();
    if (["google.com", "bing.com", "duckduckgo.com", "yahoo.com", "baidu.com", "yandex.com"].some(s => d.includes(s))) return "Organic Search";
    if (["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "reddit.com", "t.co"].some(s => d.includes(s))) return "Social Media";
    return "Referral";
}

async function geoLookup(ip: string): Promise<{
    country?: string; countryCode?: string; city?: string;
    region?: string; latitude?: number; longitude?: number; timezone?: string;
}> {
    // Skip lookup for local IPs
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
        return { country: "Local", countryCode: "LO", city: "Localhost" };
    }
    try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!res.ok) return {};
        const data = await res.json() as Record<string, unknown>;
        return {
            country: data.country_name as string || undefined,
            countryCode: data.country_code as string || undefined,
            city: data.city as string || undefined,
            region: data.region as string || undefined,
            latitude: data.latitude as number || undefined,
            longitude: data.longitude as number || undefined,
            timezone: data.timezone as string || undefined,
        };
    } catch {
        return {};
    }
}

// ── Collect (Public) ──
export async function collectHandler(
    request: FastifyRequest<{
        Body: {
            visitorId: string;
            sessionId?: string;
            path: string;
            title?: string;
            referrer?: string;
            utmSource?: string;
            utmMedium?: string;
            utmCampaign?: string;
            deviceType?: string;
            browser?: string;
            browserVersion?: string;
            os?: string;
            osVersion?: string;
            screenWidth?: number;
            screenHeight?: number;
            language?: string;
        };
    }>,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const b = request.body;

    try {
        // Check for existing active session (last 30 min)
        let session: { id: string } | null = null;
        if (b.sessionId) {
            session = await prisma.analyticsSession.findFirst({
                where: {
                    id: b.sessionId,
                    visitorId: b.visitorId,
                    lastActiveAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
                },
                select: { id: true },
            });
        }

        if (session) {
            // Update existing session
            await prisma.analyticsSession.update({
                where: { id: session.id },
                data: {
                    lastActiveAt: new Date(),
                    exitPage: b.path,
                    pageViewCount: { increment: 1 },
                    bounced: false,
                },
            });

            // Create pageview
            await prisma.pageView.create({
                data: {
                    sessionId: session.id,
                    path: b.path,
                    title: b.title,
                    referrer: b.referrer,
                },
            });

            return reply.send({ status: "ok", sessionId: session.id });
        }

        // New session — do geo lookup
        const clientIp = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
            || request.ip || "127.0.0.1";
        const geo = await geoLookup(clientIp);

        const referrerDomain = extractReferrerDomain(b.referrer);

        const newSession = await prisma.analyticsSession.create({
            data: {
                visitorId: b.visitorId,
                entryPage: b.path,
                exitPage: b.path,
                referrer: b.referrer,
                referrerDomain,
                utmSource: b.utmSource,
                utmMedium: b.utmMedium,
                utmCampaign: b.utmCampaign,
                deviceType: b.deviceType,
                browser: b.browser,
                browserVersion: b.browserVersion,
                os: b.os,
                osVersion: b.osVersion,
                screenWidth: b.screenWidth,
                screenHeight: b.screenHeight,
                language: b.language,
                ...geo,
            },
        });

        // Create first pageview
        await prisma.pageView.create({
            data: {
                sessionId: newSession.id,
                path: b.path,
                title: b.title,
            },
        });

        return reply.send({ status: "ok", sessionId: newSession.id });
    } catch (err) {
        request.log.error(err, "Analytics collect error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Heartbeat (Public) ──
export async function heartbeatHandler(
    request: FastifyRequest<{
        Body: { sessionId: string; scrollDepth?: number; path?: string };
    }>,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const { sessionId, scrollDepth, path } = request.body;

    try {
        const session = await prisma.analyticsSession.findUnique({
            where: { id: sessionId },
            select: { startedAt: true },
        });
        if (!session) return reply.code(404).send({ status: "not_found" });

        const duration = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

        await prisma.analyticsSession.update({
            where: { id: sessionId },
            data: { lastActiveAt: new Date(), duration },
        });

        // Update scroll depth on latest pageview
        if (scrollDepth !== undefined && path) {
            const latestView = await prisma.pageView.findFirst({
                where: { sessionId, path },
                orderBy: { timestamp: "desc" },
            });
            if (latestView) {
                await prisma.pageView.update({
                    where: { id: latestView.id },
                    data: {
                        scrollDepth: Math.max(scrollDepth, latestView.scrollDepth || 0),
                        timeOnPage: Math.floor((Date.now() - latestView.timestamp.getTime()) / 1000),
                    },
                });
            }
        }

        return reply.send({ status: "ok" });
    } catch (err) {
        request.log.error(err, "Analytics heartbeat error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Stats (Authenticated) ──
export async function getStatsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const range = (request.query as { range?: string }).range || "7d";

    const now = new Date();
    let since: Date;
    let prevSince: Date;
    let prevUntil: Date;

    switch (range) {
        case "today":
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            prevSince = new Date(since.getTime() - 86400000);
            prevUntil = since;
            break;
        case "30d":
            since = new Date(now.getTime() - 30 * 86400000);
            prevSince = new Date(since.getTime() - 30 * 86400000);
            prevUntil = since;
            break;
        case "all":
            since = new Date(0);
            prevSince = new Date(0);
            prevUntil = new Date(0);
            break;
        default: // 7d
            since = new Date(now.getTime() - 7 * 86400000);
            prevSince = new Date(since.getTime() - 7 * 86400000);
            prevUntil = since;
            break;
    }

    try {
        const [sessions, pageViews, prevSessions, prevPageViews] = await Promise.all([
            prisma.analyticsSession.findMany({
                where: { startedAt: { gte: since } },
                select: {
                    visitorId: true, duration: true, bounced: true,
                    pageViewCount: true,
                },
            }),
            prisma.pageView.count({ where: { timestamp: { gte: since } } }),
            range !== "all"
                ? prisma.analyticsSession.findMany({
                    where: { startedAt: { gte: prevSince, lt: prevUntil } },
                    select: { visitorId: true, duration: true, bounced: true, pageViewCount: true },
                })
                : Promise.resolve([]),
            range !== "all"
                ? prisma.pageView.count({ where: { timestamp: { gte: prevSince, lt: prevUntil } } })
                : Promise.resolve(0),
        ]);

        const uniqueVisitors = new Set(sessions.map(s => s.visitorId)).size;
        const totalSessions = sessions.length;
        const avgDuration = totalSessions > 0
            ? Math.round(sessions.reduce((a, s) => a + s.duration, 0) / totalSessions)
            : 0;
        const bounceRate = totalSessions > 0
            ? Math.round((sessions.filter(s => s.bounced).length / totalSessions) * 100 * 10) / 10
            : 0;
        const pagesPerSession = totalSessions > 0
            ? Math.round((sessions.reduce((a, s) => a + s.pageViewCount, 0) / totalSessions) * 10) / 10
            : 0;

        const prevUniqueVisitors = new Set(prevSessions.map(s => s.visitorId)).size;
        const prevTotalSessions = prevSessions.length;
        const prevAvgDuration = prevTotalSessions > 0
            ? Math.round(prevSessions.reduce((a, s) => a + s.duration, 0) / prevTotalSessions)
            : 0;
        const prevBounceRate = prevTotalSessions > 0
            ? Math.round((prevSessions.filter(s => s.bounced).length / prevTotalSessions) * 100 * 10) / 10
            : 0;

        const pctChange = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
        };

        return reply.send({
            status: "success",
            data: {
                visitors: uniqueVisitors,
                visitorsChange: pctChange(uniqueVisitors, prevUniqueVisitors),
                sessions: totalSessions,
                sessionsChange: pctChange(totalSessions, prevTotalSessions),
                pageViews,
                pageViewsChange: pctChange(pageViews, prevPageViews),
                avgDuration,
                avgDurationChange: pctChange(avgDuration, prevAvgDuration),
                bounceRate,
                bounceRateChange: pctChange(bounceRate, prevBounceRate),
                pagesPerSession,
                range,
            },
        });
    } catch (err) {
        request.log.error(err, "Analytics stats error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Time Series (Authenticated) ──
export async function getTimeSeriesHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const range = (request.query as { range?: string }).range || "7d";

    const now = new Date();
    let since: Date;
    let granularity: "hour" | "day";

    switch (range) {
        case "today":
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            granularity = "hour";
            break;
        case "30d":
            since = new Date(now.getTime() - 30 * 86400000);
            granularity = "day";
            break;
        case "all":
            since = new Date(now.getTime() - 90 * 86400000); // Last 90 days for "all"
            granularity = "day";
            break;
        default:
            since = new Date(now.getTime() - 7 * 86400000);
            granularity = "day";
            break;
    }

    try {
        const pageViews = await prisma.pageView.findMany({
            where: { timestamp: { gte: since } },
            select: { timestamp: true, sessionId: true },
            orderBy: { timestamp: "asc" },
        });

        // Group by granularity
        const buckets = new Map<string, { views: number; sessions: Set<string> }>();

        for (const pv of pageViews) {
            const d = pv.timestamp;
            const key = granularity === "hour"
                ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

            if (!buckets.has(key)) {
                buckets.set(key, { views: 0, sessions: new Set() });
            }
            const bucket = buckets.get(key)!;
            bucket.views++;
            bucket.sessions.add(pv.sessionId);
        }

        const series = Array.from(buckets.entries())
            .map(([time, data]) => ({
                time,
                views: data.views,
                visitors: data.sessions.size,
            }))
            .sort((a, b) => a.time.localeCompare(b.time));

        return reply.send({ status: "success", data: { series, granularity } });
    } catch (err) {
        request.log.error(err, "Analytics time-series error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Top Pages (Authenticated) ──
export async function getTopPagesHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const q = request.query as { range?: string; limit?: string };
    const range = q.range || "7d";
    const limit = parseInt(q.limit || "20", 10);

    const now = new Date();
    let since: Date;
    switch (range) {
        case "today": since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case "30d": since = new Date(now.getTime() - 30 * 86400000); break;
        case "all": since = new Date(0); break;
        default: since = new Date(now.getTime() - 7 * 86400000); break;
    }

    try {
        const views = await prisma.pageView.findMany({
            where: { timestamp: { gte: since } },
            select: { path: true, title: true, timeOnPage: true, scrollDepth: true, sessionId: true },
        });

        // Aggregate by path
        const pageMap = new Map<string, {
            title: string; views: number; totalTime: number; timeCount: number;
            totalScroll: number; scrollCount: number; sessions: Set<string>;
        }>();

        for (const v of views) {
            if (!pageMap.has(v.path)) {
                pageMap.set(v.path, {
                    title: v.title || v.path,
                    views: 0, totalTime: 0, timeCount: 0,
                    totalScroll: 0, scrollCount: 0, sessions: new Set(),
                });
            }
            const p = pageMap.get(v.path)!;
            p.views++;
            if (v.title) p.title = v.title;
            if (v.timeOnPage) { p.totalTime += v.timeOnPage; p.timeCount++; }
            if (v.scrollDepth) { p.totalScroll += v.scrollDepth; p.scrollCount++; }
            p.sessions.add(v.sessionId);
        }

        // Find single-page sessions for bounce rate
        const sessionPageCounts = new Map<string, number>();
        for (const v of views) {
            sessionPageCounts.set(v.sessionId, (sessionPageCounts.get(v.sessionId) || 0) + 1);
        }

        const pages = Array.from(pageMap.entries())
            .map(([path, data]) => {
                const bouncedSessions = Array.from(data.sessions).filter(s => sessionPageCounts.get(s) === 1).length;
                return {
                    path,
                    title: data.title,
                    views: data.views,
                    uniqueVisitors: data.sessions.size,
                    avgTime: data.timeCount > 0 ? Math.round(data.totalTime / data.timeCount) : 0,
                    avgScroll: data.scrollCount > 0 ? Math.round(data.totalScroll / data.scrollCount) : 0,
                    bounceRate: data.sessions.size > 0
                        ? Math.round((bouncedSessions / data.sessions.size) * 100)
                        : 0,
                };
            })
            .sort((a, b) => b.views - a.views)
            .slice(0, limit);

        return reply.send({ status: "success", data: pages });
    } catch (err) {
        request.log.error(err, "Analytics top-pages error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Geographic Data (Authenticated) ──
export async function getGeoHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const range = (request.query as { range?: string }).range || "7d";

    const now = new Date();
    let since: Date;
    switch (range) {
        case "today": since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case "30d": since = new Date(now.getTime() - 30 * 86400000); break;
        case "all": since = new Date(0); break;
        default: since = new Date(now.getTime() - 7 * 86400000); break;
    }

    try {
        const sessions = await prisma.analyticsSession.findMany({
            where: { startedAt: { gte: since } },
            select: {
                country: true, countryCode: true, city: true,
                visitorId: true, duration: true,
            },
        });

        // Aggregate by country
        const countryMap = new Map<string, {
            country: string; countryCode: string;
            visitors: Set<string>; sessions: number; totalDuration: number;
            cities: Map<string, { sessions: number; visitors: Set<string> }>;
        }>();

        for (const s of sessions) {
            const cc = s.countryCode || "XX";
            if (!countryMap.has(cc)) {
                countryMap.set(cc, {
                    country: s.country || "Unknown",
                    countryCode: cc,
                    visitors: new Set(), sessions: 0, totalDuration: 0,
                    cities: new Map(),
                });
            }
            const c = countryMap.get(cc)!;
            c.visitors.add(s.visitorId);
            c.sessions++;
            c.totalDuration += s.duration;

            if (s.city) {
                if (!c.cities.has(s.city)) {
                    c.cities.set(s.city, { sessions: 0, visitors: new Set() });
                }
                const city = c.cities.get(s.city)!;
                city.sessions++;
                city.visitors.add(s.visitorId);
            }
        }

        const totalSessions = sessions.length;

        const countries = Array.from(countryMap.values())
            .map(c => ({
                country: c.country,
                countryCode: c.countryCode,
                visitors: c.visitors.size,
                sessions: c.sessions,
                percentage: totalSessions > 0 ? Math.round((c.sessions / totalSessions) * 100 * 10) / 10 : 0,
                avgDuration: c.sessions > 0 ? Math.round(c.totalDuration / c.sessions) : 0,
                topCities: Array.from(c.cities.entries())
                    .map(([name, data]) => ({ name, sessions: data.sessions, visitors: data.visitors.size }))
                    .sort((a, b) => b.sessions - a.sessions)
                    .slice(0, 5),
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 50);

        return reply.send({ status: "success", data: countries });
    } catch (err) {
        request.log.error(err, "Analytics geo error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Devices (Authenticated) ──
export async function getDevicesHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const range = (request.query as { range?: string }).range || "7d";

    const now = new Date();
    let since: Date;
    switch (range) {
        case "today": since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case "30d": since = new Date(now.getTime() - 30 * 86400000); break;
        case "all": since = new Date(0); break;
        default: since = new Date(now.getTime() - 7 * 86400000); break;
    }

    try {
        const sessions = await prisma.analyticsSession.findMany({
            where: { startedAt: { gte: since } },
            select: { deviceType: true, browser: true, os: true, visitorId: true },
        });

        const total = sessions.length;

        // Device type distribution
        const deviceMap = new Map<string, number>();
        const browserMap = new Map<string, number>();
        const osMap = new Map<string, number>();

        for (const s of sessions) {
            const dt = s.deviceType || "unknown";
            deviceMap.set(dt, (deviceMap.get(dt) || 0) + 1);
            const br = s.browser || "Unknown";
            browserMap.set(br, (browserMap.get(br) || 0) + 1);
            const os = s.os || "Unknown";
            osMap.set(os, (osMap.get(os) || 0) + 1);
        }

        const toDistribution = (map: Map<string, number>) =>
            Array.from(map.entries())
                .map(([name, count]) => ({
                    name,
                    count,
                    percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
                }))
                .sort((a, b) => b.count - a.count);

        return reply.send({
            status: "success",
            data: {
                devices: toDistribution(deviceMap),
                browsers: toDistribution(browserMap),
                os: toDistribution(osMap),
                total,
            },
        });
    } catch (err) {
        request.log.error(err, "Analytics devices error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Referrers / Traffic Sources (Authenticated) ──
export async function getReferrersHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;
    const range = (request.query as { range?: string }).range || "7d";

    const now = new Date();
    let since: Date;
    switch (range) {
        case "today": since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case "30d": since = new Date(now.getTime() - 30 * 86400000); break;
        case "all": since = new Date(0); break;
        default: since = new Date(now.getTime() - 7 * 86400000); break;
    }

    try {
        const sessions = await prisma.analyticsSession.findMany({
            where: { startedAt: { gte: since } },
            select: {
                referrerDomain: true, utmSource: true, utmMedium: true,
                utmCampaign: true, visitorId: true,
            },
        });

        const total = sessions.length;

        // Traffic source categories
        const sourceMap = new Map<string, { count: number; visitors: Set<string> }>();
        const referrerMap = new Map<string, { count: number; visitors: Set<string> }>();

        for (const s of sessions) {
            const source = categorizeTrafficSource(s.referrerDomain, s.utmSource);
            if (!sourceMap.has(source)) sourceMap.set(source, { count: 0, visitors: new Set() });
            sourceMap.get(source)!.count++;
            sourceMap.get(source)!.visitors.add(s.visitorId);

            if (s.referrerDomain) {
                if (!referrerMap.has(s.referrerDomain)) referrerMap.set(s.referrerDomain, { count: 0, visitors: new Set() });
                referrerMap.get(s.referrerDomain)!.count++;
                referrerMap.get(s.referrerDomain)!.visitors.add(s.visitorId);
            }
        }

        const sources = Array.from(sourceMap.entries())
            .map(([name, data]) => ({
                name,
                sessions: data.count,
                visitors: data.visitors.size,
                percentage: total > 0 ? Math.round((data.count / total) * 100 * 10) / 10 : 0,
            }))
            .sort((a, b) => b.sessions - a.sessions);

        const referrers = Array.from(referrerMap.entries())
            .map(([domain, data]) => ({
                domain,
                sessions: data.count,
                visitors: data.visitors.size,
                percentage: total > 0 ? Math.round((data.count / total) * 100 * 10) / 10 : 0,
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 20);

        return reply.send({ status: "success", data: { sources, referrers } });
    } catch (err) {
        request.log.error(err, "Analytics referrers error");
        return reply.code(500).send({ status: "error" });
    }
}

// ── Realtime (Authenticated) ──
export async function getRealtimeHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const prisma = request.server.prisma;

    try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

        const activeSessions = await prisma.analyticsSession.findMany({
            where: { lastActiveAt: { gte: fiveMinAgo } },
            select: {
                visitorId: true, exitPage: true, country: true,
                countryCode: true, deviceType: true,
            },
        });

        const uniqueVisitors = new Set(activeSessions.map(s => s.visitorId)).size;

        // Active pages
        const pageMap = new Map<string, number>();
        for (const s of activeSessions) {
            const page = s.exitPage || "/";
            pageMap.set(page, (pageMap.get(page) || 0) + 1);
        }

        const activePages = Array.from(pageMap.entries())
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return reply.send({
            status: "success",
            data: {
                activeVisitors: uniqueVisitors,
                activeSessions: activeSessions.length,
                activePages,
            },
        });
    } catch (err) {
        request.log.error(err, "Analytics realtime error");
        return reply.code(500).send({ status: "error" });
    }
}
