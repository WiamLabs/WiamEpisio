// © 2026 WiamApp. Powered by WiamLabs
// app/business/page.js — explains WiamApp Business, links to the
// real application flow on the Business Web portal's own domain.

export const metadata = {
  title: 'WiamApp Business — manage your team and bookings',
  description: 'A dashboard built for companies hiring workers regularly — team management, billing, analytics, and contracts, not just one-off bookings.',
};

const TIERS = [
  { name: 'Starter', price: 20, limit: 'Up to 5 team members', features: ['Unlimited bookings', 'Team management', 'Spotlight posts', 'Basic analytics'] },
  { name: 'Growth', price: 40, limit: 'Up to 25 team members', featured: true, features: ['Everything in Starter', 'Job assignment', 'Recurring contracts', 'Advanced analytics', 'Dedicated account manager'] },
  { name: 'Enterprise', price: 95, limit: 'Unlimited team members', features: ['Everything in Growth', 'Multi-location', 'Consolidated invoicing', 'SLA dashboard', 'Vendor database', 'API access'] },
];

export default function BusinessPage() {
  return (
    <div>
      <section className="bg-navy">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="inline-block text-[11px] font-bold tracking-wide text-navy bg-gold px-3 py-1 rounded-md mb-5">WiamApp Business</div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4 max-w-2xl mx-auto leading-tight">
            One dashboard for your whole team's bookings, billing, and trusted workers.
          </h1>
          <p className="text-white/65 text-[15px] max-w-xl mx-auto mb-8">
            For companies that hire workers regularly — hotels, offices, schools, restaurants. Manage everything from a laptop, not a phone.
          </p>
          <a href="/business/apply" className="inline-block bg-gold text-navy font-semibold text-sm px-7 py-3.5 rounded-lg">
            Apply for a Business account
          </a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-display text-2xl font-bold text-ink text-center mb-10">Built for how real companies work</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'Keep a trusted team', desc: 'Build a roster of workers you rebook again and again — electrician, cleaner, security, all in one place.' },
            { title: 'One bill, not many', desc: 'Real invoices, payment history, and a saved card — see exactly what your company spent and when.' },
            { title: 'Manage from a laptop', desc: 'A full dashboard built for an office desk — team, bookings, analytics — not squeezed into a phone screen.' },
          ].map((item) => (
            <div key={item.title} className="border border-line rounded-card p-6">
              <div className="font-semibold text-[15px] text-ink mb-2">{item.title}</div>
              <p className="text-[13px] text-inkMuted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-paper py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-display text-2xl font-bold text-ink text-center mb-10">Plans for any size company</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`bg-white rounded-card p-6 relative ${tier.featured ? 'border-2 border-gold' : 'border border-line'}`}>
                {tier.featured && <div className="absolute -top-3 left-6 bg-gold text-navy text-[11px] font-bold px-2.5 py-0.5 rounded">Most popular</div>}
                <div className="font-display text-lg font-bold">{tier.name}</div>
                <div className="mt-3 mb-1"><span className="font-display text-3xl font-extrabold">${tier.price}</span><span className="text-[13px] text-inkMuted">/month</span></div>
                <div className="text-[12px] text-inkMuted mb-5">{tier.limit}</div>
                {tier.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-[13px] py-1.5">
                    <svg className="w-[15px] h-[15px] text-green mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" /></svg>
                    {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-ink mb-3">Ready to set up your account?</h2>
        <p className="text-inkMuted text-[14px] mb-7">Takes about 5 minutes. Your team can start booking right away — your Gold checkmark review usually finishes within 24–48 hours.</p>
        <a href="/business/apply" className="inline-block bg-navy text-white font-semibold text-sm px-7 py-3.5 rounded-lg">
          Apply for a Business account
        </a>
      </section>
    </div>
  );
}
