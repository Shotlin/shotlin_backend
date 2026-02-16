/**
 * Shotlin Enterprise Bot Engine — Dynamic DB Version
 *
 * Loads intents from the `bot_intents` table. Falls back to hardcoded defaults
 * if the table is empty. Uses a 60-second cache to avoid hitting the DB on every message.
 */

import { PrismaClient } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface BotIntent {
    name: string;
    patterns: string[];
    response: string;
    quickReplies: string[];
    priority: number;
    enabled: boolean;
}

export interface BotResponse {
    message: string;
    quickReplies?: string[];
}

// ═══════════════════════════════════════════════════════════════
// HARDCODED DEFAULTS (used when DB is empty)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_INTENTS: BotIntent[] = [
    {
        name: "HANDOFF",
        patterns: ["human", "real person", "agent", "talk to someone", "speak to", "call me", "phone", "manager", "support team", "not helpful", "frustrated", "connect me", "representative"],
        response: "Connecting you with our team now.\n\nA team member will review this conversation and respond shortly. You can continue messaging here — we'll get back to you as soon as possible.",
        quickReplies: [],
        priority: 100,
        enabled: true,
    },
    {
        name: "GREETING",
        patterns: ["hi", "hello", "hey", "good morning", "good evening", "good afternoon", "namaste", "howdy", "hii", "hiii"],
        response: "Hi! Welcome to Shotlin 👋\n\nWe build production-grade software for businesses. How can we help you today?",
        quickReplies: ["View Our Services", "Get a Quote", "How It Works", "Talk to Team"],
        priority: 90,
        enabled: true,
    },
    {
        name: "THANKS",
        patterns: ["thank", "thanks", "thx", "appreciate", "helpful", "great help", "perfect"],
        response: "Happy to help! Let us know if you have more questions. 👋",
        quickReplies: ["View Services", "Get a Quote", "Talk to Team"],
        priority: 85,
        enabled: true,
    },
    {
        name: "SERVICE_WEB_DEV",
        patterns: ["website", "web development", "web dev", "app development", "mobile app", "build app", "build website", "web app", "landing page", "frontend", "backend"],
        response: "**Website & App Development**\n\nCustom-built, responsive, high-performance websites and applications tailored to your business needs.\n\n• Responsive design for all devices\n• Performance-optimized architecture\n• Custom functionality and features\n• SEO-friendly structure\n\n🔧 Tech: React, Next.js, TypeScript, Node.js, Tailwind CSS",
        quickReplies: ["See the ₹30K Offer", "Timeline?", "Get a Quote", "View Other Services"],
        priority: 70,
        enabled: true,
    },
    {
        name: "SERVICE_AI_CALLING",
        patterns: ["ai calling", "calling agent", "voice bot", "phone bot", "automated calls", "ivr", "outbound call"],
        response: "**AI Calling Agent**\n\nAI-powered calling solutions that engage customers, take orders, and provide support with natural-sounding voice interactions.\n\n• 24/7 availability for customers\n• Natural-sounding conversations\n• Automatic lead qualification\n• Seamless CRM integration\n\n🔧 Tech: GPT-4, NLP, Voice Synthesis, Speech Recognition",
        quickReplies: ["Pricing?", "How It Works", "Get a Quote", "View Other Services"],
        priority: 70,
        enabled: true,
    },
    {
        name: "SERVICE_AI_CHATBOX",
        patterns: ["chatbot", "chat bot", "ai chat", "live chat", "customer chat", "automated chat"],
        response: "**AI Chatbox**\n\nSmart conversational AI that answers queries, boosts engagement, and improves conversions through personalized interactions.\n\n• Instant response to customer queries\n• Personalized product recommendations\n• Intelligent conversation flows\n• Multilingual support\n\n🔧 Tech: NLU, Machine Learning, Sentiment Analysis, Real-time Processing",
        quickReplies: ["Pricing?", "See a Demo", "Get a Quote", "View Other Services"],
        priority: 70,
        enabled: true,
    },
    {
        name: "SERVICE_AI_CRM",
        patterns: ["crm", "lead management", "customer management", "follow up", "lead tracking", "sales pipeline"],
        response: "**AI CRM**\n\nManage leads, automate follow-ups, and analyze data with intelligent CRM solutions for better business decisions.\n\n• Automated lead scoring and qualification\n• Intelligent follow-up sequences\n• Customer journey insights\n• Sales performance analytics\n\n🔧 Tech: Data Analytics, Predictive AI, Automation, Integration APIs",
        quickReplies: ["Pricing?", "How It Works", "Get a Quote", "View Other Services"],
        priority: 70,
        enabled: true,
    },
    {
        name: "SERVICE_ANALYTICS",
        patterns: ["analytics", "tracking", "traffic", "seo", "conversion", "google analytics", "data insights", "reporting"],
        response: "**Website Analytics**\n\nDetailed insights on traffic, performance, and conversions for data-driven decisions that improve ROI.\n\n• Real-time traffic monitoring\n• User behavior analysis\n• Conversion rate optimization\n• Custom reporting dashboards\n\n🔧 Tech: Analytics API, Data Visualization, Event Tracking, A/B Testing",
        quickReplies: ["Pricing?", "Get a Quote", "View Other Services"],
        priority: 70,
        enabled: true,
    },
    {
        name: "SERVICES_OVERVIEW",
        patterns: ["services", "what do you do", "what you offer", "offerings", "solutions", "what can you", "help me with"],
        response: "Here's what we build:\n\n• **Web & App Dev** — Custom-built, responsive, high-performance websites and applications\n• **AI Calling** — AI-powered calling solutions with natural voice interactions\n• **AI Chatbot** — Smart conversational AI for engagement and conversions\n• **AI CRM** — Intelligent lead management and automation\n• **Analytics** — Data insights for traffic, performance, and conversions\n\nWhich service interests you?",
        quickReplies: ["Web & App Dev", "AI Calling", "AI Chatbot", "AI CRM", "Analytics", "Get a Quote"],
        priority: 60,
        enabled: true,
    },
    {
        name: "PRICING",
        patterns: ["price", "cost", "how much", "budget", "quote", "estimate", "charges", "fees", "affordable", "expensive", "cheap", "rate"],
        response: "Our flagship offer:\n\n💰 **₹30,000** — one-time, fixed price\n\nThis gets you a full custom website + app with Admin Panel, Payment Gateway, Database, and Server Deployment included.\n\nIt's a fixed ₹30,000 one-time payment. The software is yours forever. Hosting costs separately (usually < $10/month) which we set up for you.",
        quickReplies: ["What's Included?", "Timeline?", "Talk to Team", "View Services"],
        priority: 60,
        enabled: true,
    },
    {
        name: "OFFER_DETAILS",
        patterns: ["30000", "30k", "30,000", "offer", "deal", "package", "what's included", "what do i get", "includes"],
        response: "**₹30,000 Full-Stack Package**\n\nEverything included:\n✅ Custom Frontend\n✅ Secure Backend\n✅ Admin Panel\n✅ Database\n✅ Payment Gateway (Stripe/Razorpay)\n✅ SEO Setup\n✅ Mobile Responsive\n✅ Server Deployment\n\nWe build for any industry: Food Delivery, Ride Booking, Grocery, E-Commerce, Healthcare, and more.\n\nPrototype in 7 days. Launch in 14–20 days.",
        quickReplies: ["Get Started", "Any Hidden Costs?", "Timeline?", "Talk to Team"],
        priority: 55,
        enabled: true,
    },
    {
        name: "TIMELINE",
        patterns: ["how long", "timeline", "delivery", "deadline", "when", "how fast", "turnaround", "time frame", "duration"],
        response: "📅 **Delivery Timeline:**\n\n• Working prototype: **7 days**\n• Final launch: **14–20 days**\n• Post-launch support: **30 days included**\n\nWe move fast without cutting corners.",
        quickReplies: ["Get a Quote", "What's Included?", "Talk to Team"],
        priority: 50,
        enabled: true,
    },
    {
        name: "TECH_STACK",
        patterns: ["tech", "stack", "technology", "react", "next.js", "node", "framework", "language", "tools", "built with"],
        response: "**Our Tech Stack:**\n\n🖥️ Frontend: Next.js 14, React, Tailwind CSS\n⚙️ Backend: Node.js, Fastify, TypeScript\n📊 Database: PostgreSQL, Prisma ORM\n☁️ Infrastructure: AWS, Vercel, Docker\n🤖 AI: GPT-4, NLP, Voice Synthesis\n\nWe pick the right tool for each project.",
        quickReplies: ["View Services", "Get a Quote", "Talk to Team"],
        priority: 45,
        enabled: true,
    },
    {
        name: "PROCESS",
        patterns: ["process", "how do you work", "workflow", "steps", "methodology", "approach", "how does it work"],
        response: "**How We Work:**\n\n1️⃣ **Discovery** — We understand your business & goals\n2️⃣ **Design** — UI/UX mockups for your approval\n3️⃣ **Build** — Development with weekly progress updates\n4️⃣ **Launch** — Deployment + training on the Admin Panel\n5️⃣ **Support** — 30 days post-launch support included\n\nPrototype ready in 7 days. Final delivery in 14–20 days.",
        quickReplies: ["Get Started", "Pricing?", "Talk to Team"],
        priority: 45,
        enabled: true,
    },
    {
        name: "PORTFOLIO",
        patterns: ["portfolio", "previous work", "examples", "case study", "clients", "projects", "show me", "demo"],
        response: "We've built solutions across multiple industries — from e-commerce platforms to AI-powered CRMs.\n\nFor specific case studies and demos, our team can walk you through relevant examples based on your industry.",
        quickReplies: ["Talk to Team", "View Services", "Get a Quote"],
        priority: 40,
        enabled: true,
    },
    {
        name: "FAQ_TECHNICAL",
        patterns: ["technical", "non-technical", "manage", "code", "coding", "difficult", "complicated", "i don't know tech"],
        response: "The Admin Panel is built for non-technical users — as simple as using Instagram. You can update text, images, and view sales analytics without touching code.",
        quickReplies: ["Works on Mobile?", "Timeline?", "Get a Quote"],
        priority: 35,
        enabled: true,
    },
    {
        name: "FAQ_MOBILE",
        patterns: ["mobile", "phone", "responsive", "iphone", "android", "tablet"],
        response: "Absolutely. 80% of traffic comes from mobile. We build mobile-first, so your app feels native on both iPhone and Android.",
        quickReplies: ["Pricing?", "Timeline?", "Get a Quote"],
        priority: 30,
        enabled: true,
    },
    {
        name: "FAQ_MAINTENANCE",
        patterns: ["maintenance", "support", "after launch", "post launch", "updates", "bugs", "fix"],
        response: "Post-launch support is included for the first 30 days. After that, we offer maintenance plans or you can manage it yourself via the Admin Panel.",
        quickReplies: ["Pricing?", "Get Started", "Talk to Team"],
        priority: 30,
        enabled: true,
    },
];

