# Alcântara Glow

Controle financeiro responsivo para registrar atendimentos, produtos, gastos, lucro, metas e reserva mensal.

## Tecnologias

- React + TypeScript + Vite
- Supabase Auth e PostgreSQL
- GitHub Pages

## Segurança

Os dados financeiros não ficam no GitHub. O banco usa Row Level Security (RLS), e cada conta autenticada acessa somente os próprios registros. Nunca adicione uma chave `service_role` ao projeto ou ao navegador.

## Configuração local

O projeto já está conectado ao Supabase. Rode `npm install` e `npm run dev`.

O deploy no GitHub Pages acontece automaticamente a cada atualização da branch `main` e também pode ser iniciado manualmente em **Actions > Publicar no GitHub Pages**.
