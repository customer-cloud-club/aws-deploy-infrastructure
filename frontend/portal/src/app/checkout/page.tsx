'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckoutForm } from '@/components/billing/checkout-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Shield, CreditCard } from 'lucide-react'
import Link from 'next/link'

/**
 * Checkout Page
 *
 * Stripe Checkout integration for subscription payment.
 * Creates a Checkout Session and redirects to Stripe.
 */
export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan')
  const period = searchParams.get('period')

  const [loading, setLoading] = useState(false)

  // Redirect if no plan selected
  useEffect(() => {
    if (!planId) {
      router.push('/plans')
    }
  }, [planId, router])

  const getPlanDetails = () => {
    const plans: Record<string, { name: string; price: string }> = {
      'free': { name: 'Free', price: '$0' },
      'pro-monthly': { name: 'Pro Monthly', price: '$29' },
      'pro-annual': { name: 'Pro Annual', price: '$279' },
    }
    return plans[planId || 'free'] || plans['free']
  }

  const plan = getPlanDetails()

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Back to Plans */}
        <Link
          href="/plans"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to plans
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Billed {period === 'annual' ? 'annually' : 'monthly'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{plan.price}</p>
                  <p className="text-sm text-muted-foreground">
                    {period === 'annual' ? '/year' : '/month'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{plan.price}</span>
                </div>
              </div>

              {/* Security Badges */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Secure payment with Stripe</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span>PCI DSS compliant</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Payment Details</h2>
            <CheckoutForm planId={planId || 'free'} />
          </div>
        </div>
      </div>
    </div>
  )
}
