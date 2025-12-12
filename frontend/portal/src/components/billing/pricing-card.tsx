import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Pricing Card Component
 *
 * Displays a subscription plan with features and CTA.
 */
interface PricingCardProps {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
  onSelect: () => void
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  highlighted = false,
  onSelect,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border p-8 flex flex-col',
        highlighted && 'ring-2 ring-primary shadow-lg scale-105'
      )}
    >
      {highlighted && (
        <div className="bg-primary text-primary-foreground text-sm font-semibold px-3 py-1 rounded-full self-start mb-4">
          Most Popular
        </div>
      )}

      <h3 className="text-2xl font-bold mb-2">{name}</h3>
      <div className="mb-4">
        <span className="text-4xl font-bold">{price}</span>
        {period && <span className="text-muted-foreground">{period}</span>}
      </div>
      <p className="text-muted-foreground mb-6">{description}</p>

      <ul className="space-y-3 mb-8 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onSelect}
        variant={highlighted ? 'default' : 'outline'}
        className="w-full"
      >
        {cta}
      </Button>
    </div>
  )
}
