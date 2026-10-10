# PROJECT: AI INVENTORY & ORDER MANAGEMENT PLATFORM

## 1. PROJECT OBJECTIVE

Build a complete, production-oriented Inventory, Product, Customer, and Manual Order Management System that can be deployed on Vercel using free-tier services wherever practical.

The application must provide two complete interfaces:

1. A responsive web dashboard for humans to manage products, stock, customers, orders, packing, shipping, payments, and reports.
2. A secure remote Model Context Protocol (MCP) server that allows compatible AI assistants to access and manage the same application through authenticated tools.

The MCP server must expose all appropriate website operations through real, functional tools.

Users must be able to interact with the application manually or through an authorized AI assistant.

Examples of natural-language requests the AI must support:

- "Show me all orders waiting to be packed."
- "Find products with fewer than 10 units in stock."
- "Create an order for five units of SKU PRD001."
- "Mark order ORD-1001 as packed."
- "Show orders that are packed but not shipped."
- "Record a payment of ₹1,500 against order ORD-1001."
- "Generate a monthly inventory report."
- "Show all unpaid orders."
- "Export this month's delivered orders."

The application must retrieve and modify real database records. Do not implement mock operations, fake reports, hardcoded statistics, or simulated MCP tools.

## 2. DEPLOYMENT CONSTRAINTS

The primary deployment target is Vercel.

The application must be designed around serverless execution and support deployment using a GitHub repository connected to Vercel.

Do not require:
- A permanently running Node.js server.
- A local SQLite database stored on the deployment filesystem.
- Docker running in production.
- A VPS for the core application.
- A paid service as an unavoidable prerequisite.

Prefer free-tier-compatible services, while documenting their limitations.

Recommended architecture:

- Frontend and API: Next.js with TypeScript.
- Deployment: Vercel.
- Database: Neon PostgreSQL or another compatible managed PostgreSQL provider with a suitable free tier.
- Database ORM: Prisma or Drizzle ORM.
- Authentication: Auth.js for website users.
- MCP protocol: Official TypeScript MCP SDK.
- MCP transport: Streamable HTTP.
- Remote MCP authentication: OAuth 2.1-compatible authorization server.
- Validation: Zod.
- Styling: Tailwind CSS and shadcn/ui.
- Charts: Recharts.
- Forms: React Hook Form.
- Testing: Vitest and Playwright.

Verify the current SDK, Next.js, ORM, database, and Vercel compatibility before implementation.

Pin dependency versions and commit the package lockfile.

Do not use deprecated MCP transports or invent a proprietary MCP protocol.

## 3. APPLICATION ARCHITECTURE

Implement the following architecture:

AI ASSISTANT
    |
    | OAuth 2.1 authorization
    |
    | MCP over Streamable HTTP
    v
VERCEL MCP ENDPOINT
    |
    v
AUTHORIZATION AND PERMISSION CHECKS
    |
    v
SHARED BUSINESS LOGIC
    |
    v
POSTGRESQL DATABASE

The human-facing dashboard must use the same business logic and database.

Use a modular architecture:

- app/ — Next.js pages and layouts.
- app/api/ — REST endpoints.
- app/api/mcp/route.ts — remote MCP endpoint.
- app/api/auth/ — website authentication.
- app/api/oauth/ — OAuth endpoints when implementing the authorization server.
- lib/db/ — database client and queries.
- lib/auth/ — website authentication and OAuth utilities.
- lib/mcp/ — MCP server setup and tool registration.
- lib/services/ — business logic.
- lib/permissions/ — authorization policies.
- lib/validation/ — Zod schemas.
- lib/audit/ — audit logging.
- lib/reports/ — report generation.
- components/ — reusable UI.
- prisma/ or drizzle/ — schema and migrations.
- tests/ — unit, integration, security, and end-to-end tests.

Keep MCP tool handlers thin. They must invoke the same validated business services used by the web dashboard.

Never let the AI bypass business logic by directly executing unrestricted SQL.

## 4. MULTI-USER AND TENANT MODEL

Build the system with workspace support so multiple businesses can use separate accounts without seeing one another's data.

