"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeed = runSeed;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
// ── Plans seed data ──────────────────────────────────────────────────────────
const defaultPlans = [
    {
        name: 'Free',
        slug: 'free',
        description: 'Get started with basic photo sharing for free.',
        tagline: 'Forever Free',
        is_active: true,
        is_featured: false,
        is_custom: false,
        display_order: 1,
        // Storage
        storage_limit_gb: 5,
        max_file_size_mb: 20,
        max_upload_per_month: 100,
        allowed_media_types: ['IMAGE'],
        // Limits
        max_projects: 3,
        max_albums_per_project: 5,
        max_clients_per_project: 2,
        max_selections_per_gallery: 20,
        // Validity
        interval: client_1.PlanInterval.MONTHLY,
        validity_days: null,
        trial_days: 0,
        grace_period_days: 0,
        // Pricing (0 = free)
        price_inr: 0,
        price_usd: 0,
        currency_default: 'INR',
        annual_discount_percent: null,
        // Payment gateway IDs (none for free)
        stripe_price_id: null,
        stripe_product_id: null,
        razorpay_plan_id: null,
        // Feature flags
        allow_password_links: false,
        allow_expiring_links: true,
        allow_private_links: false,
        allow_client_download: false,
        allow_zip_download: false,
        allow_watermark_removal: false,
        watermark_on_preview: true,
        allow_custom_domain: false,
        allow_custom_branding: false,
        allow_white_label: false,
        allow_video_uploads: false,
        allow_video_streaming: false,
        allow_analytics: false,
        allow_webhooks: false,
        allow_api_access: false,
        allow_team_members: 1,
        // Support
        support_level: client_1.SupportLevel.COMMUNITY,
        sla_response_hours: null,
    },
    {
        name: 'Basic',
        slug: 'basic',
        description: 'Perfect for freelance photographers just starting out.',
        tagline: null,
        is_active: true,
        is_featured: false,
        is_custom: false,
        display_order: 2,
        // Storage
        storage_limit_gb: 50,
        max_file_size_mb: 50,
        max_upload_per_month: 1000,
        allowed_media_types: ['IMAGE', 'VIDEO'],
        // Limits
        max_projects: 20,
        max_albums_per_project: 20,
        max_clients_per_project: 10,
        max_selections_per_gallery: 100,
        // Validity
        interval: client_1.PlanInterval.MONTHLY,
        validity_days: 30,
        trial_days: 14,
        grace_period_days: 3,
        // Pricing: ₹999/month
        price_inr: 99900,
        price_usd: 1200,
        currency_default: 'INR',
        annual_discount_percent: 15,
        stripe_price_id: null,
        stripe_product_id: null,
        razorpay_plan_id: null,
        // Feature flags
        allow_password_links: true,
        allow_expiring_links: true,
        allow_private_links: true,
        allow_client_download: false,
        allow_zip_download: true,
        allow_watermark_removal: false,
        watermark_on_preview: true,
        allow_custom_domain: false,
        allow_custom_branding: false,
        allow_white_label: false,
        allow_video_uploads: true,
        allow_video_streaming: false,
        allow_analytics: false,
        allow_webhooks: false,
        allow_api_access: false,
        allow_team_members: 1,
        support_level: client_1.SupportLevel.EMAIL,
        sla_response_hours: 48,
    },
    {
        name: 'Pro',
        slug: 'pro',
        description: 'For professional studios with demanding clients.',
        tagline: 'Most Popular',
        is_active: true,
        is_featured: true,
        is_custom: false,
        display_order: 3,
        // Storage
        storage_limit_gb: 500,
        max_file_size_mb: 200,
        max_upload_per_month: null, // unlimited
        allowed_media_types: ['IMAGE', 'VIDEO'],
        // Limits (null = unlimited)
        max_projects: null,
        max_albums_per_project: null,
        max_clients_per_project: null,
        max_selections_per_gallery: null,
        // Validity
        interval: client_1.PlanInterval.MONTHLY,
        validity_days: 30,
        trial_days: 14,
        grace_period_days: 7,
        // Pricing: ₹2,999/month
        price_inr: 299900,
        price_usd: 3500,
        currency_default: 'INR',
        annual_discount_percent: 20,
        stripe_price_id: null,
        stripe_product_id: null,
        razorpay_plan_id: null,
        // Feature flags
        allow_password_links: true,
        allow_expiring_links: true,
        allow_private_links: true,
        allow_client_download: true,
        allow_zip_download: true,
        allow_watermark_removal: true,
        watermark_on_preview: false,
        allow_custom_domain: false,
        allow_custom_branding: true,
        allow_white_label: false,
        allow_video_uploads: true,
        allow_video_streaming: true,
        allow_analytics: true,
        allow_webhooks: true,
        allow_api_access: false,
        allow_team_members: 5,
        support_level: client_1.SupportLevel.PRIORITY,
        sla_response_hours: 24,
    },
    {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Custom plans for large studios and agencies. Contact us.',
        tagline: 'Custom Pricing',
        is_active: true,
        is_featured: false,
        is_custom: true,
        display_order: 4,
        // Storage: 0 = unlimited
        storage_limit_gb: 0,
        max_file_size_mb: 500,
        max_upload_per_month: null,
        allowed_media_types: ['IMAGE', 'VIDEO'],
        // Limits (null = unlimited)
        max_projects: null,
        max_albums_per_project: null,
        max_clients_per_project: null,
        max_selections_per_gallery: null,
        // Validity
        interval: client_1.PlanInterval.YEARLY,
        validity_days: 365,
        trial_days: 30,
        grace_period_days: 14,
        // Pricing: negotiated (contact sales)
        price_inr: 0,
        price_usd: 0,
        currency_default: 'INR',
        annual_discount_percent: null,
        stripe_price_id: null,
        stripe_product_id: null,
        razorpay_plan_id: null,
        // Feature flags — all enabled
        allow_password_links: true,
        allow_expiring_links: true,
        allow_private_links: true,
        allow_client_download: true,
        allow_zip_download: true,
        allow_watermark_removal: true,
        watermark_on_preview: false,
        allow_custom_domain: true,
        allow_custom_branding: true,
        allow_white_label: true,
        allow_video_uploads: true,
        allow_video_streaming: true,
        allow_analytics: true,
        allow_webhooks: true,
        allow_api_access: true,
        allow_team_members: 25,
        support_level: client_1.SupportLevel.DEDICATED,
        sla_response_hours: 4,
    },
];
// ── Seed function (idempotent) ───────────────────────────────────────────────
async function runSeed() {
    // 1. Upsert plans
    for (const plan of defaultPlans) {
        await prisma.plan.upsert({
            where: { slug: plan.slug },
            update: {
                name: plan.name,
                description: plan.description,
                tagline: plan.tagline,
                is_active: plan.is_active,
                is_featured: plan.is_featured,
                storage_limit_gb: plan.storage_limit_gb,
                max_file_size_mb: plan.max_file_size_mb,
                price_inr: plan.price_inr,
                price_usd: plan.price_usd,
                // Feature flags
                allow_password_links: plan.allow_password_links,
                allow_zip_download: plan.allow_zip_download,
                allow_video_uploads: plan.allow_video_uploads,
                allow_watermark_removal: plan.allow_watermark_removal,
                allow_custom_domain: plan.allow_custom_domain,
                allow_custom_branding: plan.allow_custom_branding,
                allow_white_label: plan.allow_white_label,
                allow_analytics: plan.allow_analytics,
                allow_webhooks: plan.allow_webhooks,
                allow_api_access: plan.allow_api_access,
                allow_team_members: plan.allow_team_members,
                support_level: plan.support_level,
                sla_response_hours: plan.sla_response_hours,
            },
            create: plan,
        });
    }
    console.log(`✅  Seeded ${defaultPlans.length} plans`);
    // 2. Seed default admin
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@photoselect.app';
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
    const adminName = process.env.ADMIN_NAME ?? 'Super Admin';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
        const hashedPassword = await bcryptjs_1.default.hash(adminPassword, 12);
        const admin = await prisma.user.create({
            data: {
                email: adminEmail,
                password_hash: hashedPassword,
                full_name: adminName,
                role: client_1.Role.ADMIN,
                is_email_verified: true,
                is_active: true,
            },
        });
        // Admin doesn't need a subscription but needs storage_usage row
        await prisma.storageUsage.create({
            data: {
                user_id: admin.id,
                storage_limit: BigInt(0), // unlimited for admin
            },
        });
        console.log(`✅  Admin created: ${adminEmail}`);
    }
    else {
        console.log(`ℹ️   Admin already exists: ${adminEmail}`);
    }
    // 3. Seed demo photographer
    const demoEmail = 'demo@photoselect.app';
    const demoPassword = 'Demo@123456';
    const existingDemo = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (!existingDemo) {
        const hashedPassword = await bcryptjs_1.default.hash(demoPassword, 12);
        const proPlan = await prisma.plan.findUnique({ where: { slug: 'pro' } });
        const demo = await prisma.user.create({
            data: {
                email: demoEmail,
                password_hash: hashedPassword,
                full_name: 'Demo Photographer',
                role: client_1.Role.PHOTOGRAPHER,
                is_email_verified: true,
                is_active: true,
            },
        });
        const storageLimit = BigInt((proPlan?.storage_limit_gb ?? 500) * 1024 * 1024 * 1024);
        await prisma.storageUsage.create({
            data: { user_id: demo.id, storage_limit: storageLimit },
        });
        if (proPlan) {
            const now = new Date();
            const expiry = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
            await prisma.subscription.create({
                data: {
                    user_id: demo.id,
                    plan_id: proPlan.id,
                    status: 'ACTIVE',
                    interval: proPlan.interval,
                    current_period_start: now,
                    current_period_end: expiry,
                },
            });
        }
        console.log(`✅  Demo photographer created: ${demoEmail}`);
    }
    else {
        console.log(`ℹ️   Demo photographer already exists: ${demoEmail}`);
    }
}
// ── Run directly (npm run seed) ──────────────────────────────────────────────
async function main() {
    try {
        await runSeed();
        console.log('✅  Seed complete');
    }
    catch (error) {
        console.error('❌  Seed failed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=seed.js.map