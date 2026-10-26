import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})
export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => [index('session_user_idx').on(table.userId)],
)
export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('account_user_idx').on(table.userId)],
)
export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
})
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const fileAssets = sqliteTable(
  'file_asset',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    objectKey: text('object_key').notNull().unique(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    state: text('state', { enum: ['pending', 'ready', 'deleting'] }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('file_asset_owner_idx').on(table.userId, table.state)],
)

export const projects = sqliteTable(
  'project',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    coverAssetId: text('cover_asset_id').references(() => fileAssets.id, { onDelete: 'set null' }),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['idea', 'building', 'live'] })
      .notNull()
      .default('idea'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('project_user_idx').on(table.userId, table.createdAt)],
)
export const adminUsers = sqliteTable('admin_user', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
})
export const devMail = sqliteTable('dev_mail', {
  id: text('id').primaryKey(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  url: text('url').notNull(),
  createdAt: integer('created_at').notNull(),
})
export const subscriptions = sqliteTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull().default('stripe'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull(),
    status: text('status').notNull(),
    priceId: text('price_id').notNull(),
    currentPeriodEnd: integer('current_period_end').notNull().default(0),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' })
      .notNull()
      .default(false),
    revision: integer('revision').notNull().default(0),
    syncId: text('sync_id').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('subscription_user_idx').on(table.userId)],
)
export const billingEvents = sqliteTable('billing_event', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: integer('processed_at').notNull(),
})
export const checkouts = sqliteTable('checkout', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().default('stripe'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull(),
})

// No user FK: closed accounts retain only pseudonymous provider reconciliation records.
export const billingAccountState = sqliteTable('billing_account_state', {
  userId: text('user_id').primaryKey(),
  lockId: text('lock_id'),
  lockUntil: integer('lock_until').notNull().default(0),
  closedAt: integer('closed_at'),
})
export const archivedSubscriptions = sqliteTable(
  'billing_subscription_archive',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull().default('stripe'),
    ownerRef: text('owner_ref').notNull(),
    customerId: text('customer_id').notNull(),
    status: text('status').notNull(),
    priceId: text('price_id').notNull(),
    currentPeriodEnd: integer('current_period_end').notNull(),
    cancelAtPeriodEnd: integer('cancel_at_period_end').notNull(),
    revision: integer('revision').notNull(),
    syncId: text('sync_id').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at').notNull(),
  },
  (table) => [index('billing_archive_owner_idx').on(table.ownerRef)],
)
export const archivedCheckouts = sqliteTable(
  'billing_checkout_archive',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull().default('stripe'),
    ownerRef: text('owner_ref').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
    archivedAt: integer('archived_at').notNull(),
  },
  (table) => [index('checkout_archive_owner_idx').on(table.ownerRef)],
)

// Per-recipient resend cooldown; hashed keys avoid storing another copy of email addresses.
export const verificationResends = sqliteTable('verification_resend', {
  recipientHash: text('recipient_hash').primaryKey(),
  requestId: text('request_id').notNull(),
  nextAt: integer('next_at').notNull(),
})

export const apiRateLimits = sqliteTable(
  'api_rate_limit',
  {
    id: text('id').primaryKey(),
    hits: integer('hits').notNull(),
    resetAt: integer('reset_at').notNull(),
  },
  (table) => [index('api_rate_limit_reset_idx').on(table.resetAt)],
)

// Editorial records belong to the site. Removing a contributor does not delete public site content.
export const contentAssets = sqliteTable('content_asset', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull().unique(),
  name: text('name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  state: text('state', { enum: ['pending', 'ready', 'deleting'] }).notNull(),
  uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
})
export const contentEntries = sqliteTable(
  'content_entry',
  {
    id: text('id').primaryKey(),
    draft: text('draft').notNull(),
    coverAssetId: text('cover_asset_id').references(() => contentAssets.id, {
      onDelete: 'restrict',
    }),
    live: text('live'),
    liveCoverAssetId: text('live_cover_asset_id').references(() => contentAssets.id, {
      onDelete: 'restrict',
    }),
    liveSlug: text('live_slug'),
    liveLocale: text('live_locale'),
    publishedAt: integer('published_at'),
    revision: integer('revision').notNull().default(1),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('content_live_path_unique').on(table.liveLocale, table.liveSlug)],
)

export const accountAccess = sqliteTable('account_access', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  disabledAt: integer('disabled_at'),
  revision: integer('revision').notNull().default(0),
  operationId: text('operation_id'),
  updatedAt: integer('updated_at').notNull(),
})
export const adminAudit = sqliteTable(
  'admin_audit',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    targetId: text('target_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    source: text('source').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('admin_audit_created_idx').on(table.createdAt),
    index('admin_audit_target_idx').on(table.targetId, table.createdAt),
  ],
)
