// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/plans/page.js — real pricing from subscription_config,
// never hardcoded, so admin price changes (PricingManagerScreen)
// show up here automatically.

import { createClient } from '@/lib/supabase/server';
import PlanUpgradeButton from '@/components/PlanUpgradeButton';

const FEATURES = {
  starter_biz: [
    'Unlimited bookings', 'Team management', 'Spotlight posts', 'Basic analytics',
  ],
  growth_biz: [
    'Everything in Starter', 'Job assignment to team', 'Recurring contracts',
    'Advanced analytics', '2 admin logins with roles', 'Dedicated account manager',
  ],
  enterprise: [
    'Everything in Growth', 'Multi-location management', 'Consolidated monthly invoicing',
    'SLA guarantee dashboard', 'Verified vendor database', 'API access',
  ],
};

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: plans }, { data: business }] = await Promise.all([
    supabase
      .from('subscription_config')
      .select('plan_key, plan_name, price_usd_web, max_workers')
      .in('plan_key', ['starter_biz', 'growth_biz', 'enterprise'])
      .eq('is_active', true)
      .order('price_usd_web', { ascending: true }),
    supabase
      .from('business_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const currentPlanKey = business?.plan ? `${business.plan}${business.plan === 'enterprise' ? '' : '_biz'}` : 'starter_biz';

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Plans</h1>
        <p className="text-[13px] text-inkMuted mt-1">Pick the plan that matches how your business uses WiamApp.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(plans || []).map((plan, i) => {
          const isCurrent = plan.plan_key === currentPlanKey;
          const isFeatured = plan.plan_key === 'growth_biz';
          return (
            <div
              key={plan.plan_key}
              className={`bg-white rounded-card p-5.5 flex flex-col relative ${isFeatured ? 'border-2 border-gold' : 'border border-line'}`}
            >
              {isFeatured && (
                <div className="absolute -top-[11px] left-5.5 bg-gold text-navy text-[11px] font-bold px-2.5 py-0.5 rounded">Most popular</div>
              )}
              <div className="font-display text-base font-bold">{plan.plan_name.replace(' Business', '')}</div>
              <div className="mt-4 mb-1">
                <span className="font-display text-[30px] font-extrabold">${plan.price_usd_web}</span>
                <span className="text-[13px] text-inkMuted">/month</span>
              </div>
              <div className="text-xs text-inkMuted mb-4.5">
                {plan.max_workers >= 9999 ? 'Unlimited team members' : `Up to ${plan.max_workers} team members`}
              </div>

              {FEATURES[plan.plan_key].map((feat) => (
                <div key={feat} className="flex items-start gap-2 text-[13px] py-1.5">
                  <svg className="w-[15px] h-[15px] text-green mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6"/></svg>
                  {feat}
                </div>
              ))}

              <div className="mt-auto pt-4.5">
                {isCurrent ? (
                  <span className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-green bg-greenTint rounded-lg py-2.5 w-full">
                    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6"/></svg>
                    Current plan
                  </span>
                ) : plan.plan_key === 'enterprise' ? (
                  <button className="w-full border border-line text-ink font-semibold text-sm rounded-lg py-2.5 hover:border-gold">
                    Talk to sales
                  </button>
                ) : (
                  <PlanUpgradeButton
                    planKey={plan.plan_key}
                    userEmail={user.email}
                    className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-2.5 disabled:opacity-60"
                  >
                    Upgrade to {plan.plan_name.replace(' Business', '')}
                  </PlanUpgradeButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
