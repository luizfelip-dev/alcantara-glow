# Alcântara Glow

**Gestão financeira simples e inteligente para profissionais da beleza.**

[Acessar o Alcântara Glow](https://luizfelip-dev.github.io/alcantara-glow/)

## Sobre o projeto

O Alcântara Glow é uma aplicação web criada para facilitar o controle financeiro de um studio de maquiagem. Em uma interface intuitiva e responsiva, a profissional consegue acompanhar atendimentos, custos, despesas, faturamento, lucro, metas e reserva mensal.

O projeto foi pensado para funcionar com a mesma facilidade no computador e no celular, sem exigir conhecimentos técnicos ou cálculos manuais.

## Principais funcionalidades

- Cadastro de atendimentos por cliente e data.
- Serviços de maquiagem express, maquiagem social e penteado simples.
- Criação de combos selecionando mais de um serviço.
- Cálculo automático do custo e do lucro de cada atendimento.
- Cadastro de produtos e cálculo do custo médio por uso.
- Controle de despesas por categoria.
- Resumo mensal de faturamento, lucro, gastos e ticket médio.
- Meta de faturamento com acompanhamento do progresso.
- Cálculo de reserva financeira por porcentagem.
- Navegação entre diferentes meses.
- Exportação dos dados em arquivo CSV.
- Experiência adaptada para desktop e dispositivos móveis.

## Organização financeira

Os valores apresentados no painel são calculados automaticamente a partir dos registros cadastrados:

- **Faturamento:** soma dos valores recebidos nos atendimentos do mês.
- **Custos:** produtos utilizados, taxas de pagamento e outros custos informados.
- **Lucro:** faturamento menos custos dos atendimentos e despesas gerais.
- **Ticket médio:** valor médio recebido por atendimento.
- **Reserva:** porcentagem do faturamento destinada à organização financeira.

## Tecnologia

| Área | Tecnologia |
| --- | --- |
| Interface | React e TypeScript |
| Build | Vite |
| Autenticação | Supabase Auth |
| Banco de dados | Supabase PostgreSQL |
| Hospedagem | GitHub Pages |
| Publicação | GitHub Actions |

## Segurança e privacidade

Cada pessoa acessa o sistema com seu próprio e-mail e senha. Os registros são vinculados ao identificador da conta autenticada e protegidos por políticas de **Row Level Security (RLS)**.

Isso garante que cada conta visualize e altere somente seus próprios atendimentos, produtos, despesas e configurações. Os dados financeiros ficam armazenados no Supabase e não no repositório do GitHub.

## Status

Projeto em produção e disponível em:

**https://luizfelip-dev.github.io/alcantara-glow/**
