import { supabase } from "./supabase";

type ProductRow = { id: number; name: string; purchase_price_cents: number; total_amount: number; unit: string; use_per_service: number };
type ClientRow = { id: number; name: string; phone: string | null; notes: string | null; created_at: string };
type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";
type AppointmentRow = { id: number; client_id: number | null; client_name: string; service: string; service_date: string; service_time: string | null; status: AppointmentStatus; amount_cents: number; product_cost_cents: number; extra_cost_cents: number; payment_fee_cents: number };
type PaymentKind = "deposit" | "partial" | "final" | "full";
type PaymentRow = { id: number; appointment_id: number; amount_cents: number; kind: PaymentKind; paid_at: string; note: string | null };
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

function appointmentFromRow(item: AppointmentRow, payments: PaymentRow[]) {
  const totalCostCents = item.product_cost_cents + item.extra_cost_cents + item.payment_fee_cents;
  const paidCents = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  return {
    id: item.id,
    clientId: item.client_id,
    clientName: item.client_name,
    service: item.service,
    serviceDate: item.service_date,
    serviceTime: item.service_time?.slice(0, 5) ?? "",
    status: item.status,
    amountCents: item.amount_cents,
    productCostCents: item.product_cost_cents,
    extraCostCents: item.extra_cost_cents,
    paymentFeeCents: item.payment_fee_cents,
    totalCostCents,
    profitCents: item.amount_cents - totalCostCents,
    paidCents,
    pendingCents: Math.max(0, item.amount_cents - paidCents),
    payments: payments.map((payment) => ({ id: payment.id, amountCents: payment.amount_cents, kind: payment.kind, paidAt: payment.paid_at, note: payment.note ?? "" })),
  };
}

function clientFromRow(item: ClientRow) {
  return { id: item.id, name: item.name, phone: item.phone ?? "", notes: item.notes ?? "", createdAt: item.created_at };
}

function expenseFromRow(item: ExpenseRow) {
  return { id: item.id, description: item.description, category: item.category, expenseDate: item.expense_date, amountCents: item.amount_cents };
}

