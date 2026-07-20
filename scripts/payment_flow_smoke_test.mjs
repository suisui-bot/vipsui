import assert from "node:assert/strict";

const statuses = {
  unpaid: "unpaid",
  pending: "pending",
  paid: "paid",
};

function submitZelle(order) {
  assert.notEqual(order.payment_status, statuses.paid, "Paid order must not accept new Zelle payment");
  order.payment_status = statuses.pending;
  order.order_status = "awaiting_payment";
  return { provider: "zelle", status: "pending_verification", amount: order.total };
}

function confirmZelle(order, payment, admin) {
  assert.equal(payment.status, "pending_verification", "Only pending Zelle payments can be confirmed");
  assert.ok(admin, "Admin user is required");
  payment.status = "completed";
  payment.verified_by = admin;
  order.payment_status = statuses.paid;
  order.order_status = statuses.paid;
  return { action: "confirmed_payment", previous_status: "pending_verification", new_status: "completed" };
}

function rejectZelle(order, payment, admin) {
  assert.ok(admin, "Admin user is required");
  payment.status = "rejected";
  order.payment_status = statuses.unpaid;
  order.order_status = "awaiting_payment";
}

function cardVisibility(country) {
  return ["paypal", "stripe", ...(country === "United States" || country === "US" ? ["zelle"] : [])];
}

const order = { total: 215, payment_status: "unpaid", order_status: "awaiting_payment" };
const zelle = submitZelle(order);
assert.equal(order.payment_status, "pending");
assert.equal(zelle.status, "pending_verification");
const audit = confirmZelle(order, zelle, "admin");
assert.equal(order.payment_status, "paid");
assert.equal(audit.action, "confirmed_payment");
assert.throws(() => submitZelle(order), /Paid order/);

const rejectedOrder = { total: 95, payment_status: "unpaid", order_status: "awaiting_payment" };
const rejectedPayment = submitZelle(rejectedOrder);
rejectZelle(rejectedOrder, rejectedPayment, "admin");
assert.equal(rejectedOrder.payment_status, "unpaid");
assert.deepEqual(cardVisibility("US"), ["paypal", "stripe", "zelle"]);
assert.deepEqual(cardVisibility("France"), ["paypal", "stripe"]);

console.log("Payment flow smoke scenarios passed.");
