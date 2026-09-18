# Alcântara Glow

Controle financeiro responsivo para registrar atendimentos, produtos, gastos, lucro, metas e reserva mensal.

## Tecnologias

- React + TypeScript + Vite
- Supabase Auth e PostgreSQL
- GitHub Pages

## Segurança

Os dados financeiros não ficam no GitHub. O banco usa Row Level Security (RLS), e cada conta autenticada acessa somente os próprios registros. Nunca adicione uma chave `service_role` ao projeto ou ao navegador.

## Configuração

1. Crie um projeto no Supabase.
2. Execute `supabase/migrations/0001_initial_schema.sql` no banco.
3. Copie `.env.example` para `.env` e informe a URL e a chave publicável do projeto.
4. Rode `npm install` e `npm run dev`.

Para publicar pelo workflow, crie no repositório as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` e execute **Publicar no GitHub Pages** em Actions.
