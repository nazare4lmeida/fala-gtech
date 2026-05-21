# Geração Tech CRM 3.0 🚀

Sistema de gestão de alunos com disparo por e-mail, chat de suporte em tempo real e dashboard de engajamento.

---

## ⚡ Comandos para rodar

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # Edite com suas credenciais reais
npm start              # Produção
# ou
npm run dev            # Desenvolvimento com hot-reload (nodemon)
```

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

O sistema abre automaticamente em **http://localhost:3000**

A porta do suporte ao aluno fica em **http://localhost:3000/suporte**

---

## 🔧 Configuração do .env (backend)

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_KEY` | Service Role Key do Supabase |
| `JWT_SECRET` | Chave secreta para os tokens (qualquer string longa) |
| `EMAIL_USER` | E-mail Gmail para envios |
| `EMAIL_PASS` | **Senha de App** do Gmail (não a senha normal) |
| `PORT` | Porta do backend (padrão: 3001) |

> **Como gerar Senha de App no Gmail:**
> Conta Google → Segurança → Verificação em 2 etapas → Senhas de app

---

## 🗃️ Tabelas necessárias no Supabase

### `usuarios`
```sql
create table usuarios (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  email text not null unique,
  senha text not null,  -- pode ser texto puro (legado) ou bcrypt hash
  created_at timestamptz default now()
);

-- Inserir seu usuário admin (senha em texto puro para início):
insert into usuarios (nome, email, senha)
values ('Seu Nome', 'seu@email.com', 'suasenha123');
```

### `alunos`
```sql
create table alunos (
  id uuid default gen_random_uuid() primary key,
  nome text,
  telefone text,
  curso text,
  email text,
  status text default 'pendente',
  respondeu boolean default false,
  ultima_resposta text,
  data_resposta timestamptz,
  data_envio timestamptz,
  historico jsonb default '[]',
  created_at timestamptz default now()
);
```

### `chat_sessoes`
```sql
create table chat_sessoes (
  id uuid default gen_random_uuid() primary key,
  aluno_nome text not null,
  aluno_telefone text,
  status text default 'aberto',
  created_at timestamptz default now()
);
```

### `chat_mensagens`
```sql
create table chat_mensagens (
  id uuid default gen_random_uuid() primary key,
  sessao_id uuid references chat_sessoes(id) on delete cascade,
  remetente text not null,  -- 'aluno' ou 'admin'
  conteudo text not null,
  created_at timestamptz default now()
);
```

> **Realtime:** Ative nas tabelas `chat_sessoes` e `chat_mensagens` em:
> Supabase → Database → Replication → Tabelas com toggle ativado

---

## 📋 Planilha Excel para importação

A planilha deve ter as colunas (case-insensitive):

| nome | telefone | curso | email |
|------|----------|-------|-------|
| Maria Silva | 85999998888 | Desenvolvimento Web | maria@email.com |

---

## 🔒 WhatsApp (WPPConnect)

O WhatsApp está desabilitado por padrão (comentado no server.js).
Para ativar, descomente o bloco `/* WhatsApp */` no `backend/src/server.js`.

**Requisitos:** Google Chrome instalado na máquina.

---

## 🐛 Correções aplicadas nesta versão

1. **Bug crítico de hooks React** — `useState` era chamado após `return` condicional, quebrando a app
2. **Leitura de formulário via `document.getElementById`** — substituído por estado React controlado
3. **Express 5** (breaking changes) → rebaixado para Express 4 estável
4. **Senha em texto puro** — login agora suporta bcrypt com fallback legado
5. **`supabaseClient.js` ausente** — arquivo estava sendo importado mas não existia no projeto original
6. **Chat sem scroll automático** — corrigido com `useRef` + `scrollIntoView`
7. **Chat sem badge de não lidas** — adicionado contador por sessão
8. **Dashboard sem barras de progresso** — adicionadas métricas visuais e distribuição por status
9. **Assunto/corpo do e-mail perdidos** — agora controlados por estado React
10. **`PORT=3001=` no .env** — caractere `=` extra removido
