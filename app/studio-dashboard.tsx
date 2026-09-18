"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Banknote, Box, CalendarDays, ChevronLeft,
  ChevronRight, CircleDollarSign, LayoutDashboard, Loader2, PackagePlus,
  Download, LogOut, PiggyBank, Plus, ReceiptText, Settings, Target, Trash2, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { getStudioData, studioRequest } from "@/lib/studio-api";

type Product = { id: number; name: string; purchasePriceCents: number; totalAmount: number; unit: string; usePerService: number; costPerUseCents: number };
type Appointment = { id: number; clientName: string; service: string; serviceDate: string; amountCents: number; productCostCents: number; extraCostCents: number; paymentFeeCents: number; totalCostCents: number; profitCents: number };
type Expense = { id: number; description: string; category: string; expenseDate: string; amountCents: number };
type StudioSettings = { monthlyGoalCents: number; reservePercent: number };
type StudioData = { products: Product[]; appointments: Appointment[]; expenses: Expense[]; settings: StudioSettings };
type DeleteTarget = { type: "appointments" | "expenses" | "products"; id: number; name: string } | null;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const SERVICES = ["Maquiagem express", "Maquiagem social", "Penteado simples"] as const;

function cents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}
function money(value: number) { return brl.format(value / 100); }
function todayInput() { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 10); }
function monthKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function parseDate(value: string) { return new Date(`${value}T12:00:00`); }

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div className="field-group"><Label htmlFor={id}>{label}</Label>{children}{hint ? <span className="field-hint">{hint}</span> : null}</div>;
}

