import { z } from "zod";

// Role enum
export const UserRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "INVENTORY_MANAGER",
  "ORDER_MANAGER",
  "PACKER",
  "VIEWER",
]);

// Product schemas
export const CreateProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().min(2, "SKU must be at least 2 characters").toUpperCase(),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  purchaseCost: z.coerce.number().min(0, "Purchase cost must be positive"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be positive"),
  initialStock: z.coerce.number().int().min(0, "Initial stock cannot be negative").default(0),
  reorderThreshold: z.coerce.number().int().min(0).default(10),
});

export const UpdateProductSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  name: z.string().min(2).optional(),
  sku: z.string().min(2).toUpperCase().optional(),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  purchaseCost: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  reorderThreshold: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Category schemas
export const CreateCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  description: z.string().optional().nullable(),
});

export const UpdateCategorySchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Inventory schemas
export const AdjustInventorySchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantityChange: z.coerce.number().int().refine((val) => val !== 0, "Quantity change cannot be 0"),
  reason: z.string().min(3, "Reason is required for inventory adjustments"),
  type: z.enum([
    "MANUAL_ADJUSTMENT",
    "STOCK_RECEIVED",
    "DAMAGED_GOODS",
    "STOCK_CORRECTION",
  ]).default("MANUAL_ADJUSTMENT"),
});

export const ReceiveInventorySchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Received quantity must be positive"),
  supplierReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Customer schemas
export const CreateCustomerSchema = z.object({
  name: z.string().min(2, "Customer name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  shippingAddress: z.string().min(5, "Shipping address is required"),
  notes: z.string().optional().nullable(),
});

export const UpdateCustomerSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  shippingAddress: z.string().min(5).optional(),
  notes: z.string().optional().nullable(),
});

// Order schemas
export const OrderItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative").optional(), // default to product selling price if omitted
  discount: z.coerce.number().min(0).default(0),
});

export const CreateOrderSchema = z.object({
  customerId: z.string().optional().nullable(),
  newCustomer: CreateCustomerSchema.optional().nullable(),
  shippingAddress: z.string().min(5).optional(), // Can inherit from customer
  source: z.enum([
    "WhatsApp",
    "Phone",
    "Instagram",
    "Facebook",
    "Website",
    "Walk-in",
    "Other",
  ]).default("WhatsApp"),
  items: z.array(OrderItemInputSchema).min(1, "At least one item is required in the order"),
  orderDiscount: z.coerce.number().min(0).default(0),
  shippingFee: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().default("Cash on Delivery"),
  paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).default("UNPAID"),
  initialPaymentAmount: z.coerce.number().min(0).optional(),
  packingNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});

export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  newStatus: z.enum([
    "NEW",
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ]),
  note: z.string().optional().nullable(),
});

// Packing schemas
export const MarkPackedSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  packingNotes: z.string().optional().nullable(),
});

// Shipping schemas
export const MarkShippedSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  courier: z.string().min(2, "Courier name is required (e.g. Blue Dart, Delhivery, DTDC)"),
  trackingNumber: z.string().min(3, "Tracking number is required"),
  expectedDeliveryDays: z.coerce.number().int().positive().optional().default(3),
  notes: z.string().optional().nullable(),
});

// Payment schemas
export const RecordPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  amount: z.coerce.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.enum(["Cash", "Cash on Delivery", "UPI", "Bank transfer", "Other"]),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});

// Returns schemas
export const RegisterReturnSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  reason: z.string().min(3, "Return reason is required"),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
      condition: z.enum(["sellable", "damaged"]).default("sellable"),
    })
  ).min(1, "At least one item must be returned"),
  notes: z.string().optional().nullable(),
});

export const ApproveReturnSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  refundAmount: z.coerce.number().min(0).default(0),
  restockSellable: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

// Filter & report schemas
export const DateRangeFilterSchema = z.object({
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});