Entities:
- User.
- Workspace.
- Workspace membership.
- Role.
- OAuth application.
- OAuth grant.
- OAuth access token or token record.
- Product.
- Category.
- Customer.
- Inventory transaction.
- Order.
- Order item.
- Order status history.
- Shipment.
- Payment.
- Return.
- Return item.
- Audit event.
- Idempotency record.
- Workspace settings.

Every business record must belong to a workspace.

Enforce workspace isolation at the service and database-query levels.

Never trust a workspace ID supplied by an AI tool argument. Derive the authorized workspace from the authenticated principal and verify membership before accessing data.

Where appropriate, use PostgreSQL row-level security as an additional protection layer.

## 5. WEBSITE AUTHENTICATION

Create a secure authentication system.

Features:
- Registration.
- Login.
- Logout.
- Email verification.
- Password reset.
- Session management.
- Workspace creation.
- Workspace invitation.
- Account settings.
- Profile settings.
- Optional multi-factor authentication if supported by the chosen implementation.

Use secure password hashing through the selected authentication library.

Never store plaintext passwords.

Protect state-changing operations against CSRF where applicable.

Validate sessions and permissions on the server.

Do not rely on client-side authorization.

Implement rate limiting for authentication and other sensitive endpoints using a suitable shared storage service or managed provider.

## 6. USER ROLES

Implement the following roles:

OWNER:
- Full workspace administration.
- Manage users and roles.
- Read and write all business records.
- Configure integrations and permissions.
- View audit logs.

ADMIN:
- Manage products, inventory, customers, orders, payments, and returns.
- Access reports.
- Manage day-to-day business operations.

INVENTORY_MANAGER:
- Read products and inventory.
- Receive stock.
- Adjust inventory if authorized.
- View inventory reports.

ORDER_MANAGER:
- Manage customers and orders.
- Confirm and process orders.
- Manage packing and shipping.

PACKER:
- Read the packing queue.
- View packing details.
- Mark eligible orders as packed.

VIEWER:
- Read-only access to explicitly permitted records.

Apply equivalent permission checks to website actions and MCP tools.

## 7. DASHBOARD

Create a polished, responsive dashboard with a collapsible sidebar.

Navigation:
- Dashboard.
- Products.
- Categories.
- Inventory.
- Customers.
- Orders.
- Packing.
- Shipping.
- Payments.
- Returns.
- Reports.
- AI Activity.
- MCP Connections.
- Team.
- Settings.

Display:
- Total products.
- Physical stock.
- Reserved stock.
- Available stock.
- Low-stock products.
- Out-of-stock products.
- Total orders.
- New orders.
- Orders to pack.
- Packed orders awaiting dispatch.
- Shipped orders.
- Delivered orders.
- Cancelled orders.
- Unpaid orders.
- Outstanding payment balances.

Add:
- Recent orders.
- Order status distribution.
- Sales charts.
- Inventory alerts.
- Packing queue preview.
- Shipping queue preview.
- Recent AI actions.

Use real database aggregates.

Do not treat order value as equivalent to cash collected.

Provide date filters for dashboard analytics.

## 8. PRODUCT MANAGEMENT

Implement complete product CRUD.

Product fields:
- Internal ID.
- Name.
- SKU.
- Optional barcode.
- Description.
- Category.
- Optional image.
- Purchase cost.
- Selling price.
- Physical stock.
- Reserved stock.
- Reorder threshold.
- Active or archived state.
- Created timestamp.
- Updated timestamp.

Features:
- Add products.
- Edit products.
- View product details.
- Archive products.
- Search by name or SKU.
- Filter by category.
- Sort by price and stock.
- Paginate results.
- Identify duplicate SKUs.
- Display low-stock alerts.
- Display stock movement history.

Use unique SKU constraints within each workspace.

Use object storage for images if necessary. Do not assume files written to Vercel's filesystem persist across executions.

## 9. CATEGORY MANAGEMENT

Allow authorized users to:
- Create categories.
- Edit categories.
- View products within a category.
- Archive categories.
- Prevent invalid category deletion.

Categories must be workspace-scoped.

## 10. INVENTORY MANAGEMENT

Track physical stock, reserved stock, and available stock separately.

Formula:

Available Stock = Physical Stock - Reserved Stock

Create an inventory ledger that records every stock movement.

