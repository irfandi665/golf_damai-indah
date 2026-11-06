import PublicPageShell from '@/components/public/PublicPageShell';
import PricingTable from '@/components/public/PricingTable';

export const metadata = {
  title: 'Rates & Services | Damai Indah Golf',
  description: 'View current green fee rate cards and optional golf services.',
};

export default function PricingPage() {
  return (
    <PublicPageShell
      eyebrow={{ en: 'Plan your round', id: 'Rencanakan ronde Anda' }}
      title={{ en: 'Rates & services', id: 'Harga & layanan' }}
      description={{ en: 'Current green fees and optional services from the club booking system.', id: 'Green fee dan layanan opsional terkini dari sistem booking klub.' }}
    >
      <PricingTable />
    </PublicPageShell>
  );
}
