import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  enquiries,
  enquiryEmailJobs,
  sandboxReceipts,
  sandboxOrders,
} from "./database";
import { processEnquiryEmailJobs } from "../src/lib/enquiry-email-jobs";

export async function testSandboxAndEmail(
  origin: string,
  societyCookie: string,
  otherSocietyCookie: string,
  pmcCookie: string,
  adminCookie: string,
) {
  const nativeFetch = globalThis.fetch;
  const names = [
    "VERCEL_ENV",
    "RENOVA_PAYMENTS_MODE",
    "RAZORPAY_TEST_KEY_ID",
    "RAZORPAY_TEST_KEY_SECRET",
    "RAZORPAY_TEST_WEBHOOK_SECRET",
    "RENOVA_EMAIL_PROVIDER",
    "RESEND_API_KEY",
    "RENOVA_APP_URL",
    "RENOVA_EMAIL_FROM",
    "RENOVA_ADMIN_ENQUIRY_EMAIL",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  let providerOrders = 0,
    checks = 0,
    failEmails = false;
  const payments = new Map<string, unknown>(),
    emailKeys: string[] = [];
  const equal = (actual: unknown, expected: unknown) => {
    assert.deepEqual(actual, expected);
    checks++;
  };
  const request = (
    path: string,
    method = "GET",
    cookie = "",
    body?: unknown,
    key?: string,
  ) =>
    nativeFetch(origin + "/api" + path, {
      method,
      headers: {
        "content-type": "application/json",
        cookie,
        ...(key ? { "idempotency-key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === "https://api.razorpay.com/v1/orders") {
      providerOrders++;
      return Response.json({
        ...JSON.parse(String(init?.body)),
        id: `order_TESTONLY${providerOrders}`,
      });
    }
    if (url.startsWith("https://api.razorpay.com/v1/payments/"))
      return Response.json(payments.get(url.split("/").at(-1)!) ?? {});
    if (url === "https://api.resend.com/emails") {
      emailKeys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      if (failEmails) throw new Error("TEST ONLY transient provider failure");
      return Response.json({ id: "TEST-ONLY-acceptance" });
    }
    return nativeFetch(input, init);
  };
  try {
    delete process.env.RENOVA_PAYMENTS_MODE;
    equal(
      (await request("/billing/products", "GET", societyCookie)).status,
      503,
    );
    Object.assign(process.env, {
      VERCEL_ENV: "preview",
      RENOVA_PAYMENTS_MODE: "sandbox",
      RAZORPAY_TEST_KEY_ID: "rzp_test_TESTONLY",
      RAZORPAY_TEST_KEY_SECRET: "TEST-ONLY-secret",
      RAZORPAY_TEST_WEBHOOK_SECRET: "TEST-ONLY-webhook-secret",
    });
    equal((await request("/billing/products")).status, 401);
    equal((await request("/billing/products", "GET", pmcCookie)).status, 403);
    equal(
      (
        (await (
          await request("/billing/products", "GET", societyCookie)
        ).json()) as any
      ).products,
      [],
    );
    const product = {
      code: "test-only",
      name: "TEST ONLY service (synthetic fixture, not a business price)",
      amountMinor: 12345,
      currency: "INR",
      approvalReference: "TEST ONLY approval fixture",
      active: true,
    };
    equal(
      (await request("/admin/sandbox/products", "PUT", societyCookie, product))
        .status,
      403,
    );
    equal(
      (await request("/admin/sandbox/products", "PUT", adminCookie, product))
        .status,
      200,
    );
    const key = "TEST_ONLY_IDEMPOTENCY_0001";
    equal(
      (
        await request(
          "/billing/checkout",
          "POST",
          societyCookie,
          { productCode: product.code, amountMinor: 1 },
          key,
        )
      ).status,
      400,
    );
    equal(
      (
        await request("/billing/checkout", "POST", societyCookie, {
          productCode: product.code,
        })
      ).status,
      400,
    );
    const checkouts = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(
          "/billing/checkout",
          "POST",
          societyCookie,
          { productCode: product.code },
          key,
        ),
      ),
    );
    for (const response of checkouts) {
      assert.ok([200, 202].includes(response.status));
      checks++;
    }
    equal(providerOrders, 1);
    const order = (
      (await (
        await request(
          "/billing/checkout",
          "POST",
          societyCookie,
          { productCode: product.code },
          key,
        )
      ).json()) as any
    ).order;
    equal(order.amountMinor, product.amountMinor);
    equal(order.status, "PENDING");
    equal(
      (
        await request(
          "/billing/checkout",
          "POST",
          societyCookie,
          { productCode: "other-test-only" },
          key,
        )
      ).status,
      409,
    );
    equal(
      (
        await request("/admin/sandbox/products", "PUT", adminCookie, {
          ...product,
          amountMinor: 54321,
        })
      ).status,
      200,
    );
    equal(
      (
        (await (
          await request(
            "/billing/checkout",
            "POST",
            societyCookie,
            { productCode: product.code },
            key,
          )
        ).json()) as any
      ).order.amountMinor,
      12345,
    );
    equal(
      (
        await request(
          `/billing/orders/${order.id}/receipt`,
          "GET",
          societyCookie,
        )
      ).status,
      404,
    );
    const payment = {
      id: "pay_TESTONLY1",
      order_id: order.providerOrderId,
      amount: 12345,
      currency: "INR",
      status: "captured",
      captured: true,
    };
    payments.set(payment.id, payment);
    const webhook = (eventId: string, event: object, valid = true) => {
      const raw = JSON.stringify(event);
      return nativeFetch(origin + "/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-razorpay-event-id": eventId,
          "x-razorpay-signature": valid
            ? createHmac("sha256", "TEST-ONLY-webhook-secret")
                .update(raw)
                .digest("hex")
            : "0".repeat(64),
        },
        body: raw,
      });
    };
    const captured = {
      event: "payment.captured",
      payload: { payment: { entity: payment } },
    };
    equal((await webhook("test-event-1", captured, false)).status, 401);
    equal(
      (
        await webhook("test-mismatch", {
          ...captured,
          payload: { payment: { entity: { ...payment, amount: 1 } } },
        })
      ).status,
      409,
    );
    equal((await db.select().from(sandboxReceipts)).length, 0);
    equal((await webhook("test-event-1", captured)).status, 200);
    equal((await webhook("test-event-1", captured)).status, 200);
    equal(
      (await webhook("test-event-1", { ...captured, event: "order.paid" }))
        .status,
      409,
    );
    equal((await db.select().from(sandboxReceipts)).length, 1);
    equal(
      (await webhook("late-failed-event", { event: "payment.failed" })).status,
      200,
    );
    equal(
      (
        await db
          .select()
          .from(sandboxOrders)
          .where(eq(sandboxOrders.id, order.id))
      )[0].status,
      "PAID",
    );
    equal(
      (
        await request(
          `/billing/orders/${order.id}/receipt`,
          "GET",
          societyCookie,
        )
      ).status,
      200,
    );
    equal(
      (
        await request(
          `/billing/orders/${order.id}/receipt`,
          "GET",
          otherSocietyCookie,
        )
      ).status,
      404,
    );
    equal(
      (await request(`/billing/orders/${order.id}/receipt`, "GET", pmcCookie))
        .status,
      403,
    );
    process.env.RAZORPAY_TEST_KEY_ID = "rzp_live_TESTONLY";
    equal(
      (await request("/billing/products", "GET", societyCookie)).status,
      503,
    );
    process.env.RAZORPAY_TEST_KEY_ID = "rzp_test_TESTONLY";
    process.env.VERCEL_ENV = "production";
    equal(
      (await request("/billing/products", "GET", societyCookie)).status,
      503,
    );
    process.env.VERCEL_ENV = "preview";
    // An enquiry survives unconfigured mail, then a failed attempt and retry.
    const [enquiry] = await db
      .select()
      .from(enquiries)
      .where(eq(enquiries.email, "enquiry@example.invalid"));
    equal(
      (
        await db
          .select()
          .from(enquiryEmailJobs)
          .where(eq(enquiryEmailJobs.enquiryId, enquiry.id))
      ).length,
      2,
    );
    equal(
      (await request("/admin/enquiry-email-jobs", "GET", societyCookie)).status,
      403,
    );
    Object.assign(process.env, {
      RENOVA_EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "TEST-ONLY-no-real-provider-key",
      RENOVA_APP_URL: "https://qa.example.invalid",
      RENOVA_EMAIL_FROM: "TEST ONLY <no-mail@example.invalid>",
      RENOVA_ADMIN_ENQUIRY_EMAIL: "test-only-admin@example.invalid",
    });
    await db
      .update(enquiryEmailJobs)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(enquiryEmailJobs.enquiryId, enquiry.id));
    failEmails = true;
    equal(
      (await processEnquiryEmailJobs(enquiry.id)).map((row) => row.status),
      ["RETRY", "RETRY"],
    );
    failEmails = false;
    await db
      .update(enquiryEmailJobs)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(enquiryEmailJobs.enquiryId, enquiry.id));
    equal(
      (await processEnquiryEmailJobs(enquiry.id)).map((row) => row.status),
      ["ACCEPTED", "ACCEPTED"],
    );
    const accepted = await processEnquiryEmailJobs(enquiry.id);
    equal(
      accepted.map((row) => row.attemptCount),
      [2, 2],
    );
    equal(emailKeys.length, 4);
    assert.ok(emailKeys.every(Boolean));
    checks++;
    equal(new Set(emailKeys).size, 2);
    equal(
      (await db.select().from(enquiries).where(eq(enquiries.id, enquiry.id)))
        .length,
      1,
    );
    return checks;
  } finally {
    globalThis.fetch = nativeFetch;
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  }
}
