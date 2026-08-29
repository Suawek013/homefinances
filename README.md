<div align="center">

# 💰 HomeFinances

### Modern Household & Personal Wealth Management Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-homefinances.lovable.app-00C7B7?style=for-the-badge&logo=vercel&logoColor=white)](https://homefinances.lovable.app/)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TanStack](https://img.shields.io/badge/TanStack_Start_%26_Router-FF4154?style=for-the-badge&logo=react-query&logoColor=white)](https://tanstack.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

<p align="center">
  <b>A full-stack, real-time financial tracking application designed for individuals and shared households.</b><br>
  Track cash flow, manage recurring subscriptions, scan receipts, and gain deep insights into your spending habits.
</p>

[🌐 **Explore Live Demo**](https://homefinances.lovable.app/) • [✨ Features](#-key-features) • [🛠️ Tech Stack](#-tech-stack) • [🚀 Quick Start](#-quick-start) • [🗄️ Database Setup](#-database--supabase-setup)

---

</div>

## 📖 Overview

**HomeFinances** is a comprehensive personal finance dashboard and collaborative household budget tracker. Built with modern full-stack technologies (**TanStack Start**, **React 19**, **TypeScript**, and **Supabase**), it provides complete control over your financial health with real-time balance calculations, multi-member collaboration, subscription tracking, and rich visual analytics.

---

## ✨ Key Features

### 📊 Real-Time Financial Dashboard
- **Cash Flow Overview**: Live summary of total balance, monthly income, total expenses, and net savings rate.
- **Visual Analytics**: Interactive category donut charts, income vs. expense trends, and monthly breakdown powered by **Recharts**.
- **Recent Transactions Feed**: Quick access to recent activity with category icons, tags, and member indicators.

### 👥 Collaborative Household Budgeting
- **Multi-Member Households**: Create a shared household or join existing ones using a secure 6-character invite code.
- **Shared vs. Personal Splitting**: Assign expenses to specific members or split household costs evenly.
- **Role-Based Access**: Safe data separation with Supabase Row-Level Security (RLS).

### 🔁 Recurring Expenses & Subscriptions
- **Subscription Management**: Monitor recurring bills, SaaS subscriptions, utilities, and rent.
- **Renewal Alerts**: Track upcoming billing dates, renewal cycles (monthly, yearly, weekly), and total fixed monthly commitments.
- **Auto-Calculated Impact**: Projected fixed overhead vs. discretionary spending.

### 🏷️ Customizable Categories & Budgets
- **Category Manager**: Create custom categories with tailored colors and Lucide icons.
- **Budget Thresholds**: Set spending limits per category and track budget health in real-time.

### 🧾 Receipts Scanner & Storage
- **Digital Receipt Vault**: Upload and store receipts directly linked to individual transaction logs.
- **AI-Powered OCR Ready**: Structure ready for automated merchant, date, and amount extraction.

### 🌐 Internationalization & Localization
- **Multi-Language Support**: Seamless runtime switching between **English (EN)** and **Polish (PL)**.
- **Localized Formatting**: Multi-currency formatting, localized dates (`date-fns`), and locale-aware number parsing.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) / [Vite](https://vitejs.dev/) |
| **Frontend Library** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Routing & Queries** | [TanStack Router](https://tanstack.com/router) & [TanStack Query v5](https://tanstack.com/query) |
| **Backend & DB** | [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Auth, Storage) |
| **UI Components** | [Radix UI Primitives](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), [Sonner Toasts](https://sonner.emilkowal.ski/), [Vaul Drawer](https://vaul.emilkowal.ski/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Custom Design Tokens |
| **Charts** | [Recharts](https://recharts.org/) |
| **Validation** | [Zod](https://zod.dev/) + [React Hook Form](https://react-hook-form.com/) |
| **Deployment** | [Lovable](https://lovable.app/) / [Cloudflare Nitro](https://nitro.unjs.io/) |

---

## 🏗️ Architecture & Project Structure

```text
homefinances/
├── src/
│   ├── components/        # Reusable UI components (Radix + Tailwind)
│   │   ├── ui/            # Buttons, dialogs, dropdowns, inputs, forms
│   │   └── CategoryDonut.tsx # Recharts interactive spending breakdown
│   ├── hooks/             # Custom React hooks (auth, household, queries)
│   ├── integrations/      # Supabase client & auto-generated DB types
│   ├── lib/               # Utility functions, i18n engine, helpers
│   ├── routes/            # TanStack file-based routes
│   │   ├── __root.tsx     # Root layout with providers & global toasts
│   │   ├── login.tsx      # Authentication (Sign In / Sign Up)
│   │   └── _authenticated/ # Protected routes
│   │       ├── index.tsx       # Main financial dashboard
│   │       ├── add.tsx         # Fast transaction creator
│   │       ├── household.tsx   # Household management & invite codes
│   │       ├── categories.tsx  # Custom categories configuration
│   │       ├── receipts.tsx    # Receipt capture and viewer
│   │       └── recurring.tsx   # Subscriptions & recurring expenses
│   ├── server.ts          # Server-side entry & SSR handlers
│   └── styles.css         # Tailwind CSS v4 design system
└── supabase/              # Database schemas, migrations & policies
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended) or [Bun](https://bun.sh/)
- A free [Supabase](https://supabase.com/) project

### 1. Clone the repository
```bash
git clone https://github.com/Suawek013/homefinances.git
cd homefinances
```

### 2. Install dependencies
```bash
npm install
# or
bun install
```

### 3. Configure environment variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the development server
```bash
npm run dev
# or
bun dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Database & Supabase Setup

HomeFinances uses Supabase for database storage, real-time sync, and row-level security:

1. Create a new Supabase project at [database.new](https://database.new).
2. Enable **Email Auth** under Authentication settings.
3. Run the SQL schema files located in `supabase/` to create the required tables:
   - `profiles` (User metadata & currency preferences)
   - `households` & `household_members` (Collaborative multi-user groups)
   - `categories` (Custom spending & income categories)
   - `transactions` (Income, expense, and transfer records)
   - `recurring_transactions` (Subscriptions and scheduled commitments)
   - `receipts` (Receipt metadata and Supabase Storage attachments)

---

## 🔒 Security & Privacy

- **Row Level Security (RLS)**: Users can strictly only access transactions and data belonging to themselves or their active household members.
- **Secure Authentication**: Managed securely via Supabase JWT tokens.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ by Sławomir Sojka · Live at <a href="https://homefinances.lovable.app/">homefinances.lovable.app</a></sub>
</div>
