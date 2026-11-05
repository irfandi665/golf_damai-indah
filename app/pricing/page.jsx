import PublicPageShell from '@/components/public/PublicPageShell';
import PricingTable from '@/components/public/PricingTable';

export const metadata = {
  title: 'Rates & Services | Damai Indah Golf',
  description: 'View current green fee rate cards and optional golf services.',
};

export default function PricingPage() {
  return (
    <PublicPageShell
      eyebrow="Plan your round"
      title="Rates & services"
      description="Current green fees and optional services from the club booking system."
    >
      <PricingTable />
    </PublicPageShell>
  );
}
