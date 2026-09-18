import { supabase } from "./supabase";

type ProductRow = { id: number; name: string; purchase_price_cents: number; total_amount: number; unit: string; use_per_service: number };
type AppointmentRow = { id: number; client_name: string; service: string; service_date: string; amount_cents: number; product_cost_cents: number; extra_cost_cents: number; payment_fee_cents: number };
type ExpenseRow = { id: number; description: string; category: string; expense_date: string; amount_cents: number };
type SettingsRow = { monthly_goal_cents: number; reserve_percent: number };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message || "Não foi possível acessar os dados.");
}

function productFromRow(item: ProductRow) {
  return {
    id: item.id,
    name: item.name,
    purchasePriceCents: item.purchase_price_cents,
    totalAmount: Number(item.total_amount),
    unit: item.unit,
    usePerService: Number(item.use_per_service),
    costPerUseCents: Math.round((item.purchase_price_cents / Number(item.total_amount)) * Number(item.use_per_service)),
  };
}

function appointmentFromRow(item: AppointmentRow) {
  const totalCostCents = item.product_cost_cents + item.extra_cost_cents + item.payment_fee_cents;
  return {
    id: item.id,
    clientName: item.client_name,
    service: item.service,
    serviceDate: item.service_date,
    amountCents: item.amount_cents,
    productCostCents: item.product_cost_cents,
    extraCostCents: item.extra_cost_cents,
    paymentFeeCents: item.payment_fee_cents,
    totalCostCents,
    profitCents: item.amount_cents - totalCostCents,
  };
}

function expenseFromRow(item: ExpenseRow) {
  return { id: item.id, description: item.description, category: item.category, expenseDate: item.expense_date, amountCents: item.amount_cents };
}

export async function getStudioData() {
  const [productsResult, appointmentsResult, expensesResult, settingsResult] = await Promise.all([
    supabase.from("products").select("id,name,purchase_price_cents,total_amount,unit,use_per_service").order("created_at", { ascending: false }),
    supabase.from("appointments").select("id,client_name,service,service_date,amount_cents,product_cost_cents,extra_cost_cents,payment_fee_cents").order("service_date", { ascending: false }),
    supabase.from("expenses").select("id,description,category,expense_date,amount_cents").order("expense_date", { ascending: false }),
    supabase.from("studio_settings").select("monthly_goal_cents,reserve_percent").maybeSingle(),
  ]);
  fail(productsResult.error); fail(appointmentsResult.error); fail(expensesResult.error); fail(settingsResult.error);
  const settings = settingsResult.data as SettingsRow | null;
  return {
    products: ((productsResult.data ?? []) as ProductRow[]).map(productFromRow),
    appointments: ((appointmentsResult.data ?? []) as AppointmentRow[]).map(appointmentFromRow),
    expenses: ((expensesResult.data ?? []) as ExpenseRow[]).map(expenseFromRow),
    settings: {
      monthlyGoalCents: settings?.monthly_goal_cents ?? 500000,
      reservePercent: Number(settings?.reserve_percent ?? 10),
    },
  };
}

export async function studioRequest(url: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const payload = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
  const path = new URL(url, window.location.origin);

  if (method === "POST" && path.pathname.endsWith("/appointments")) {
    const productIds = Array.isArray(payload.productIds) ? payload.productIds.filter((value): value is number => Number.isInteger(value)) : [];
    let productCostCents = 0;
    if (productIds.length) {
      const result = await supabase.from("products").select("purchase_price_cents,total_amount,use_per_service").in("id", productIds);
      fail(result.error);
      productCostCents = (result.data ?? []).reduce((sum, item) => sum + Math.round((item.purchase_price_cents / Number(item.total_amount)) * Number(item.use_per_service)), 0);
    }
    const result = await supabase.from("appointments").insert({
      client_name: String(payload.clientName ?? "").trim(), service: String(payload.service ?? "").trim(), service_date: payload.serviceDate,
      amount_cents: payload.amountCents, product_cost_cents: productCostCents,
      extra_cost_cents: Math.max(0, Number(payload.extraCostCents ?? 0)), payment_fee_cents: Math.max(0, Number(payload.paymentFeeCents ?? 0)),
    });
    fail(result.error); return { ok: true };
  }

  if (method === "POST" && path.pathname.endsWith("/expenses")) {
    const result = await supabase.from("expenses").insert({ description: String(payload.description ?? "").trim(), category: payload.category, expense_date: payload.expenseDate, amount_cents: payload.amountCents });
    fail(result.error); return { ok: true };
  }

  if (method === "POST" && path.pathname.endsWith("/products")) {
    const result = await supabase.from("products").insert({ name: String(payload.name ?? "").trim(), purchase_price_cents: payload.purchasePriceCents, total_amount: payload.totalAmount, unit: payload.unit, use_per_service: payload.usePerService });
    fail(result.error); return { ok: true };
  }

  if (method === "PUT" && path.pathname.endsWith("/settings")) {
    const { data: userData, error: userError } = await supabase.auth.getUser(); fail(userError);
    if (!userData.user) throw new Error("Entre novamente para salvar as preferências.");
    const result = await supabase.from("studio_settings").upsert({ user_id: userData.user.id, monthly_goal_cents: payload.monthlyGoalCents, reserve_percent: payload.reservePercent }, { onConflict: "user_id" });
    fail(result.error); return { ok: true };
  }

  if (method === "DELETE") {
    const table = path.pathname.split("/").pop();
    if (!table || !["appointments", "expenses", "products"].includes(table)) throw new Error("Registro inválido.");
    const id = Number(path.searchParams.get("id"));
    const result = await supabase.from(table).delete().eq("id", id);
    fail(result.error); return { ok: true };
  }

  throw new Error("Operação não reconhecida.");
}
