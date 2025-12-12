import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogIn, Sparkles } from 'lucide-react'

/**
 * Landing Page
 *
 * Main landing page showcasing the platform value proposition
 * and guiding users to sign up or log in.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Sparkles className="w-12 h-12 text-primary" />
            </div>
          </div>

          <h1 className="text-5xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            One Account.<br />1,000+ AI Products.
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Access the entire AI Dreams Factory ecosystem with a single account.
            Just like Google, but for AI-powered tools.
          </p>

          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <FeatureCard
            title="Unified Authentication"
            description="Sign in once, access all AI products. Support for Google, Microsoft, and SAML."
          />
          <FeatureCard
            title="Flexible Pricing"
            description="Choose from free, pro, or enterprise plans. Pay-as-you-go options available."
          />
          <FeatureCard
            title="Global Scale"
            description="Available in 15 languages. 99.99% uptime SLA. Enterprise-grade security."
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 AI Dreams Factory. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

/**
 * Feature Card Component
 */
function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
