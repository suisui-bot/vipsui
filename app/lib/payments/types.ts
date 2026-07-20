export type PaymentProviderName = "paypal" | "stripe" | "zelle" | "airwallex" | "bank_transfer";

export type PaymentProviderType = "wallet" | "card" | "manual" | "bank_transfer";

export type PaymentStatus =
  | "created"
  | "pending"
  | "pending_verification"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "refunded"
  | "partially_refunded";

export type OrderPaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded" | "partially_refunded";

export type OrderStatus = "draft" | "awaiting_payment" | "paid" | "processing" | "shipped" | "completed" | "cancelled";

export type PaymentProvider = {
  provider_name: PaymentProviderName;
  provider_type: PaymentProviderType;
  enabled: boolean;
  display_name: string;
  description: string;
  payment_instructions: string;
  supports_auto_confirmation: boolean;
  supports_refund: boolean;
  supports_webhook: boolean;
  environment: "sandbox" | "production" | "manual" | "not_configured";
  configuration_status: "configured" | "missing_configuration" | "manual_ready" | "disabled";
  allowed_countries: string[];
  public_config: Record<string, string | boolean | string[]>;
  secret_preview?: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  product_id?: string;
  image: string;
  name: string;
  product_number: string;
  specs: string;
  quantity: number;
  unit_price: number;
};

export type Customer = {
  id: string;
  name: string;
  country: string;
  whatsapp?: string;
  email?: string;
};

export type QuickOrder = {
  id: string;
  order_number: string;
  checkout_token: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: "USD";
  payment_status: OrderPaymentStatus;
  order_status: OrderStatus;
  paid_at?: string;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  provider: PaymentProviderName;
  provider_payment_id?: string;
  provider_order_id?: string;
  payment_method: string;
  amount: number;
  currency: "USD";
  status: PaymentStatus;
  manual_verification_required: boolean;
  submitted_at?: string;
  verified_at?: string;
  verified_by?: string;
  failed_reason?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PaymentAuditLog = {
  id: string;
  payment_id: string;
  order_id: string;
  action: string;
  performed_by: string;
  previous_status: PaymentStatus;
  new_status: PaymentStatus;
  notes?: string;
  created_at: string;
};

export type DashboardPaymentStats = {
  pendingPayments: number;
  pendingZelleVerification: number;
  paidToday: number;
  paypalRevenue: number;
  zelleRevenue: number;
  cardRevenue: number;
  methodDistribution: Array<{ provider: string; count: number; revenue: number }>;
};