Transaction types:
- Opening stock.
- Stock received.
- Manual adjustment.
- Stock reserved.
- Reservation released.
- Order dispatched.
- Return received.
- Return approved for resale.
- Damaged goods.
- Stock correction.

Every inventory change must include:
- Product.
- Quantity change.
- Previous quantity.
- New quantity.
- Transaction type.
- Reason.
- Related order, where applicable.
- Authenticated actor.
- Timestamp.

Use PostgreSQL transactions and appropriate row locks to prevent overselling.

Prevent negative available inventory unless a specifically authorized exception policy exists.

Manual adjustments must require a reason.

Do not permit direct stock editing that bypasses the ledger.

### Reservation policy

When an eligible order is created, reserve its required quantities.

When an order is cancelled, release reservations.

When an order is shipped, decrease physical stock and release its reservation atomically.

When an order is returned, record the returned quantity separately. Restore sellable inventory only after inspection and approval.

Make all inventory changes idempotent where appropriate.

## 11. CUSTOMER MANAGEMENT

Implement customer CRUD.

Fields:
- Name.
- Phone.
- Email.
- Shipping addresses.
- Optional notes.
- Created timestamp.

Features:
- Search customers.
- View customer order history.
- Create customers while creating orders.
- Update contact information.
- Avoid accidental duplicate customers.

Treat customer information as sensitive data.

Return only necessary customer fields to MCP tools.

Do not expose customer information across workspaces.

## 12. MANUAL ORDER MANAGEMENT

Orders are entered manually by the user.

Do not require an online storefront.

Add an order form with:
- Customer selection.
- Customer creation.
- Shipping address.
- Order source.
- Multiple order items.
- Product SKU selection.
- Quantity.
- Unit price.
- Item discount.
- Order discount.
- Shipping fee.
- Payment method.
- Payment status.
- Notes.
- Order date.

Order sources:
- WhatsApp.
- Phone.
- Instagram.
- Facebook.
- Website.
- Walk-in.
- Other.

Automatically generate a unique order number.

Example:
ORD-2026-000001

Generate numbers safely under concurrent requests.

Calculate totals on the server.

Formula:

Subtotal = Sum of all line totals

Order Total = Subtotal - Order Discount + Shipping Fee

Use DECIMAL or an equivalent exact monetary representation. Avoid floating-point calculations for currency.

Store historical product names, SKUs, and unit prices on order items.

Changing the product price later must not modify historical order totals.

Validate stock availability when reserving inventory.

Prevent duplicate orders on retries using idempotency keys.

## 13. ORDER STATUS MANAGEMENT

Implement these statuses:

- NEW.
- CONFIRMED.
- PROCESSING.
- PACKED.
- SHIPPED.
- DELIVERED.
- CANCELLED.
- RETURNED.

Provide status badges and quick-action buttons.

Implement server-side transition validation.

Record every status change in an immutable status history table.

History fields:
- Order.
- Previous status.
- New status.
- Actor.
- Timestamp.
- Optional note.
- Operation source: web or MCP.

Exceptional status corrections must require authorization and a reason.

Cancelled orders must release reservations.

Shipped orders must have appropriate shipping information.

Delivered orders must not automatically become paid.

## 14. PACKING MANAGEMENT

Create a packing page with:
- Orders ready for packing.
- Customer name.
- Order number.
- Order date.
- Item count.
- Total quantity.
- Current status.

Features:
- Open packing details.
- Print packing slip.
- Mark as packed.
- Add packing notes.
- Search and filter.
- View status history.

Packing slips must include:
- Order number.
- Customer shipping address.
- Product names.
- SKUs.
- Quantities.
- Packing notes.

Do not include payment credentials or unnecessary sensitive information.

## 15. SHIPPING MANAGEMENT

Create a shipping page with:
- Packed orders awaiting dispatch.
- Shipped orders.
- Customer.
- Courier.
- Tracking number.
- Shipping date.
- Expected delivery date.
- Current status.

Allow manual shipping details.

When marking an order as shipped:
1. Verify authorization.
2. Verify the current order status.
3. Validate shipping information.
4. Update physical stock.
5. Release reserved stock.
6. Create inventory ledger records.
7. Create shipment records.
8. Update order status.
9. Create status history.
10. Commit the database transaction.

If any operation fails, roll back all related database changes.

