'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { createCheckoutSession } from '@/lib/stripe'

/**
 * Checkout Form Component
 *
 * Creates a Stripe Checkout Session and redirects user to Stripe.
 */
export function CheckoutForm({ planId }: { planId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)

    try {
      const { url } = await createCheckoutSession(planId)

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create checkout session.',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Payment Method</h3>
        <p className="text-sm text-muted-foreground">
          You will be redirected to Stripe to securely enter your payment details.
        </p>
      </div>

      <Button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? 'Processing...' : 'Continue to Payment'}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By proceeding, you agree to our Terms of Service and Privacy Policy.
        You can cancel anytime.
      </p>
    </div>
  )
}
