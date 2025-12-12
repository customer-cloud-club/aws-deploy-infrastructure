'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AccountHeader } from '@/components/account/account-header'
import { SubscriptionCard } from '@/components/billing/subscription-card'
import { UsageCard } from '@/components/billing/usage-card'
import { requireAuth } from '@/lib/auth'
import { getSubscription } from '@/lib/api'

/**
 * Account Page
 *
 * User account management including:
 * - Current subscription plan
 * - Usage statistics
 * - Subscription management (upgrade, cancel)
 * - Billing history
 */
export default function AccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)

  useEffect(() => {
    const loadAccount = async () => {
      try {
        // Require authentication
        const currentUser = await requireAuth()
        if (!currentUser) {
          router.push('/login')
          return
        }

        setUser(currentUser)

        // Load subscription data
        const subData = await getSubscription()
        setSubscription(subData)
      } catch (error) {
        console.error('Failed to load account:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    loadAccount()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Account Header */}
        <AccountHeader user={user} />

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          {/* Subscription Section */}
          <div className="lg:col-span-2 space-y-6">
            <SubscriptionCard subscription={subscription} />
            <UsageCard subscription={subscription} />
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/plans')}
                >
                  Upgrade Plan
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/billing')}
                >
                  Billing History
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/settings')}
                >
                  Account Settings
                </Button>
              </div>
            </div>

            {/* Support */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Need help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our support team is here to assist you.
              </p>
              <Button variant="outline" className="w-full">
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
