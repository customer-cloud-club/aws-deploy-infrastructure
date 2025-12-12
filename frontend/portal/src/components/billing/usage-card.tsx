import { Progress } from '@/components/ui/progress'

/**
 * Usage Card Component
 *
 * Displays API usage statistics for the current billing period.
 */
export function UsageCard({ subscription }: { subscription: any }) {
  if (!subscription?.usage) {
    return null
  }

  const { used, limit } = subscription.usage
  const percentage = (used / limit) * 100

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Usage This Month</h3>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">API Requests</span>
            <span className="text-sm font-medium">
              {used.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {percentage > 80 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              You&apos;ve used {percentage.toFixed(0)}% of your monthly quota.
              Consider upgrading your plan for more requests.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