Do not claim real courier tracking or automatic delivery detection without a genuine courier integration.

## 16. PAYMENT MANAGEMENT

Payment statuses:
- UNPAID.
- PARTIALLY_PAID.
- PAID.
- REFUNDED.

Payment methods:
- Cash.
- Cash on Delivery.
- UPI.
- Bank transfer.
- Other.

Support:
- Recording payments.
- Partial payments.
- Payment references.
- Payment dates.
- Outstanding balances.
- Payment history.
- Refund records.

Validate amounts on the server.

Use idempotency protections against duplicate payment records.

Do not store UPI PINs, card CVVs, banking passwords, or payment credentials.

A delivered order must not automatically become paid.

## 17. RETURNS MANAGEMENT

Allow authorized users to:
- Register returns.
- Record returned quantities.
- Add return reasons.
- Review returned items.
- Approve returns.
- Reject returns.
- Mark items as damaged or sellable.
- Record refunds where appropriate.

Returned items must not automatically become available stock until approved for resale.

Use transactions for return approval and inventory changes.

## 18. REPORTING

Implement reports for:
- Daily orders.
- Monthly orders.
- Sales by date.
- Best-selling products.
- Low-stock inventory.
- Out-of-stock products.
- Inventory movement.
- Cancelled orders.
- Returned orders.
- Unpaid orders.
- Partial payments.
- Payment collections.
- Inventory valuation.

Allow filters by:
- Date range.
- Product.
- Category.
- Order status.
- Payment status.
- Order source.

Provide CSV export.

Use consistent definitions for gross order value, sales, payments received, refunds, and net revenue.

Do not expose unrestricted database queries through an AI report tool.

## 19. MCP SERVER IMPLEMENTATION

Implement a real remote MCP server using the official TypeScript MCP SDK.

Endpoint:

POST /api/mcp

Support the current Streamable HTTP MCP transport and its associated protocol requirements.

Implement:
- MCP initialization.
- Tool discovery.
- Tool execution.
- Protocol-compatible responses.
- Request validation.
- Authentication.
- Authorization.
- Error handling.
- Audit logging.
- Safe request handling.

The implementation must be compatible with Vercel's serverless execution model.

Do not rely on process-local memory for durable sessions, OAuth state, locks, or idempotency.

Persist required state in PostgreSQL or an appropriate managed store.

Handle initialization and subsequent requests according to the selected SDK's Streamable HTTP implementation.

If the chosen MCP transport implementation requires a session, support it correctly using an appropriate durable strategy, or use a supported stateless configuration where valid.

Do not create a custom protocol and label it MCP.

Verify all endpoints and transport behavior with an actual MCP client.

## 20. MCP TOOL REGISTRY

Register every tool through a central registry with:
- Name.
- Description.
- Zod input schema.
- Output schema.
- Required permission.
- Risk classification.
- Audit policy.
- Confirmation requirements.
- Idempotency policy.

Expose the following tools.

### Dashboard and search

- get_dashboard_summary
- get_business_overview
- search_business_records
- get_recent_activity
- get_low_stock_products
- get_out_of_stock_products

### Products

- list_products
- search_products
- get_product
- create_product
- update_product
- archive_product
- list_categories
- create_category
- update_category

### Inventory

- get_inventory_summary
- get_product_stock
- get_available_stock
- get_reserved_stock
- list_inventory_transactions
- adjust_inventory
- receive_inventory
- get_low_stock_report
- get_inventory_valuation

### Customers

- list_customers
- search_customers
- get_customer
- create_customer
- update_customer
- get_customer_order_history

### Orders

- list_orders
- search_orders
- get_order
- create_order
- update_order
- get_order_items
- get_order_history
- add_order_note
- confirm_order
- process_order
- cancel_order

### Packing

- list_orders_to_pack
- get_packing_queue
- get_packing_details
- get_packing_slip
- mark_order_packed

### Shipping

- list_orders_to_ship
- get_shipping_queue
- get_shipped_orders
- get_shipment_details
- update_shipping_details
- mark_order_shipped
- mark_order_delivered

### Payments

- list_payments
- get_order_payment_status
- record_payment
- get_unpaid_orders
- get_partial_payment_orders
- get_payment_summary

### Returns

