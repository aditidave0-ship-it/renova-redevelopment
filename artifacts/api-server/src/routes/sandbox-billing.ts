import { Router, type IRouter } from "express";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  sandboxOrders,
  sandboxProducts,
  sandboxReceipts,
  sandboxPaymentEvents,
  auditLogs,
} from "@workspace/db";
import { getDb, requireAuth, requireRole } from "../lib/session";
import {
  sandboxPaymentConfig,
  sandboxProviderRequest,
  validWebhookSignature,
} from "../lib/sandbox-payment";

const router: IRouter = Router();
const productSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
  name: z.string().trim().min(3).max(220),
  amountMinor: z.number().int().positive().max(100000000),
  currency: z.literal("INR"),
  approvalReference: z.string().trim().min(3).max(220),
  active: z.boolean().default(false),
});
const error = (message: string, status: number) =>
  Object.assign(new Error(message), { status });
router.put(
  "/admin/sandbox/products",
  requireAuth(),
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      sandboxPaymentConfig();
      const input = productSchema.parse(req.body);
      await getDb().transaction(async (tx) => {
        await tx
          .insert(sandboxProducts)
          .values(input)
          .onConflictDoUpdate({
            target: sandboxProducts.code,
            set: { ...input, updatedAt: new Date() },
          });
        await tx
          .insert(auditLogs)
          .values({
            actorUserId: req.auth!.userId,
            action: "SANDBOX_PRODUCT_CONFIGURED",
            entityType: "SANDBOX_PRODUCT",
            metadata: JSON.stringify({
              code: input.code,
              approvalReference: input.approvalReference,
            }),
          });
      });
      return res.json({ product: input, mode: "SANDBOX" });
    } catch (e) {
      return next(e);
    }
  },
);
router.get(
  "/billing/products",
  requireAuth(),
  requireRole("SOCIETY"),
  async (_req, res, next) => {
    try {
      sandboxPaymentConfig();
      return res.json({
        mode: "SANDBOX",
        products: await getDb()
          .select()
          .from(sandboxProducts)
          .where(eq(sandboxProducts.active, true)),
      });
    } catch (e) {
      return next(e);
    }
  },
);
router.post(
  "/billing/checkout",
  requireAuth(),
  requireRole("SOCIETY"),
  async (req, res, next) => {
    try {
      const config = sandboxPaymentConfig(),
        input = z
          .object({ productCode: z.string().max(80) })
          .strict()
          .parse(req.body);
      const key = z
        .string()
        .min(16)
        .max(128)
        .regex(/^[a-zA-Z0-9_-]+$/)
        .parse(req.get("idempotency-key"));
      if (!req.auth!.organizationId) throw error("Organization required", 409);
      const db = getDb();
      const result = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`sandbox:${req.auth!.userId}:${key}`},0))`,
        );
        const [existing] = await tx
          .select()
          .from(sandboxOrders)
          .where(
            and(
              eq(sandboxOrders.userId, req.auth!.userId),
              eq(sandboxOrders.idempotencyKey, key),
            ),
          );
        if (existing) {
          if (existing.productCode !== input.productCode)
            throw error(
              "Idempotency key already used for another product",
              409,
            );
          return { order: existing, created: false };
        }
        const [product] = await tx
          .select()
          .from(sandboxProducts)
          .where(
            and(
              eq(sandboxProducts.code, input.productCode),
              eq(sandboxProducts.active, true),
            ),
          );
        if (!product)
          throw error(
            "An approved sandbox service price is not available",
            409,
          );
        const [order] = await tx
          .insert(sandboxOrders)
          .values({
            userId: req.auth!.userId,
            organizationId: req.auth!.organizationId!,
            productCode: product.code,
            productName: product.name,
            amountMinor: product.amountMinor,
            currency: product.currency,
            idempotencyKey: key,
          })
          .returning();
        return { order, created: true };
      });
      let order = result.order;
      if (result.created) {
        try {
          const provider = await sandboxProviderRequest("orders", {
            amount: order.amountMinor,
            currency: order.currency,
            receipt: order.id,
            notes: { renova_mode: "SANDBOX" },
          });
          if (
            typeof provider.id !== "string" ||
            !/^order_[A-Za-z0-9]+$/.test(provider.id) ||
            provider.amount !== order.amountMinor ||
            provider.currency !== order.currency ||
            provider.receipt !== order.id
          )
            throw error("Sandbox provider order mismatch", 503);
          [order] = await db
            .update(sandboxOrders)
            .set({
              providerOrderId: provider.id,
              status: "PENDING",
              updatedAt: new Date(),
            })
            .where(eq(sandboxOrders.id, order.id))
            .returning();
        } catch {
          await db
            .update(sandboxOrders)
            .set({ status: "RECONCILIATION_REQUIRED", updatedAt: new Date() })
            .where(eq(sandboxOrders.id, order.id));
          throw error(
            "Sandbox order needs reconciliation. Do not retry with a different key.",
            503,
          );
        }
      }
      return res
        .status(order.status === "CREATING" ? 202 : 200)
        .json({
          mode: "SANDBOX",
          order,
          checkout:
            order.status === "PENDING"
              ? {
                  key: config.keyId,
                  order_id: order.providerOrderId,
                  amount: order.amountMinor,
                  currency: order.currency,
                }
              : null,
        });
    } catch (e) {
      return next(e);
    }
  },
);
router.get(
  "/billing/orders",
  requireAuth(),
  requireRole("SOCIETY"),
  async (req, res, next) => {
    try {
      sandboxPaymentConfig();
      return res.json({
        mode: "SANDBOX",
        orders: await getDb()
          .select()
          .from(sandboxOrders)
          .where(eq(sandboxOrders.organizationId, req.auth!.organizationId!)),
      });
    } catch (e) {
      return next(e);
    }
  },
);
router.get(
  "/billing/orders/:id/receipt",
  requireAuth(),
  requireRole("SOCIETY", "ADMIN"),
  async (req, res, next) => {
    try {
      sandboxPaymentConfig();
      const id = z.string().uuid().parse(req.params.id);
      const [record] = await getDb()
        .select({ receipt: sandboxReceipts, order: sandboxOrders })
        .from(sandboxReceipts)
        .innerJoin(sandboxOrders, eq(sandboxOrders.id, sandboxReceipts.orderId))
        .where(
          and(
            eq(sandboxOrders.id, id),
            ...(req.auth!.role === "ADMIN"
              ? []
              : [eq(sandboxOrders.organizationId, req.auth!.organizationId!)]),
          ),
        );
      if (!record) throw error("Receipt not found", 404);
      return res.json({
        mode: "SANDBOX",
        notice: "Test receipt only. No money collected; not a tax invoice.",
        ...record,
      });
    } catch (e) {
      return next(e);
    }
  },
);
router.post("/billing/webhook", async (req, res, next) => {
  try {
    const config = sandboxPaymentConfig();
    if (!Buffer.isBuffer(req.body))
      throw error("Webhook requires the original request body", 400);
    if (
      !validWebhookSignature(
        req.body,
        req.get("x-razorpay-signature"),
        config.webhookSecret,
      )
    )
      throw error("Invalid webhook signature", 401);
    const eventId = z
      .string()
      .min(1)
      .max(160)
      .parse(req.get("x-razorpay-event-id"));
    const digest = createHash("sha256").update(req.body).digest("hex");
    const payload = z
      .object({ event: z.string().max(100), payload: z.unknown().optional() })
      .parse(JSON.parse(req.body.toString("utf8")));
    const duplicate = await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`sandbox:event:${eventId}`},0))`,
      );
      const [prior] = await tx
        .select()
        .from(sandboxPaymentEvents)
        .where(eq(sandboxPaymentEvents.eventId, eventId));
      if (prior) {
        if (prior.payloadHash !== digest)
          throw error("Webhook event payload changed", 409);
        return true;
      }
      if (
        payload.event !== "payment.captured" &&
        payload.event !== "order.paid"
      ) {
        await tx
          .insert(sandboxPaymentEvents)
          .values({ eventId, payloadHash: digest, eventName: payload.event });
        return false;
      }
      const payment = z
        .object({
          id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
          order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
          amount: z.number().int().positive(),
          currency: z.literal("INR"),
          status: z.literal("captured"),
          captured: z.literal(true),
        })
        .parse((payload.payload as any)?.payment?.entity);
      const [order] = await tx
        .select()
        .from(sandboxOrders)
        .where(eq(sandboxOrders.providerOrderId, payment.order_id))
        .for("update");
      if (!order || order.mode !== "SANDBOX")
        throw error("Sandbox order not found", 404);
      if (
        order.amountMinor !== payment.amount ||
        order.currency !== payment.currency
      )
        throw error("Payment does not match the order", 409);
      if (order.status === "PAID" && order.providerPaymentId !== payment.id)
        throw error("Order already paid by another payment", 409);
      // Test-key API verification prevents a live-mode event from fulfilling a sandbox order.
      const confirmed = await sandboxProviderRequest(`payments/${payment.id}`);
      for (const field of [
        "id",
        "order_id",
        "amount",
        "currency",
        "status",
        "captured",
      ] as const)
        if (confirmed[field] !== payment[field])
          throw error("Payment was not confirmed by the sandbox provider", 409);
      await tx
        .update(sandboxOrders)
        .set({
          status: "PAID",
          providerPaymentId: payment.id,
          paidAt: order.paidAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sandboxOrders.id, order.id));
      await tx
        .insert(sandboxReceipts)
        .values({ orderId: order.id, reference: `SANDBOX-${randomUUID()}` })
        .onConflictDoNothing({ target: sandboxReceipts.orderId });
      await tx
        .insert(sandboxPaymentEvents)
        .values({
          eventId,
          payloadHash: digest,
          eventName: payload.event,
          orderId: order.id,
        });
      await tx
        .insert(auditLogs)
        .values({
          action: "SANDBOX_PAYMENT_CONFIRMED",
          entityType: "SANDBOX_ORDER",
          entityId: order.id,
        });
      return false;
    });
    return res.json({ received: true, duplicate, mode: "SANDBOX" });
  } catch (e) {
    return next(e);
  }
});
export default router;
