-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'STARTUP');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'HIDDEN');

-- CreateEnum
CREATE TYPE "DetailState" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SourceState" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "InfoSection" AS ENUM ('BASE_INFO', 'ORGANIZER', 'SOURCE_INFO');

-- CreateEnum
CREATE TYPE "AnnouncementDisplay" AS ENUM ('LIST', 'PINNED', 'MODAL');

-- CreateEnum
CREATE TYPE "ImageOwnerType" AS ENUM ('EVENT_COVER', 'EVENT_BANNER', 'EVENT_DETAIL', 'TICKET', 'ORGANIZER', 'GUEST', 'ANNOUNCEMENT', 'SITE');

-- CreateEnum
CREATE TYPE "ConfigCategory" AS ENUM ('SITE', 'CRAWLER', 'IMAGE', 'CDN', 'NOTIFICATION', 'ANALYTICS', 'RATE_LIMIT', 'MATCHING', 'SECURITY');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'TEXT', 'NUMBER', 'BOOLEAN', 'JSON', 'CRON', 'COLOR', 'DURATION_MS', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "BlockDimension" AS ENUM ('IP', 'VISITOR_HASH', 'USER_AGENT', 'FINGERPRINT');

-- CreateTable
CREATE TABLE "sources" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMPTZ(3),
    "lastOkAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "session" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "source_records" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3),
    "endAt" TIMESTAMPTZ(3),
    "timeLabel" TEXT,
    "province" TEXT,
    "city" TEXT,
    "venueName" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "priceLowCents" INTEGER,
    "priceHighCents" INTEGER,
    "priceLabel" TEXT,
    "saleFlag" TEXT,
    "wishCount" INTEGER,
    "pcTicketUrl" TEXT,
    "mobileTicketUrl" TEXT,
    "description" TEXT,
    "organizerName" TEXT,
    "rawPayload" JSONB,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingStreak" INTEGER NOT NULL DEFAULT 0,
    "removedAt" TIMESTAMPTZ(3),
    "eventId" TEXT,
    "matchScore" DECIMAL(4,3),
    "matchEvidence" JSONB,
    "matchLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_runs" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "markedRemoved" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "trigger" "RunTrigger" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3),
    "timeLabel" TEXT,
    "venueId" TEXT,
    "cityId" TEXT,
    "organizerId" TEXT,
    "priceLowCents" INTEGER,
    "priceHighCents" INTEGER,
    "priceLabel" TEXT,
    "saleFlag" TEXT,
    "wishCount" INTEGER,
    "pcTicketUrl" TEXT,
    "mobileTicketUrl" TEXT,
    "description" TEXT,
    "coverImageId" TEXT,
    "bannerImageId" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "detailState" "DetailState" NOT NULL DEFAULT 'ENABLED',
    "sourceState" "SourceState" NOT NULL DEFAULT 'ACTIVE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "highlightColor" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_dates" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startAt" TIMESTAMPTZ(3),
    "endAt" TIMESTAMPTZ(3),

    CONSTRAINT "event_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "sourceTicketId" TEXT,
    "name" TEXT NOT NULL,
    "screenName" TEXT,
    "priceCents" INTEGER,
    "priceLabel" TEXT,
    "saleFlag" TEXT,
    "saleStartAt" TIMESTAMPTZ(3),
    "saleEndAt" TIMESTAMPTZ(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_info_items" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "section" "InfoSection" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_info_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_guests" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "address" TEXT,
    "cityId" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "region" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_field_origins" (
    "eventId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "sourceKey" TEXT NOT NULL,

    CONSTRAINT "event_field_origins_pkey" PRIMARY KEY ("eventId","fieldName")
);