- list_returns
- get_return_details
- register_return
- approve_return
- reject_return

### Reports

- get_sales_report
- get_order_report
- get_inventory_report
- get_product_performance
- get_payment_report
- get_cancellation_report
- get_return_report
- export_report_csv

Implement all listed tools.

Do not create placeholder tool handlers.

Each tool must invoke a real service and return the resulting data or a structured error.

## 21. MCP RESOURCES

Provide read-only resources where useful:

- inventory://summary
- inventory://low-stock
- inventory://out-of-stock
- orders://recent
- orders://pending
- orders://packing-queue
- orders://shipping-queue
- reports://dashboard

Provide resource templates for individual products and orders when supported by the chosen SDK.

Apply authentication and workspace isolation to resource reads.

Do not treat resources as an authorization bypass.

## 22. MCP PROMPTS

Register useful prompts:

- daily_business_summary
- prepare_packing_list
- identify_low_stock
- review_pending_orders
- audit_inventory_changes
- review_unpaid_orders
- analyze_monthly_sales

Prompts should guide the AI to retrieve the required data and produce clear summaries.

Read-only prompts must not change business data.

## 23. OAUTH 2.1 FOR MCP

Implement a standards-based authorization system for remote MCP connections.

IMPORTANT: Do not confuse website login with MCP OAuth authorization.

Website authentication and remote MCP client authorization have separate responsibilities.

Support the relevant MCP authorization requirements, including OAuth 2.1 principles and protected-resource metadata where required by the protocol.

Use an established OAuth authorization server library or a compatible managed authorization provider where possible.

Do not invent an incomplete authorization protocol.

### Required OAuth capabilities

- Authorization Code flow.
- PKCE using S256.
- Client registration appropriate to the supported MCP clients.
- Authorization endpoint.
- Token endpoint.
- Token refresh where supported.
- Token revocation.
- Protected resource metadata.
- Authorization server metadata.
- Resource and audience validation.
- Scope validation.
- Expiry validation.
- Secure state validation.
- Secure redirect URI validation.
- Secure token storage.
- Account and workspace consent.
- Grant revocation.

Do not use the Resource Owner Password Credentials grant.

Do not rely on a client secret embedded in a public browser application.

Support dynamically registered MCP clients if required by the selected clients and authorization design. Apply validation, quotas, and abuse protections.

### OAuth endpoints

Implement or integrate the endpoints required by the selected OAuth provider, potentially including:

- /.well-known/oauth-protected-resource
- /.well-known/oauth-authorization-server
- /api/oauth/authorize
- /api/oauth/token
- /api/oauth/register
- /api/oauth/revoke

Use the exact discovery paths, response formats, and protocol behavior required by the selected MCP and OAuth implementations.

Do not expose discovery metadata that advertises endpoints that do not actually work.

If using an external authorization server, document its metadata URLs and integration rather than implementing duplicate endpoints unnecessarily.

### MCP scopes

Implement granular scopes:

- dashboard:read
- products:read
- products:write
- inventory:read
- inventory:write
- customers:read
- customers:write
- orders:read
- orders:create
- orders:update
- orders:cancel
- packing:read
- packing:write
- shipping:read
- shipping:write
- payments:read
- payments:write
- returns:read
- returns:write
- reports:read
- reports:export
- audit:read

The OAuth consent screen must show:
- Application requesting access.
- Workspace being accessed.
- Requested scopes.
- Whether the requested access includes data modification.
- Approval and rejection buttons.

Allow users to revoke grants from the MCP Connections page.

### Token security

Validate the token on every MCP request.

Check:
- Signature or token introspection.
- Issuer.
- Audience.
- Expiry.
- Granted scopes.
- Workspace membership.
- Resource ownership.

Use short-lived access tokens.

Keep refresh tokens secure and support rotation where appropriate.

Never accept a token intended for a different API audience.

Never log access tokens, refresh tokens, or authorization codes.

## 24. AI CONNECTION MANAGEMENT

Create an MCP Connections page.

Display:
- MCP endpoint.
- Connection instructions.
- OAuth authorization status.
- Authorized clients.
- Granted scopes.
- Last-used timestamp.
- Revocation controls.
- Recent tool activity.

Allow the workspace owner to revoke a client grant immediately.