async function requestJson(url: string, init?: RequestInit) {
  return studioRequest(url, init);
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function decimalFromCents(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function downloadBackup(data: StudioData) {
  const header = ["tipo", "data", "nome", "detalhe", "valor_reais", "custo_reais", "lucro_reais", "quantidade", "unidade", "uso_medio"];
  const rows: Array<Array<string | number>> = [
    ...data.appointments.map((item) => ["Atendimento", item.serviceDate, item.clientName, item.service, decimalFromCents(item.amountCents), decimalFromCents(item.totalCostCents), decimalFromCents(item.profitCents), "", "", ""]),
    ...data.expenses.map((item) => ["Gasto", item.expenseDate, item.description, item.category, decimalFromCents(item.amountCents), "", "", "", "", ""]),
    ...data.products.map((item) => ["Produto", "", item.name, "", decimalFromCents(item.purchasePriceCents), decimalFromCents(item.costPerUseCents), "", item.totalAmount, item.unit, item.usePerService]),
    ["Configuração", "", "Meta mensal", "", decimalFromCents(data.settings.monthlyGoalCents), "", "", "", "", ""],
    ["Configuração", "", "Reserva", `${data.settings.reservePercent}%`, "", "", "", "", "", ""],
  ];
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `studio-em-dia-backup-${todayInput()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success("Backup baixado com sucesso.");
}

export function StudioDashboard({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => void }) {
  const [data, setData] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("inicio");
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoadError("");
    try {
      setData(await getStudioData());
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Não foi possível carregar seus dados."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void loadData();
    const refresh = () => void loadData();
    window.addEventListener("studio-data-changed", refresh);
    return () => window.removeEventListener("studio-data-changed", refresh);
  }, []);

  const monthAppointments = useMemo(() => data?.appointments.filter((item) => item.serviceDate.startsWith(selectedMonth)) ?? [], [data, selectedMonth]);
  const monthExpenses = useMemo(() => data?.expenses.filter((item) => item.expenseDate.startsWith(selectedMonth)) ?? [], [data, selectedMonth]);
  const totals = useMemo(() => {
    const revenue = monthAppointments.reduce((sum, item) => sum + item.amountCents, 0);
    const serviceCosts = monthAppointments.reduce((sum, item) => sum + item.totalCostCents, 0);
    const expenses = monthExpenses.reduce((sum, item) => sum + item.amountCents, 0);
    const profit = revenue - serviceCosts - expenses;
    const reserve = Math.max(0, Math.round(revenue * ((data?.settings.reservePercent ?? 10) / 100)));
    return { revenue, serviceCosts, expenses, profit, reserve, available: profit - reserve, ticket: monthAppointments.length ? Math.round(revenue / monthAppointments.length) : 0 };
  }, [monthAppointments, monthExpenses, data?.settings.reservePercent]);
  const selectedMonthDate = useMemo(() => { const [year, month] = selectedMonth.split("-").map(Number); return new Date(year, month - 1, 1); }, [selectedMonth]);
  const moveMonth = (difference: number) => { const next = new Date(selectedMonthDate); next.setMonth(next.getMonth() + difference); setSelectedMonth(monthKey(next)); };
  const goal = data?.settings.monthlyGoalCents ?? 500000;
  const goalPercent = goal > 0 ? Math.min(100, Math.round((totals.revenue / goal) * 100)) : 0;
  const goalRemaining = Math.max(0, goal - totals.revenue);

  const deleteItem = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await requestJson(`/api/${deleteTarget.type}?id=${deleteTarget.id}`, { method: "DELETE" }); toast.success("Registro excluído."); setDeleteTarget(null); await loadData(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir."); }
    finally { setSaving(false); }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="app-shell">
      <aside className="sidebar">
        <div className="brand-block"><span className="brand-mark" aria-hidden="true">SD</span><div><p className="brand-name">Studio em Dia</p><p className="brand-subtitle">Gestão financeira para maquiadoras</p></div></div>
        <TabsList className="main-nav" aria-label="Navegação principal">
          <TabsTrigger value="inicio"><LayoutDashboard /><span>Início</span></TabsTrigger>
          <TabsTrigger value="atendimentos"><CalendarDays /><span>Atendimentos</span></TabsTrigger>
          <TabsTrigger value="gastos"><ReceiptText /><span>Gastos</span></TabsTrigger>
          <TabsTrigger value="produtos"><Box /><span>Produtos</span></TabsTrigger>
        </TabsList>
        <div className="sidebar-actions"><button className="settings-link" type="button" onClick={() => setSettingsOpen(true)}><Settings aria-hidden="true" /><span>Meta e reserva</span></button><button className="logout-link" type="button" onClick={onSignOut} title={userEmail}><LogOut aria-hidden="true" /><span>Sair</span></button></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Visão do mês</p><h1>{monthName.format(selectedMonthDate)}</h1></div>
          <div className="topbar-actions">
            <div className="month-switcher" aria-label="Escolher mês"><button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft /></button><button type="button" onClick={() => setSelectedMonth(monthKey())}>Hoje</button><button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight /></button></div>
            <Button className="primary-action" onClick={() => setAppointmentOpen(true)}><Plus /> Novo atendimento</Button><button className="topbar-logout" type="button" onClick={onSignOut} aria-label="Sair da conta"><LogOut /></button>
          </div>
        </header>

        {loadError ? <section className="error-state" role="alert"><strong>Não conseguimos abrir seus dados.</strong><p>{loadError}</p><Button variant="outline" onClick={() => { setLoading(true); void loadData(); }}>Tentar novamente</Button></section>
        : loading ? <LoadingView /> : <>
          <TabsContent value="inicio" className="page-content">
            <section className="summary-grid" aria-label="Resumo financeiro">
              <article className="summary-card summary-card--hero"><div className="summary-icon"><CircleDollarSign /></div><p>Faturamento</p><strong>{money(totals.revenue)}</strong><span>{monthAppointments.length} {monthAppointments.length === 1 ? "atendimento" : "atendimentos"}</span></article>
              <article className="summary-card"><div className="summary-icon summary-icon--green"><ArrowUpRight /></div><p>Lucro do mês</p><strong>{money(totals.profit)}</strong><span>já descontando todos os gastos</span></article>
              <article className="summary-card"><div className="summary-icon summary-icon--orange"><ArrowDownRight /></div><p>Gastos totais</p><strong>{money(totals.serviceCosts + totals.expenses)}</strong><span>produtos, taxas e despesas</span></article>
              <article className="summary-card"><div className="summary-icon summary-icon--blue"><WalletCards /></div><p>Ticket médio</p><strong>{money(totals.ticket)}</strong><span>valor médio por atendimento</span></article>
            </section>
            <section className="dashboard-grid">
              <article className="panel goal-panel">
                <div className="panel-heading"><div><span className="section-kicker"><Target /> Meta mensal</span><h2>{goalPercent}% alcançado</h2></div><button type="button" className="text-button" onClick={() => setSettingsOpen(true)}>Alterar</button></div>
                <Progress value={goalPercent} aria-label={`${goalPercent}% da meta alcançada`} />
                <div className="goal-values"><span><strong>{money(totals.revenue)}</strong> realizados</span><span>Meta: <strong>{money(goal)}</strong></span></div>
                <p className="goal-message">{goalRemaining > 0 ? `Faltam ${money(goalRemaining)} para chegar à meta.` : "Meta alcançada. Parabéns pelo resultado!"}</p>
              </article>
              <article className="panel reserve-panel">
                <div className="panel-heading"><span className="section-kicker"><PiggyBank /> Reserva</span><span className="reserve-percent">{data?.settings.reservePercent ?? 10}%</span></div>
                <strong className="reserve-value">{money(totals.reserve)}</strong><p>Separado automaticamente do faturamento deste mês.</p>
                <div className="available-balance"><span>Saldo após a reserva</span><strong>{money(totals.available)}</strong></div>
              </article>
            </section>
            <section className="panel recent-panel">
              <div className="panel-heading"><div><span className="section-kicker">Movimentação recente</span><h2>Últimos atendimentos</h2></div>{monthAppointments.length > 0 ? <button type="button" className="text-button" onClick={() => setActiveTab("atendimentos")}>Ver todos</button> : null}</div>
              {monthAppointments.length ? <div className="record-list">{monthAppointments.slice(0, 4).map((item) => <div className="record-row" key={item.id}><div className="record-avatar" aria-hidden="true">{item.clientName.charAt(0).toUpperCase()}</div><div className="record-main"><strong>{item.clientName}</strong><span>{item.service} · {fullDate.format(parseDate(item.serviceDate))}</span></div><div className="record-money"><strong>{money(item.amountCents)}</strong><span>lucro {money(item.profitCents)}</span></div></div>)}</div>
              : <EmptyState icon={<CalendarDays />} title="Seu mês começa aqui" text="Cadastre o primeiro atendimento para acompanhar ganhos e lucro." action="Cadastrar atendimento" onAction={() => setAppointmentOpen(true)} />}
            </section>
          </TabsContent>

          <TabsContent value="atendimentos" className="page-content">
            <PageHeading title="Atendimentos" description="Veja quanto entrou, quanto custou e qual foi o lucro de cada cliente." action="Novo atendimento" onAction={() => setAppointmentOpen(true)} />
            <section className="panel list-panel">{monthAppointments.length ? <div className="data-list">{monthAppointments.map((item) => <article className="data-row" key={item.id}><div className="data-date"><strong>{parseDate(item.serviceDate).getDate()}</strong><span>{fullDate.format(parseDate(item.serviceDate)).split(" ")[2]}</span></div><div className="data-primary"><strong>{item.clientName}</strong><span>{item.service}</span></div><div className="data-metric"><span>Valor</span><strong>{money(item.amountCents)}</strong></div><div className="data-metric"><span>Custo</span><strong>{money(item.totalCostCents)}</strong></div><div className="data-metric data-metric--positive"><span>Lucro</span><strong>{money(item.profitCents)}</strong></div><button className="icon-button" type="button" aria-label={`Excluir atendimento de ${item.clientName}`} onClick={() => setDeleteTarget({ type: "appointments", id: item.id, name: item.clientName })}><Trash2 /></button></article>)}</div>
            : <EmptyState icon={<CalendarDays />} title="Nenhum atendimento neste mês" text="Quando você cadastrar um atendimento, ele aparecerá aqui." action="Cadastrar atendimento" onAction={() => setAppointmentOpen(true)} />}</section>
          </TabsContent>

          <TabsContent value="gastos" className="page-content">
            <PageHeading title="Gastos" description="Registre compras, transporte, aluguel e outras despesas do studio." action="Adicionar gasto" onAction={() => setExpenseOpen(true)} />
            <section className="mini-summary"><span>Total no mês</span><strong>{money(totals.expenses)}</strong></section>
            <section className="panel list-panel">{monthExpenses.length ? <div className="data-list">{monthExpenses.map((item) => <article className="data-row data-row--expense" key={item.id}><div className="category-icon"><ReceiptText /></div><div className="data-primary"><strong>{item.description}</strong><span>{item.category} · {fullDate.format(parseDate(item.expenseDate))}</span></div><div className="data-metric"><span>Valor</span><strong>{money(item.amountCents)}</strong></div><button className="icon-button" type="button" aria-label={`Excluir gasto ${item.description}`} onClick={() => setDeleteTarget({ type: "expenses", id: item.id, name: item.description })}><Trash2 /></button></article>)}</div>
            : <EmptyState icon={<ReceiptText />} title="Nenhum gasto neste mês" text="Adicione as despesas para descobrir seu lucro real." action="Adicionar gasto" onAction={() => setExpenseOpen(true)} />}</section>
          </TabsContent>

          <TabsContent value="produtos" className="page-content">
            <PageHeading title="Produtos" description="Informe o preço e o uso médio. O custo por atendimento é calculado sozinho." action="Cadastrar produto" onAction={() => setProductOpen(true)} />
            {data?.products.length ? <section className="product-grid">{data.products.map((product) => <article className="product-card" key={product.id}><div className="product-card-top"><div className="product-icon"><Box /></div><button className="icon-button" type="button" aria-label={`Excluir produto ${product.name}`} onClick={() => setDeleteTarget({ type: "products", id: product.id, name: product.name })}><Trash2 /></button></div><h2>{product.name}</h2><p>{product.totalAmount} {product.unit} · uso médio de {product.usePerService} {product.unit}</p><div className="product-cost"><span>Custo por atendimento</span><strong>{money(product.costPerUseCents)}</strong></div></article>)}</section>
            : <section className="panel list-panel"><EmptyState icon={<PackagePlus />} title="Cadastre os produtos usados" text="Assim o custo de cada maquiagem será calculado automaticamente." action="Cadastrar produto" onAction={() => setProductOpen(true)} /></section>}
          </TabsContent>
        </>}
      </main>

      <AppointmentDialog open={appointmentOpen} onOpenChange={setAppointmentOpen} products={data?.products ?? []} onSaved={loadData} />
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={loadData} />
      <ProductDialog open={productOpen} onOpenChange={setProductOpen} onSaved={loadData} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} data={data ?? { products: [], appointments: [], expenses: [], settings: { monthlyGoalCents: 500000, reservePercent: 10 } }} onSaved={loadData} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este registro?</AlertDialogTitle><AlertDialogDescription>{deleteTarget ? `“${deleteTarget.name}” será excluído. Essa ação não pode ser desfeita.` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void deleteItem(); }} disabled={saving} className="delete-action">{saving ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Toaster position="top-center" richColors />
    </Tabs>
  );
}

function PageHeading({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) { return <div className="page-heading"><div><h2>{title}</h2><p>{description}</p></div><Button className="secondary-action" onClick={onAction}><Plus /> {action}</Button></div>; }
function EmptyState({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action: string; onAction: () => void }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p><Button variant="outline" onClick={onAction}><Plus /> {action}</Button></div>; }
function LoadingView() { return <div className="page-content loading-view" aria-label="Carregando"><div className="summary-grid">{[0,1,2,3].map((item) => <Skeleton className="h-40 rounded-[24px]" key={item} />)}</div><div className="dashboard-grid"><Skeleton className="h-64 rounded-[24px]" /><Skeleton className="h-64 rounded-[24px]" /></div><Skeleton className="h-72 rounded-[24px]" /></div>; }

function AppointmentDialog({ open, onOpenChange, products, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; products: Product[]; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState<number[]>([]); const [selectedServices, setSelectedServices] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const productCost = products.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.costPerUseCents, 0);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selectedServices.length) { toast.error("Escolha pelo menos um serviço."); return; } const formElement = event.currentTarget; const form = new FormData(formElement); setSaving(true); try { await requestJson("/api/appointments", { method: "POST", body: JSON.stringify({ clientName: form.get("clientName"), service: selectedServices.join(" + "), serviceDate: form.get("serviceDate"), amountCents: cents(String(form.get("amount") ?? "")), extraCostCents: cents(String(form.get("extraCost") ?? "")), paymentFeeCents: cents(String(form.get("paymentFee") ?? "")), productIds: selected }) }); toast.success("Atendimento salvo. O lucro já foi calculado."); formElement.reset(); setSelected([]); setSelectedServices([]); onOpenChange(false); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Novo atendimento</DialogTitle><DialogDescription>Preencha o básico. Os cálculos são feitos automaticamente.</DialogDescription></DialogHeader><form onSubmit={submit} className="form-grid">
    <Field id="clientName" label="Nome da cliente"><input className="field-control" id="clientName" name="clientName" required autoComplete="name" placeholder="Ex.: Fernanda" /></Field>
    <div className="product-picker service-picker"><div className="product-picker-heading"><div><strong>Serviços</strong><span>Marque um ou mais para criar um combo</span></div></div>{SERVICES.map((service) => <label className="product-option service-option" key={service}><Checkbox checked={selectedServices.includes(service)} onCheckedChange={(checked) => setSelectedServices((current) => checked ? [...current, service] : current.filter((item) => item !== service))} /><span>{service}</span></label>)}</div>
    <Field id="serviceDate" label="Data"><input className="field-control" id="serviceDate" name="serviceDate" type="date" defaultValue={todayInput()} required /></Field>
    <Field id="amount" label="Valor cobrado"><div className="money-input"><span>R$</span><input id="amount" name="amount" inputMode="decimal" placeholder="180,00" required /></div></Field>
    <Field id="extraCost" label="Outros custos" hint="Ex.: deslocamento ou cílios"><div className="money-input"><span>R$</span><input id="extraCost" name="extraCost" inputMode="decimal" placeholder="0,00" /></div></Field>
    <Field id="paymentFee" label="Taxa de pagamento" hint="Taxa da maquininha, se houver"><div className="money-input"><span>R$</span><input id="paymentFee" name="paymentFee" inputMode="decimal" placeholder="0,00" /></div></Field>
    <div className="product-picker"><div className="product-picker-heading"><div><strong>Produtos usados</strong><span>Marque o que entrou neste atendimento</span></div><strong>{money(productCost)}</strong></div>{products.length ? products.map((product) => <label className="product-option" key={product.id}><Checkbox checked={selected.includes(product.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /><span>{product.name}</span><strong>{money(product.costPerUseCents)}</strong></label>) : <p className="picker-empty">Nenhum produto cadastrado ainda. Você pode salvar o atendimento mesmo assim.</p>}</div>
    <DialogFooter className="form-footer"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Banknote />} Salvar atendimento</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function ExpenseDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setSaving(true); try { await requestJson("/api/expenses", { method: "POST", body: JSON.stringify({ description: form.get("description"), category: form.get("category"), expenseDate: form.get("expenseDate"), amountCents: cents(String(form.get("expenseAmount") ?? "")) }) }); toast.success("Gasto adicionado."); formElement.reset(); onOpenChange(false); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="form-dialog form-dialog--small"><DialogHeader><DialogTitle>Adicionar gasto</DialogTitle><DialogDescription>Esse valor será descontado do lucro do mês.</DialogDescription></DialogHeader><form onSubmit={submit} className="form-grid">
    <Field id="description" label="Descrição"><input className="field-control" id="description" name="description" required placeholder="Ex.: Reposição de algodão" /></Field>
    <Field id="category" label="Categoria"><Select name="category" required><SelectTrigger id="category" className="field-control"><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger><SelectContent><SelectItem value="Produtos e materiais">Produtos e materiais</SelectItem><SelectItem value="Transporte">Transporte</SelectItem><SelectItem value="Aluguel e contas">Aluguel e contas</SelectItem><SelectItem value="Divulgação">Divulgação</SelectItem><SelectItem value="Outros">Outros</SelectItem></SelectContent></Select></Field>
    <Field id="expenseDate" label="Data"><input className="field-control" id="expenseDate" name="expenseDate" type="date" defaultValue={todayInput()} required /></Field>
    <Field id="expenseAmount" label="Valor"><div className="money-input"><span>R$</span><input id="expenseAmount" name="expenseAmount" inputMode="decimal" placeholder="80,00" required /></div></Field>
    <DialogFooter className="form-footer"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <ReceiptText />} Salvar gasto</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function ProductDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [preview, setPreview] = useState({ price: "", total: "", use: "" });
  const total = Number(preview.total.replace(",", ".")); const use = Number(preview.use.replace(",", "."));
  const previewCost = total > 0 && use > 0 ? Math.round((cents(preview.price) / total) * use) : 0;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setSaving(true); try { await requestJson("/api/products", { method: "POST", body: JSON.stringify({ name: form.get("productName"), purchasePriceCents: cents(String(form.get("productPrice") ?? "")), totalAmount: Number(String(form.get("totalAmount") ?? "").replace(",", ".")), unit: form.get("unit"), usePerService: Number(String(form.get("usePerService") ?? "").replace(",", ".")) }) }); toast.success("Produto cadastrado e custo calculado."); formElement.reset(); setPreview({ price: "", total: "", use: "" }); onOpenChange(false); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>Cadastrar produto</DialogTitle><DialogDescription>Use as informações da embalagem. Não precisa fazer nenhuma conta.</DialogDescription></DialogHeader><form onSubmit={submit} className="form-grid">
    <Field id="productName" label="Nome do produto"><input className="field-control" id="productName" name="productName" required placeholder="Ex.: Base líquida" /></Field>
    <Field id="productPrice" label="Preço pago"><div className="money-input"><span>R$</span><input id="productPrice" name="productPrice" inputMode="decimal" placeholder="80,00" required value={preview.price} onChange={(e) => setPreview({ ...preview, price: e.target.value })} /></div></Field>
    <Field id="totalAmount" label="Quantidade da embalagem"><input className="field-control" id="totalAmount" name="totalAmount" inputMode="decimal" required placeholder="30" value={preview.total} onChange={(e) => setPreview({ ...preview, total: e.target.value })} /></Field>
    <Field id="unit" label="Unidade"><Select name="unit" defaultValue="ml"><SelectTrigger id="unit" className="field-control"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ml">ml</SelectItem><SelectItem value="g">gramas</SelectItem><SelectItem value="un.">unidades</SelectItem></SelectContent></Select></Field>
    <Field id="usePerService" label="Uso médio por atendimento" hint="Uma estimativa já é suficiente"><input className="field-control" id="usePerService" name="usePerService" inputMode="decimal" required placeholder="1" value={preview.use} onChange={(e) => setPreview({ ...preview, use: e.target.value })} /></Field>
    <div className="cost-preview"><span>Custo estimado por atendimento</span><strong>{money(Number.isFinite(previewCost) ? previewCost : 0)}</strong></div>
    <DialogFooter className="form-footer"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <PackagePlus />} Salvar produto</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function SettingsDialog({ open, onOpenChange, data, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; data: StudioData; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await requestJson("/api/settings", { method: "PUT", body: JSON.stringify({ monthlyGoalCents: cents(String(form.get("monthlyGoal") ?? "")), reservePercent: Number(String(form.get("reservePercent") ?? "").replace(",", ".")) }) }); toast.success("Meta e reserva atualizadas."); onOpenChange(false); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="form-dialog form-dialog--small"><DialogHeader><DialogTitle>Meta e reserva</DialogTitle><DialogDescription>Você pode mudar esses valores quando quiser.</DialogDescription></DialogHeader><form onSubmit={submit} className="form-grid">
    <Field id="monthlyGoal" label="Meta de faturamento mensal"><div className="money-input"><span>R$</span><input id="monthlyGoal" name="monthlyGoal" inputMode="decimal" required defaultValue={(data.settings.monthlyGoalCents / 100).toFixed(2).replace(".", ",")} /></div></Field>
    <Field id="reservePercent" label="Porcentagem para reserva" hint="Ex.: 10 significa guardar 10% do faturamento"><div className="percent-input"><input id="reservePercent" name="reservePercent" type="number" min="0" max="100" step="0.5" defaultValue={data.settings.reservePercent} required /><span>%</span></div></Field>
    <div className="backup-box"><div><strong>Backup dos dados</strong><span>Baixe atendimentos, gastos, produtos e configurações em CSV.</span></div><Button type="button" variant="outline" onClick={() => downloadBackup(data)}><Download /> Exportar backup</Button></div>
    <DialogFooter className="form-footer"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Target />} Salvar preferências</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