-- CreateTable
CREATE TABLE "change_notices" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "noticedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMPTZ(3),

    CONSTRAINT "change_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_overrides" (
    "eventId" TEXT NOT NULL,
    "title" TEXT,
    "startAt" TIMESTAMPTZ(3),
    "endAt" TIMESTAMPTZ(3),
    "timeLabel" TEXT,
    "venueName" TEXT,
    "address" TEXT,
    "cityName" TEXT,
    "priceLowCents" INTEGER,
    "priceHighCents" INTEGER,
    "priceLabel" TEXT,
    "description" TEXT,
    "extra" JSONB,
    "editedBy" TEXT,
    "editedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_overrides_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "organizers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "color" TEXT,
    "imageId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" TEXT NOT NULL DEFAULT 'normal',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "event_tags" (
    "eventId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manual" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "event_tags_pkey" PRIMARY KEY ("eventId","tagName")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "display" "AnnouncementDisplay" NOT NULL DEFAULT 'LIST',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT true,
    "year" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "remoteUrl" TEXT,
    "remoteCfUrl" TEXT,
    "remoteEsaUrl" TEXT,
    "uploadedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_refs" (
    "imageId" TEXT NOT NULL,
    "ownerType" "ImageOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_refs_pkey" PRIMARY KEY ("imageId","ownerType","ownerId")
);

-- CreateTable
CREATE TABLE "app_configs" (
    "key" TEXT NOT NULL,
    "category" "ConfigCategory" NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "value" JSONB NOT NULL,
    "defaultValue" JSONB,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "constraints" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresRestart" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMPTZ(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMPTZ(3),
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_blocks" (
    "id" TEXT NOT NULL,
    "dimension" "BlockDimension" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'public',
    "eventId" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "searchEngine" TEXT,
    "visitorHash" TEXT,
    "ipHash" TEXT,
    "visitorSource" TEXT,
    "userAgent" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "securityEvent" TEXT,
    "status" INTEGER,
    "summary" TEXT,
    "requestIp" TEXT,
    "browserIp" TEXT,
    "webRtcIp" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_access_events" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'public',
    "durationMs" INTEGER,
    "requestIp" TEXT,
    "visitorHash" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_rollups" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analytics_daily_rollups_pkey" PRIMARY KEY ("day","metric","dimension")
);

-- CreateTable
CREATE TABLE "ip_geo_cache" (
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "isp" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "lookedUpAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_geo_cache_pkey" PRIMARY KEY ("ip")
);

-- CreateTable
CREATE TABLE "maintenance_runs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "trigger" "RunTrigger" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "affectedRows" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "maintenance_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_records_eventId_idx" ON "source_records"("eventId");

-- CreateIndex
CREATE INDEX "source_records_sourceKey_lastSeenAt_idx" ON "source_records"("sourceKey", "lastSeenAt");

-- CreateIndex
CREATE INDEX "source_records_eventId_sourceKey_idx" ON "source_records"("eventId", "sourceKey");

-- CreateIndex
CREATE INDEX "source_records_startAt_idx" ON "source_records"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "source_records_sourceKey_sourceEventId_key" ON "source_records"("sourceKey", "sourceEventId");

-- CreateIndex
CREATE INDEX "source_runs_sourceKey_startedAt_idx" ON "source_runs"("sourceKey", "startedAt");

-- CreateIndex
CREATE INDEX "events_startAt_idx" ON "events"("startAt");

-- CreateIndex
CREATE INDEX "events_visibility_startAt_idx" ON "events"("visibility", "startAt");

-- CreateIndex
CREATE INDEX "events_cityId_startAt_idx" ON "events"("cityId", "startAt");

-- CreateIndex
CREATE INDEX "events_visibility_sourceState_startAt_idx" ON "events"("visibility", "sourceState", "startAt");

-- CreateIndex
CREATE INDEX "events_featured_startAt_idx" ON "events"("featured", "startAt");

-- CreateIndex
CREATE INDEX "events_priceLowCents_idx" ON "events"("priceLowCents");

-- CreateIndex
CREATE INDEX "event_dates_date_idx" ON "event_dates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "event_dates_eventId_date_key" ON "event_dates"("eventId", "date");

-- CreateIndex
CREATE INDEX "tickets_eventId_sortOrder_idx" ON "tickets"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "event_info_items_eventId_section_sortOrder_idx" ON "event_info_items"("eventId", "section", "sortOrder");

-- CreateIndex
CREATE INDEX "event_guests_eventId_sortOrder_idx" ON "event_guests"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "venues_cityId_idx" ON "venues"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "venues_normalizedName_cityId_key" ON "venues"("normalizedName", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "cities_normalizedName_key" ON "cities"("normalizedName");

-- CreateIndex
CREATE INDEX "cities_province_idx" ON "cities"("province");

-- CreateIndex
CREATE INDEX "cities_region_idx" ON "cities"("region");

-- CreateIndex
CREATE INDEX "event_field_origins_sourceRecordId_idx" ON "event_field_origins"("sourceRecordId");

-- CreateIndex
CREATE INDEX "change_notices_eventId_noticedAt_idx" ON "change_notices"("eventId", "noticedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_name_key" ON "organizers"("name");

-- CreateIndex
CREATE INDEX "event_tags_tagName_idx" ON "event_tags"("tagName");

-- CreateIndex
CREATE INDEX "announcements_publishedAt_idx" ON "announcements"("publishedAt");

-- CreateIndex
CREATE INDEX "holidays_year_idx" ON "holidays"("year");

-- CreateIndex
CREATE UNIQUE INDEX "images_sha256_key" ON "images"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "images_storageKey_key" ON "images"("storageKey");

-- CreateIndex
CREATE INDEX "image_refs_ownerType_ownerId_idx" ON "image_refs"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "app_configs_category_sortOrder_idx" ON "app_configs"("category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "admin_tokens_tokenHash_key" ON "admin_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "client_blocks_enabled_dimension_value_idx" ON "client_blocks"("enabled", "dimension", "value");

-- CreateIndex
CREATE UNIQUE INDEX "client_blocks_dimension_value_key" ON "client_blocks"("dimension", "value");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_type_createdAt_idx" ON "analytics_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_eventId_createdAt_idx" ON "analytics_events"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_searchEngine_createdAt_idx" ON "analytics_events"("searchEngine", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_visitorHash_createdAt_idx" ON "analytics_events"("visitorHash", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_securityEvent_createdAt_idx" ON "analytics_events"("securityEvent", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_access_events_createdAt_idx" ON "analytics_access_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_access_events_path_createdAt_idx" ON "analytics_access_events"("path", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_access_events_status_createdAt_idx" ON "analytics_access_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_access_events_category_createdAt_idx" ON "analytics_access_events"("category", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_daily_rollups_metric_day_idx" ON "analytics_daily_rollups"("metric", "day");

-- CreateIndex
CREATE INDEX "ip_geo_cache_province_idx" ON "ip_geo_cache"("province");

-- CreateIndex
CREATE INDEX "maintenance_runs_kind_startedAt_idx" ON "maintenance_runs"("kind", "startedAt");

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_sourceKey_fkey" FOREIGN KEY ("sourceKey") REFERENCES "sources"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_sourceKey_fkey" FOREIGN KEY ("sourceKey") REFERENCES "sources"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_bannerImageId_fkey" FOREIGN KEY ("bannerImageId") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dates" ADD CONSTRAINT "event_dates_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_info_items" ADD CONSTRAINT "event_info_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_field_origins" ADD CONSTRAINT "event_field_origins_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_field_origins" ADD CONSTRAINT "event_field_origins_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_notices" ADD CONSTRAINT "change_notices_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_notices" ADD CONSTRAINT "change_notices_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_overrides" ADD CONSTRAINT "event_overrides_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_tagName_fkey" FOREIGN KEY ("tagName") REFERENCES "tags"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_refs" ADD CONSTRAINT "image_refs_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