Provide a copyable connection endpoint and setup instructions.

Do not display client secrets or long-lived access tokens.

Only show endpoint and authorization configuration values that are safe to share.

## 25. CONFIRMATION POLICY FOR AI WRITES

Implement risk-aware confirmation.

Read operations:
- May run immediately when authorized.

Routine modifications:
- Require appropriate scope.
- Require clear user intent.
- Record audit events.

High-impact operations:
- Creating orders that reserve stock.
- Inventory adjustments.
- Cancelling confirmed orders.
- Shipping orders.
- Recording payments.
- Approving returns.
- Exporting sensitive customer information.

Require an explicit confirmation according to the configured policy.

A confirmation must identify:
- The requested operation.
- The target record.
- Important quantities or monetary values.
- The consequences.

Bind the confirmation to the exact operation and input parameters. If parameters change, require a new confirmation.

Where MCP clients support structured confirmation workflows, use them. Otherwise, implement a server-side pending-action mechanism with a secure approval interface in the website.

Do not assume that merely registering a tool makes every operation safe.

Never rely solely on the model to enforce business permissions.

## 26. MCP AUDIT LOGGING

Log every MCP write operation.

Record:
- Request ID.
- Authenticated user or client.
- Workspace.
- Tool name.
- Target record.
- Operation.
- Timestamp.
- Outcome.
- Relevant before-and-after values.
- Idempotency key.
- Confirmation reference.

Avoid logging secrets and unnecessary personal data.

Create an AI Activity page with:
- Successful operations.
- Failed operations.
- Tool calls.
- Actor.
- Target record.
- Date and time.
- Confirmation status.

Provide filters by operation, user, date, and result.

## 27. MCP ERROR HANDLING

Use consistent structured errors.

Examples:
- UNAUTHORIZED.
- FORBIDDEN.
- INVALID_INPUT.
- NOT_FOUND.
- INSUFFICIENT_STOCK.
- INVALID_STATUS_TRANSITION.
- DUPLICATE_REQUEST.
- CONFIRMATION_REQUIRED.
- RATE_LIMITED.
- INTERNAL_ERROR.

Return useful error messages without revealing internal implementation details.

Do not report an operation as successful unless the database transaction committed successfully.

## 28. SECURITY REQUIREMENTS

Implement:
- HTTPS in production.
- Strict OAuth validation.
- Server-side permission checks.
- Workspace isolation.
- Input validation.
- Output escaping.
- CSRF protections where applicable.
- Rate limiting.
- Safe CORS policy.
- Request size limits.
- Secure cookie configuration.
- Secret management.
- Database transactions.
- Idempotency protection.
- Audit logging.
- SQL injection prevention.
- Protection against cross-workspace access.
- Protection against mass assignment.
- Protection against replayed write requests.

Treat product descriptions, order notes, uploaded files, and customer messages as untrusted data.

Never execute instructions embedded in stored business data.

Do not expose arbitrary SQL execution, unrestricted database queries, shell access, or filesystem access through MCP.

Do not expose administrative secrets to the model.

## 29. VERCEL CONFIGURATION

Create a deployment-ready repository.

Include:
- package.json.
- Package lockfile.
- TypeScript configuration.
- Next.js configuration.
- Database schema and migrations.
- .env.example.
- README.md.
- Vercel deployment instructions.
- Automated tests.
- GitHub Actions checks if appropriate.

Use Vercel environment variables for production secrets.

Example environment variables:

DATABASE_URL=
AUTH_SECRET=
AUTH_URL=
OAUTH_ISSUER_URL=
OAUTH_CLIENT_CONFIGURATION=
MCP_SERVER_URL=
APP_BASE_URL=
RATE_LIMIT_STORE_URL=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=

Only include variables required by the selected implementation.

Do not commit real credentials.

Do not invent OAuth issuer URLs or claim that a provider has been configured when it has not.

If using an external OAuth provider, document its required configuration.

Use Vercel's supported Node.js runtime and compatible request handlers.

Ensure the MCP endpoint does not depend on unsupported persistent server processes.

Keep database connections compatible with serverless deployments by using the provider's recommended pooled connection or serverless driver.

Use a persistent managed database rather than Vercel's temporary filesystem.

Do not require Redis unless a feature genuinely needs it and a suitable provider is configured.