// ═══════════════════════════════════════════════════════════════
// QUICK REPLY RESOLUTION (maps button labels to intent names)
// ═══════════════════════════════════════════════════════════════

const QUICK_REPLY_MAP: Record<string, string> = {
    "View Our Services": "SERVICES_OVERVIEW",
    "View Services": "SERVICES_OVERVIEW",
    "View Other Services": "SERVICES_OVERVIEW",
    "Get a Quote": "PRICING",
    "Pricing?": "PRICING",
    "Any Hidden Costs?": "PRICING",
    "How It Works": "PROCESS",
    "Talk to Team": "HANDOFF",
    "Get Started": "HANDOFF",
    "Connect me": "HANDOFF",
    "See the ₹30K Offer": "OFFER_DETAILS",
    "What's Included?": "OFFER_DETAILS",
    "Timeline?": "TIMELINE",
    "Web & App Dev": "SERVICE_WEB_DEV",
    "AI Calling": "SERVICE_AI_CALLING",
    "AI Chatbot": "SERVICE_AI_CHATBOX",
    "AI CRM": "SERVICE_AI_CRM",
    "Analytics": "SERVICE_ANALYTICS",
    "Works on Mobile?": "FAQ_MOBILE",
    "See a Demo": "PORTFOLIO",
};

