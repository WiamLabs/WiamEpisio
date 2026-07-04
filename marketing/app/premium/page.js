// © 2026 WiamApp. Powered by WiamLabs
// app/premium/page.js — subscription pricing for individual workers.
// Pricing pulled live, never hardcoded, so an admin price change in
// PricingManagerScreen shows up here automatically.

export const metadata = {
  title: 'Pricing for workers',
  description: 'Lower commission, more visibility, and a shorter path to earning your WiamApp Checkmark badge.',
};

const PLANS = [
  {
    key: 'free', name: 'Free', price: 0, commission: '15%',
    features: ['Appear in search', 'Accept bookings', 'Standard placement'],
  },
  {
    key: 'basic', name: 'Basic', price: 2.5, commission: '10%',
    features: ['Lower bar to earn the Checkmark', 'Higher search placement', 'Spotlight access', 'Basic analytics'],
  },
  {
    key: 'pro', name: 'Pro', price: 7, commission: '7%', featured: true,
    features: ['Lowest bar to earn the Checkmark', 'TOP search placement', 'Advanced analytics', '5 free Spotlight boosts/mo', 'Featured in Top Rated'],
  },
];

export default function PremiumPage() {

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="text-center mb-12">
        <h1 className="font-display text-3xl font-bold text-ink mb-3">Grow faster on WiamApp</h1>
        <p className="text-inkMuted text-[15px] max-w-lg mx-auto">
          Upgrade to lower your commission, unlock Spotlight, and shorten the climb to earning your Checkmark badge.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-12">
        {PLANS.map((plan) => (
          <div key={plan.key} className={`rounded-card p-6 ${plan.featured ? 'border-2 border-gold relative' : 'border border-line'}`}>
            {plan.featured && (
              <div className="absolute -top-3 left-6 bg-gold text-navy text-[11px] font-bold px-2.5 py-0.5 rounded">Most popular</div>
            )}
            <div className="font-display text-lg font-bold">{plan.name}</div>
            <div className="mt-3 mb-1">
              <span className="font-display text-3xl font-extrabold">${plan.price}</span>
              <span className="text-[13px] text-inkMuted">/month</span>
            </div>
            <div className="text-[12px] text-inkMuted mb-5">{plan.commission} commission per job</div>
            {plan.features.map((f) => (
              <div key={f} className="flex items-start gap-2 text-[13px] py-1.5">
                <svg className="w-[15px] h-[15px] text-green mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" /></svg>
                {f}
              </div>
            ))}
            <a
              href="/register?role=worker"
              className={`block text-center font-semibold text-sm rounded-lg py-3 mt-5 ${plan.featured ? 'bg-gold text-navy' : 'border border-line text-ink'}`}
            >
              Get started
            </a>
          </div>
        ))}
      </div>

      <div className="bg-paper border border-line rounded-card p-7 max-w-2xl mx-auto text-center">
        <h2 className="font-display text-lg font-bold text-ink mb-2">The Checkmark badge is earned, not bought</h2>
        <p className="text-[13.5px] text-inkMuted leading-relaxed">
          Subscribing lowers how far you have to go — it never grants the badge directly. Free workers can earn it too, through a sustained track record of completed jobs and great ratings. That's what makes it mean something to customers.
        </p>
      </div>
    </div>
  );
}
