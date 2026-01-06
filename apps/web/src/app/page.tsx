import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight">NBA DFS Optimizer</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Professional DFS research and lineup optimization platform
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Slates"
          description="Manage DraftKings slates and player pools"
          href="/slates"
        />
        <DashboardCard
          title="Optimizer"
          description="Build optimized lineups with stacking support"
          href="/optimizer"
        />
        <DashboardCard
          title="Research"
          description="Historical data, matchups, and usage analysis"
          href="/research"
        />
        <DashboardCard
          title="AI Assistant"
          description="Chat with specialized DFS agents"
          href="/chat"
        />
        <DashboardCard
          title="Lineups"
          description="View and manage saved lineups"
          href="/lineups"
        />
        <DashboardCard
          title="Backtest"
          description="Analyze projection accuracy"
          href="/backtest"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-6 rounded-lg border bg-card hover:bg-accent transition-colors"
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
