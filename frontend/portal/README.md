# End-user Portal

End-user portal for AI Dreams Factory platform.

## Overview

This is a Next.js 14 application that provides:
- User authentication (Cognito with custom UI)
- Plan selection and subscription management
- Stripe payment integration
- Multi-language support (15 languages)
- Responsive design with dark mode

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Authentication**: AWS Amplify (Cognito)
- **Payment**: Stripe Elements
- **i18n**: react-i18next

## Project Structure

```
portal/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Landing page
│   │   ├── login/        # Login page
│   │   ├── register/     # Registration page
│   │   ├── plans/        # Plan selection
│   │   ├── checkout/     # Stripe checkout
│   │   └── account/      # Account management
│   ├── components/       # React components
│   │   ├── ui/          # Base UI components (Radix)
│   │   ├── auth/        # Authentication components
│   │   └── billing/     # Billing components
│   ├── lib/             # Utilities and API clients
│   │   ├── auth.ts      # Cognito authentication
│   │   ├── api.ts       # Platform API client
│   │   └── stripe.ts    # Stripe integration
│   └── locales/         # i18n translations
└── public/              # Static assets
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=ap-northeast-1

# Stripe
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Platform API
NEXT_PUBLIC_API_URL=https://api.aidreams-factory.com
NEXT_PUBLIC_PRODUCT_ID=portal
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pages

### Landing Page (`/`)
- Hero section with value proposition
- Feature highlights
- CTA buttons to sign up or sign in

### Login (`/login`)
- Email/password login
- Social authentication (Google, Microsoft)
- Forgot password link

### Register (`/register`)
- Email/password registration
- Email verification (6-digit code)
- Social authentication

### Plans (`/plans`)
- Display available subscription plans
- Monthly/Annual toggle with discount
- Free, Pro, Enterprise tiers

### Checkout (`/checkout`)
- Stripe Checkout integration
- Order summary
- Redirects to Stripe for payment

### Account (`/account`)
- Current subscription details
- Usage statistics
- Subscription management (upgrade, cancel)
- Quick actions

## Authentication Flow

1. User signs up with email/password or social provider
2. Email verification (if email/password)
3. User logged in automatically
4. JWT token stored in session
5. Token included in API requests via Authorization header

## Payment Flow

1. User selects plan on `/plans`
2. Redirected to `/checkout` with plan ID
3. Backend creates Stripe Checkout Session
4. User redirected to Stripe hosted checkout
5. After payment, redirected back to `/account`
6. Subscription activated in platform

## API Integration

All API calls go through the Platform API (`/lib/api.ts`):

- `getSubscription()` - Get current subscription
- `getEntitlement()` - Check product access
- `recordUsage()` - Track metered usage
- `getBillingHistory()` - Get invoices
- `cancelSubscription()` - Cancel subscription

## Internationalization

Supported languages (15):
- P0: English, Japanese
- P1: Chinese (Simplified/Traditional), Korean, Spanish
- P2: French, German, Portuguese, Arabic
- P3: Hindi, Indonesian, Vietnamese, Thai, Russian

Translation files: `/src/locales/*.json`

## Dark Mode

Automatic dark mode support using `next-themes`:
- System preference detection
- Manual toggle (add ThemeToggle component)
- CSS variables for colors

## Build and Deploy

### Development
```bash
npm run dev
```

### Production build
```bash
npm run build
npm start
```

### Type checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

## Environment

- **Node.js**: 18.x or higher
- **Package Manager**: npm
- **Runtime**: Next.js server (Node.js)

## Design Principles

Following Steve Jobs / Jony Ive standards:
- Intuitive UI (no manual needed)
- 3-click rule (major tasks in ≤3 clicks)
- 60fps animations
- Monochrome + 1 accent color (#0071E3)

## Non-functional Requirements

- **Performance**: LCP < 2.5s, FID < 100ms
- **Security**: PCI DSS SAQ A (Stripe hosted checkout)
- **Accessibility**: WCAG 2.1 AA compliance
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

## Related Documentation

- [Cognito Setup Guide](../../docs/cognito-setup.md)
- [Stripe Integration Guide](../../docs/stripe-integration.md)
- [Platform API Reference](../../docs/api-reference.md)

## License

Proprietary - Customer Cloud Club
