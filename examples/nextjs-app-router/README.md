# Platform SDK - Next.js App Router Example

This example demonstrates how to integrate the Platform SDK with Next.js 14 App Router.

## Features

- Authentication with Cognito
- Feature flags and entitlement checking
- Usage tracking and limits
- Plans page with pricing
- Protected dashboard

## Prerequisites

- Node.js 18+
- GitHub account (for package access)
- Platform API access

## Setup

### 1. Install dependencies

First, configure npm to use GitHub Packages:

```bash
# Create .npmrc
echo "@customer-cloud-club:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc

# Set your GitHub token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Install
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_PLATFORM_API_URL=https://your-api-url.amazonaws.com/dev
NEXT_PUBLIC_PLATFORM_PRODUCT_ID=your_product_id
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
.
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx    # OAuth callback handler
│   ├── dashboard/
│   │   └── page.tsx        # Protected dashboard
│   ├── plans/
│   │   └── page.tsx        # Plans/pricing page
│   └── api/
│       └── auth/
│           └── callback/
│               └── route.ts # API route for OAuth
├── components/
│   ├── PlatformProvider.tsx # SDK context provider
│   ├── Header.tsx          # Navigation header
│   └── FeatureGate.tsx     # Feature/limit gate components
└── lib/
    └── platform.ts         # SDK helper functions
```

## Key Components

### PlatformProvider

Wraps your app and provides SDK context:

```tsx
import { PlatformProvider, usePlatform } from '@/components/PlatformProvider';

// In layout.tsx
<PlatformProvider>
  {children}
</PlatformProvider>

// In any component
function MyComponent() {
  const { user, entitlement, login, logout } = usePlatform();
}
```

### FeatureGate

Show content based on feature flags:

```tsx
import { FeatureGate } from '@/components/FeatureGate';

<FeatureGate
  feature="premium_feature"
  fallback={<UpgradePrompt />}
>
  <PremiumContent />
</FeatureGate>
```

### UsageLimitGate

Check usage limits before showing content:

```tsx
import { UsageLimitGate } from '@/components/FeatureGate';

<UsageLimitGate
  limitType="apiCalls"
  fallback={<LimitExceeded />}
>
  <ActionButton />
</UsageLimitGate>
```

## Authentication Flow

1. User clicks "Login" button
2. Redirected to Cognito Hosted UI
3. After login, redirected to `/api/auth/callback`
4. API route redirects to `/auth/callback` with code
5. Client-side page exchanges code for tokens
6. User redirected to dashboard

## Usage Tracking

Record usage from any component:

```tsx
import { PlatformSDK } from '@/lib/platform';

// Record API call
await PlatformSDK.incrementUsage('api_call');

// Record with custom amount
await PlatformSDK.recordUsage(100, 'tokens');

// Batch recording
await PlatformSDK.recordUsageBatch([
  { type: 'generation', amount: 1 },
  { type: 'tokens', amount: 1500 },
]);
```

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Build the production version:

```bash
npm run build
npm start
```

## Related Documentation

- [Quick Start Guide](../../docs/sdk/quick-start.md)
- [Integration Guide](../../docs/sdk/integration-guide.md)
- [API Reference](../../docs/sdk/api-reference.md)
- [Troubleshooting](../../docs/sdk/troubleshooting.md)