// ═══════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════

let cachedIntents: BotIntent[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function getIntents(prisma: PrismaClient): Promise<BotIntent[]> {
    const now = Date.now();

    if (cachedIntents && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedIntents;
    }

    try {
        const dbIntents = await prisma.botIntent.findMany({
            where: { enabled: true },
            orderBy: { priority: 'desc' },
        });

        if (dbIntents.length > 0) {
            cachedIntents = dbIntents;
            cacheTimestamp = now;
            return cachedIntents;
        }
    } catch {
        // DB error — fall back to defaults
    }

    // Return defaults if DB is empty or errored
    cachedIntents = DEFAULT_INTENTS.filter(i => i.enabled);
    cacheTimestamp = now;
    return cachedIntents;
}

/** Force-clear the cache (called after admin edits an intent) */
export function clearBotCache() {
    cachedIntents = null;
    cacheTimestamp = 0;
}

// ═══════════════════════════════════════════════════════════════
// INTENT DETECTION
// ═══════════════════════════════════════════════════════════════

function detectIntent(msg: string, intents: BotIntent[]): BotIntent | null {
    const lower = msg.toLowerCase().trim();

    for (const intent of intents) {
        // Greeting: only match short messages
        if (intent.name === "GREETING") {
            const words = lower.split(/\s+/);
            if (words.length <= 3 && intent.patterns.some(p => lower.includes(p))) {
                return intent;
            }
            continue;
        }

        if (intent.patterns.some(p => lower.includes(p))) {
            return intent;
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export class BotService {
    /**
     * Analyze a user message and return a structured response.
     * Returns null for file uploads or empty messages.
     */
    static async analyze(userMessage: string, prisma: PrismaClient): Promise<BotResponse | null> {
        if (!userMessage || userMessage.trim().length === 0) return null;
        if (userMessage.startsWith("[FILE]")) return null;

        const msg = userMessage.trim();
        const intents = await getIntents(prisma);

        // Check if it's a quick-reply button click (exact match)
        const intentName = QUICK_REPLY_MAP[msg];
        if (intentName) {
            const intent = intents.find(i => i.name === intentName);
            if (intent) {
                return { message: intent.response, quickReplies: intent.quickReplies };
            }
        }

        // Standard intent detection
        const matchedIntent = detectIntent(msg, intents);
        if (matchedIntent) {
            return { message: matchedIntent.response, quickReplies: matchedIntent.quickReplies };
        }

        // Fallback
        return {
            message: "I can help you with information about our services, pricing, and process. What would you like to know?",
            quickReplies: ["View Our Services", "Get a Quote", "How It Works", "Talk to Team"],
        };
    }

    /** Welcome message for new conversations */
    static getWelcome(): BotResponse {
        return {
            message: "Hi! Welcome to Shotlin 👋\n\nWe build production-grade software for businesses. How can we help you today?",
            quickReplies: ["View Our Services", "Get a Quote", "How It Works", "Talk to Team"],
        };
    }

    /** Get default intents for seeding */
    static getDefaults(): BotIntent[] {
        return DEFAULT_INTENTS;
    }
}
