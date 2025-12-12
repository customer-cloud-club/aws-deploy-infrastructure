'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PricingCard } from '@/components/billing/pricing-card'
import { Check } from 'lucide-react'

/**
 * Plans Page
 *
 * Display available subscription plans and allow users to select one.
 * Redirects to checkout page with selected plan.
 */
export default function PlansPage() {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')

  const handleSelectPlan = (planId: string) => {
    router.push(`/checkout?plan=${planId}&period=${billingPeriod}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose your plan</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Access all AI Dreams Factory products with one subscription
          </p>

          {/* Billing Period Toggle */}
          <div className="inline-flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Button
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={billingPeriod === 'annual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('annual')}
            >
              Annual
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                Save 20%
              </span>
            </Button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <PricingCard
            name="Free"
            price={billingPeriod === 'monthly' ? '$0' : '$0'}
            period={billingPeriod === 'monthly' ? '/month' : '/year'}
            description="Perfect for trying out our AI products"
            features={[
              'Access to basic AI tools',
              '10 requests per day',
              'Community support',
              'Basic analytics',
            ]}
            cta="Get Started"
            onSelect={() => handleSelectPlan('free')}
          />

          {/* Pro Plan */}
          <PricingCard
            name="Pro"
            price={billingPeriod === 'monthly' ? '$29' : '$279'}
            period={billingPeriod === 'monthly' ? '/month' : '/year'}
            description="For professionals and power users"
            features={[
              'Access to all AI products',
              'Unlimited requests',
              'Priority support',
              'Advanced analytics',
              'API access',
              'Custom integrations',
            ]}
            cta="Start Free Trial"
            highlighted
            onSelect={() => handleSelectPlan('pro-' + billingPeriod)}
          />

          {/* Enterprise Plan */}
          <PricingCard
            name="Enterprise"
            price="Custom"
            period=""
            description="For teams and organizations"
            features={[
              'Everything in Pro',
              'Dedicated account manager',
              'Custom SLA',
              'SSO / SAML',
              'Advanced security',
              'Training & onboarding',
            ]}
            cta="Contact Sales"
            onSelect={() => router.push('/contact')}
          />
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <FAQItem
              question="Can I change my plan later?"
              answer="Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately."
            />
            <FAQItem
              question="What payment methods do you accept?"
              answer="We accept all major credit cards (Visa, MasterCard, American Express) and support international payments through Stripe."
            />
            <FAQItem
              question="Is there a free trial?"
              answer="Yes, Pro plan comes with a 14-day free trial. No credit card required."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * FAQ Item Component
 */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
      <h3 className="font-semibold mb-2">{question}</h3>
      <p className="text-muted-foreground">{answer}</p>
    </div>
  )
}