## 30. FREE-TIER DEPLOYMENT

Design for the following deployment workflow:

1. Create the GitHub repository.
2. Add the project files.
3. Create a managed PostgreSQL database.
4. Apply database migrations.
5. Configure authentication and OAuth settings.
6. Configure Vercel environment variables.
7. Import the GitHub repository into Vercel.
8. Deploy the application.
9. Test website authentication.
10. Test database persistence.
11. Test MCP discovery.
12. Test OAuth authorization.
13. Connect a compatible MCP client.
14. Run read-only tool tests.
15. Test authorized write operations.

Document the free-tier limits of each chosen provider.

Do not assume that free tiers include unlimited database storage, unlimited executions, unlimited OAuth users, permanent inactivity-free databases, or unrestricted bandwidth.

Provide a low-cost upgrade path if the application outgrows free limits.

## 31. TESTING REQUIREMENTS

Implement automated tests for:

Website:
- Registration and login.
- Product creation.
- Product modification.
- Stock adjustments.
- Order creation.
- Order editing.
- Order cancellation.
- Packing.
- Shipping.
- Delivery.
- Payment recording.
- Returns.
- Reports.

MCP:
- Tool discovery.
- Tool input validation.
- Tool output validation.
- OAuth authorization.
- Invalid token rejection.
- Expired token rejection.
- Incorrect audience rejection.
- Missing scope rejection.
- Workspace isolation.
- Tool error handling.
- Confirmation enforcement.
- Audit logging.
- Idempotency.

Inventory:
- Concurrent stock reservations.
- Insufficient stock rejection.
- Reservation release.
- Shipment transactions.
- Return approval.
- Prevention of duplicate stock movements.

OAuth:
- PKCE validation.
- Redirect URI validation.
- State validation.
- Token expiration.
- Token revocation.
- Scope enforcement.
- Consent handling.

End-to-end test:

Create product
→ Receive stock
→ Create customer
→ Create order through MCP
→ Reserve stock
→ Confirm order
→ Pack order
→ Ship order
→ Reduce physical stock
→ Release reservation
→ Mark delivered
→ Retrieve final order history

Verify that the website and MCP return consistent results.

## 32. USER INTERFACE REQUIREMENTS

Use a polished business dashboard design.

Requirements:
- Responsive desktop and mobile layouts.
- Sidebar navigation.
- Light and dark themes.
- Searchable data tables.
- Status badges.
- Confirmation dialogs.
- Toast notifications.
- Loading indicators.
- Empty states.
- Pagination.
- Accessible forms.
- Keyboard navigation.
- Mobile-friendly order actions.

Create a separate MCP Connections interface with authorization and activity controls.

Do not make the dashboard dependent on the AI service.

## 33. DELIVERABLES

Produce:
1. Complete Next.js application.
2. PostgreSQL schema and migrations.
3. Authentication implementation.
4. Full inventory management system.
5. Full manual order management system.
6. Packing and shipping workflows.
7. Payment and return management.
8. Reporting and exports.
9. MCP server.
10. All registered MCP tools.
11. MCP resources and prompts.
12. OAuth 2.1 integration.
13. Consent and connection management.
14. Audit logging.
15. Security tests.
16. Installation instructions.
17. Vercel deployment instructions.
18. MCP client connection instructions.
19. Environment variable template.
20. Free-tier deployment guide.

## 34. ACCEPTANCE CRITERIA

The application is complete only when:

- The website works against a real persistent database.
- Users can manage products and inventory.
- Orders can be created manually.
- Order statuses work correctly.
- Inventory reservations prevent overselling.
- Packing and shipping update the correct records.
- Payments and returns are tracked correctly.
- The MCP endpoint works with a compatible client.
- OAuth authorization works end to end.
- Permissions are enforced on every tool.
- All tool handlers perform real operations.
- Audit logs record modifications.
- Cross-workspace data access is prevented.
- Automated tests pass.
- A clean deployment to Vercel is documented and verified.

Do not deliver only a frontend mockup.

Do not omit MCP tools while claiming full implementation.

Do not hardcode successful responses.

Do not claim OAuth or Vercel deployment works until it has been tested.

Prioritize data integrity, secure AI access, and a simple daily workflow.