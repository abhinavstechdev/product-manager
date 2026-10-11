export type UserRole =
  | "OWNER"
  | "ADMIN"
  | "INVENTORY_MANAGER"
  | "ORDER_MANAGER"
  | "PACKER"
  | "VIEWER";

export type McpScope =
  | "dashboard:read"
  | "products:read"
  | "products:write"
  | "inventory:read"
  | "inventory:write"
  | "customers:read"
  | "customers:write"
  | "orders:read"
  | "orders:create"
  | "orders:update"
  | "orders:cancel"
  | "packing:read"
  | "packing:write"
  | "shipping:read"
  | "shipping:write"
  | "payments:read"
  | "payments:write"
  | "returns:read"
  | "returns:write"
  | "reports:read"
  | "reports:export"
  | "audit:read"
  | "settings:read"
  | "settings:write"
  | "billing:read";

export const ALL_MCP_SCOPES: McpScope[] = [
  "dashboard:read",
  "products:read",
  "products:write",
  "inventory:read",
  "inventory:write",
  "customers:read",
  "customers:write",
  "orders:read",
  "orders:create",
  "orders:update",
  "orders:cancel",
  "packing:read",
  "packing:write",
  "shipping:read",
  "shipping:write",
  "payments:read",
  "payments:write",
  "returns:read",
  "returns:write",
  "reports:read",
  "reports:export",
  "audit:read",
  "settings:read",
  "settings:write",
  "billing:read",
];

// Map user roles to their default allowed MCP scopes
export const ROLE_SCOPES: Record<UserRole, McpScope[]> = {
  OWNER: ALL_MCP_SCOPES,
  ADMIN: [
    "dashboard:read",
    "products:read",
    "products:write",
    "inventory:read",
    "inventory:write",
    "customers:read",
    "customers:write",
    "orders:read",
    "orders:create",
    "orders:update",
    "orders:cancel",
    "packing:read",
    "packing:write",
    "shipping:read",
    "shipping:write",
    "payments:read",
    "payments:write",
    "returns:read",
    "returns:write",
    "reports:read",
    "reports:export",
    "audit:read",
    "settings:read",
    "settings:write",
    "billing:read",
  ],
  INVENTORY_MANAGER: [
    "dashboard:read",
    "products:read",
    "inventory:read",
    "inventory:write",
    "reports:read",
  ],
  ORDER_MANAGER: [
    "dashboard:read",
    "products:read",
    "customers:read",
    "customers:write",
    "orders:read",
    "orders:create",
    "orders:update",
    "orders:cancel",
    "packing:read",
    "packing:write",
    "shipping:read",
    "shipping:write",
    "reports:read",
  ],
  PACKER: [
    "orders:read",
    "packing:read",
    "packing:write",
  ],
  VIEWER: [
    "dashboard:read",
    "products:read",
    "inventory:read",
    "orders:read",
    "reports:read",
  ],
};

export function hasRolePermission(role: UserRole, requiredScope: McpScope): boolean {
  const allowed = ROLE_SCOPES[role] || [];
  return allowed.includes(requiredScope);
}

export function hasMcpScope(grantedScopes: string[], requiredScope: McpScope): boolean {
  return grantedScopes.includes(requiredScope) || grantedScopes.includes("*");
}
