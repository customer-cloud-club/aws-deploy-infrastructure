import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard } from 'lucide-react'

/**
 * Subscription Card Component
 *
 * Displays current subscription details.
 */
export function SubscriptionCard({ subscription }: { subscription: any }) {
  if (!subscription) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <p className="text-muted-foreground">No active subscription</p>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      canceled: 'destructive',
      past_due: 'destructive',
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{subscription.plan_name}</span>
            {getStatusBadge(subscription.status)}
          </div>
        </div>
        <CreditCard className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="font-medium">
            ${subscription.price}/{subscription.billing_period}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Next billing date</span>
          <span className="font-medium">
            {new Date(subscription.next_billing_date).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1">
          Update Payment
        </Button>
        <Button variant="outline" className="flex-1">
          Cancel Subscription
        </Button>
      </div>
    </div>
  )
}