export async function getStudioData() {
  const [clientsResult, productsResult, appointmentsResult, paymentsResult, expensesResult, settingsResult] = await Promise.all([
    supabase.from("clients").select("id,name,phone,notes,created_at").order("name", { ascending: true }),
    supabase.from("products").select("id,name,purchase_price_cents,total_amount,unit,use_per_service").order("created_at", { ascending: false }),
    supabase.from("appointments").select("id,client_id,client_name,service,service_date,service_time,status,amount_cents,product_cost_cents,extra_cost_cents,payment_fee_cents").order("service_date", { ascending: false }).order("service_time", { ascending: false }).order("id", { ascending: false }),
    supabase.from("payments").select("id,appointment_id,amount_cents,kind,paid_at,note").order("paid_at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("expenses").select("id,description,category,expense_date,amount_cents").order("expense_date", { ascending: false }),
    supabase.from("studio_settings").select("monthly_goal_cents,reserve_percent").maybeSingle(),
  ]);
  fail(clientsResult.error); fail(productsResult.error); fail(appointmentsResult.error); fail(paymentsResult.error); fail(expensesResult.error); fail(settingsResult.error);
  const settings = settingsResult.data as SettingsRow | null;
  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  return {
    clients: ((clientsResult.data ?? []) as ClientRow[]).map(clientFromRow),
    products: ((productsResult.data ?? []) as ProductRow[]).map(productFromRow),
    appointments: ((appointmentsResult.data ?? []) as AppointmentRow[]).map((appointment) => appointmentFromRow(appointment, payments.filter((payment) => payment.appointment_id === appointment.id))),
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
    const clientId = Number(payload.clientId);
    const clientResult = await supabase.from("clients").select("id,name").eq("id", clientId).maybeSingle();
    fail(clientResult.error);
    if (!clientResult.data) throw new Error("Escolha uma cliente cadastrada.");
    const amountCents = Number(payload.amountCents);
    const depositCents = Math.max(0, Number(payload.depositCents ?? 0));
    if (depositCents > amountCents) throw new Error("O sinal não pode ser maior que o valor do atendimento.");
    const result = await supabase.from("appointments").insert({
      client_id: clientResult.data.id, client_name: clientResult.data.name, service: String(payload.service ?? "").trim(), service_date: payload.serviceDate,
      service_time: payload.serviceTime, status: "scheduled",
      amount_cents: amountCents, product_cost_cents: productCostCents,
      extra_cost_cents: Math.max(0, Number(payload.extraCostCents ?? 0)), payment_fee_cents: Math.max(0, Number(payload.paymentFeeCents ?? 0)),
    }).select("id").single();
    fail(result.error);
    const appointmentId = result.data?.id;
    if (!appointmentId) throw new Error("Não foi possível identificar o atendimento criado.");
    if (depositCents > 0) {
      const paymentResult = await supabase.from("payments").insert({ appointment_id: appointmentId, amount_cents: depositCents, kind: "deposit", paid_at: payload.depositPaidAt });
      if (paymentResult.error) {
        await supabase.from("appointments").delete().eq("id", appointmentId);
        fail(paymentResult.error);
      }
    }
    return { ok: true };
  }

  if (method === "PUT" && path.pathname.endsWith("/appointments")) {
    if ("status" in payload) {
      const appointmentId = Number(payload.id);
      const allowedStatuses: AppointmentStatus[] = ["scheduled", "confirmed", "completed", "cancelled"];
      const status = String(payload.status ?? "") as AppointmentStatus;
      if (!Number.isInteger(appointmentId) || appointmentId <= 0) throw new Error("Atendimento inválido.");
      if (!allowedStatuses.includes(status)) throw new Error("Status de atendimento inválido.");
      const result = await supabase.from("appointments").update({ status }).eq("id", appointmentId).select("id,status").single();
      fail(result.error);
      if (result.data?.id !== appointmentId || result.data.status !== status) throw new Error("Não foi possível confirmar a atualização deste atendimento.");
      return { ok: true };
    }
    const appointmentId = Number(payload.id);
    const clientId = Number(payload.clientId);
    const amountCents = Number(payload.amountCents);
    const service = String(payload.service ?? "").trim();
    const serviceTime = String(payload.serviceTime ?? "").trim();
    if (!Number.isInteger(appointmentId) || !Number.isInteger(clientId)) throw new Error("Atendimento inválido.");
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Informe um valor válido para o atendimento.");
    if (!service || !serviceTime) throw new Error("Informe os serviços e o horário do atendimento.");
    const [clientResult, paymentsResult] = await Promise.all([
      supabase.from("clients").select("id,name").eq("id", clientId).maybeSingle(),
      supabase.from("payments").select("amount_cents").eq("appointment_id", appointmentId),
    ]);
    fail(clientResult.error); fail(paymentsResult.error);
    if (!clientResult.data) throw new Error("Escolha uma cliente cadastrada.");
    const paidCents = (paymentsResult.data ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    if (amountCents < paidCents) throw new Error("O valor do atendimento não pode ser menor que o total já recebido.");
    const result = await supabase.from("appointments").update({
      client_id: clientResult.data.id,
      client_name: clientResult.data.name,
      service,
      service_date: payload.serviceDate,
      service_time: serviceTime,
      amount_cents: amountCents,
      extra_cost_cents: Math.max(0, Number(payload.extraCostCents ?? 0)),
      payment_fee_cents: Math.max(0, Number(payload.paymentFeeCents ?? 0)),
    }).eq("id", appointmentId);
    fail(result.error); return { ok: true };
  }

  if (method === "POST" && path.pathname.endsWith("/payments")) {
    const appointmentId = Number(payload.appointmentId);
    const amountCents = Number(payload.amountCents);
    const allowedKinds: PaymentKind[] = ["deposit", "partial", "final"];
    const kind = String(payload.kind ?? "") as PaymentKind;
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Informe um valor de pagamento válido.");
    if (!allowedKinds.includes(kind)) throw new Error("Tipo de pagamento inválido.");
    const [appointmentResult, paymentsResult] = await Promise.all([
      supabase.from("appointments").select("amount_cents").eq("id", appointmentId).maybeSingle(),
      supabase.from("payments").select("amount_cents").eq("appointment_id", appointmentId),
    ]);
    fail(appointmentResult.error); fail(paymentsResult.error);
    if (!appointmentResult.data) throw new Error("Atendimento não encontrado.");
    const paidCents = (paymentsResult.data ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    if (amountCents > appointmentResult.data.amount_cents - paidCents) throw new Error("O pagamento não pode ser maior que o valor pendente.");
    const result = await supabase.from("payments").insert({ appointment_id: appointmentId, amount_cents: amountCents, kind, paid_at: payload.paidAt, note: String(payload.note ?? "").trim() || null });
    fail(result.error); return { ok: true };
  }

  if (method === "PUT" && path.pathname.endsWith("/payments")) {
    const paymentId = Number(payload.id);
    const amountCents = Number(payload.amountCents);
    const allowedKinds: PaymentKind[] = ["deposit", "partial", "final", "full"];
    const kind = String(payload.kind ?? "") as PaymentKind;
    if (!Number.isInteger(paymentId) || !Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Informe um pagamento válido.");
    if (!allowedKinds.includes(kind)) throw new Error("Tipo de pagamento inválido.");
    const paymentResult = await supabase.from("payments").select("id,appointment_id").eq("id", paymentId).maybeSingle();
    fail(paymentResult.error);
    if (!paymentResult.data) throw new Error("Pagamento não encontrado.");
    const [appointmentResult, paymentsResult] = await Promise.all([
      supabase.from("appointments").select("amount_cents").eq("id", paymentResult.data.appointment_id).maybeSingle(),
      supabase.from("payments").select("id,amount_cents").eq("appointment_id", paymentResult.data.appointment_id).neq("id", paymentId),
    ]);
    fail(appointmentResult.error); fail(paymentsResult.error);
    if (!appointmentResult.data) throw new Error("Atendimento não encontrado.");
    const otherPaymentsCents = (paymentsResult.data ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    if (amountCents > appointmentResult.data.amount_cents - otherPaymentsCents) throw new Error("O pagamento não pode ser maior que o valor pendente.");
    const result = await supabase.from("payments").update({
      amount_cents: amountCents,
      kind,
      paid_at: payload.paidAt,
      note: String(payload.note ?? "").trim() || null,
    }).eq("id", paymentId);
    fail(result.error); return { ok: true };
  }

  if (method === "POST" && path.pathname.endsWith("/clients")) {
    const result = await supabase.from("clients").insert({
      name: String(payload.name ?? "").trim(),
      phone: String(payload.phone ?? "").trim() || null,
      notes: String(payload.notes ?? "").trim() || null,
    });
    fail(result.error); return { ok: true };
  }

  if (method === "PUT" && path.pathname.endsWith("/clients")) {
    const id = Number(payload.id);
    const result = await supabase.from("clients").update({
      name: String(payload.name ?? "").trim(),
      phone: String(payload.phone ?? "").trim() || null,
      notes: String(payload.notes ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
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
    if (!table || !["appointments", "clients", "expenses", "products", "payments"].includes(table)) throw new Error("Registro inválido.");
    const id = Number(path.searchParams.get("id"));
    const result = await supabase.from(table).delete().eq("id", id);
    fail(result.error); return { ok: true };
  }

  throw new Error("Operação não reconhecida.");
}
