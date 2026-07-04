// © 2026 WiamApp. Powered by WiamLabs
// app/terms/page.js

export const metadata = {
  title: 'Terms of Service',
  description: 'WiamApp terms of service — how the platform works, what we expect from users, and how disputes are handled.',
};

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-[17px] font-bold text-ink mb-3">{title}</h2>
      <div className="text-[13.5px] text-inkMuted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="font-display text-2xl font-bold text-ink mb-2">Terms of Service</h1>
      <p className="text-[13px] text-inkMuted mb-10">Last updated: June 2026</p>

      <Section title="1. What WiamApp is">
        <p>WiamApp is a marketplace operated by WiamLabs that connects customers with independent service workers — electricians, cleaners, plumbers, drivers, and others. WiamApp is not an employer and workers are not employees of WiamApp.</p>
        <p>By creating an account or using the platform, you agree to these terms. If you don't agree, you may not use WiamApp.</p>
      </Section>

      <Section title="2. Accounts">
        <p>You must be at least 18 years old to create an account. You are responsible for all activity under your account. Keep your password secure — if you suspect unauthorised access, notify us immediately at support@wiamapp.com.</p>
        <p>Workers must pass our identity verification process before they can accept bookings. Customers who have not verified their identity may be limited on certain features.</p>
      </Section>

      <Section title="3. Bookings and payments">
        <p>When you book a worker through WiamApp, your payment is held securely until the job is confirmed as complete — it is never released to the worker upfront. Once you confirm completion (or 24 hours after a job's scheduled completion time without dispute), the payment is released to the worker minus WiamApp's platform commission.</p>
        <p>Prices shown are in the currency agreed at booking. WiamApp charges a commission on each completed transaction, deducted from the worker's payout. Commission rates vary by subscription tier.</p>
      </Section>

      <Section title="4. Emergency jobs">
        <p>Emergency bookings are dispatched to verified workers nearby who are actively online. Accepting an emergency job creates a binding commitment — repeated cancellations after acceptance may result in reduced emergency-job access or account suspension.</p>
      </Section>

      <Section title="5. Reviews and ratings">
        <p>Customers may leave one review per completed booking. Reviews must be honest and based on your own experience. We reserve the right to remove reviews that are abusive, fraudulent, or unrelated to the service provided.</p>
      </Section>

      <Section title="6. Prohibited conduct">
        <p>You must not: share contact details or arrange payment outside WiamApp; create fake accounts or reviews; harass, threaten, or discriminate against any user; use the platform for any illegal purpose.</p>
        <p>Our AI moderation system flags messages that attempt to move transactions off-platform. Repeated violations result in account suspension and, for serious incidents, referral to the appropriate authorities.</p>
      </Section>

      <Section title="7. Disputes">
        <p>If there is a problem with a completed job, raise a dispute within 24 hours of the scheduled completion time. WiamApp will review evidence from both parties and make a final decision on payment release. WiamApp's dispute decision is final within the platform.</p>
      </Section>

      <Section title="8. Business accounts">
        <p>Business accounts must submit valid registration documents and are subject to additional review before the Gold verification badge is granted. The badge may be removed if documents are found to be fraudulent or if the business account violates these terms.</p>
      </Section>

      <Section title="9. Termination">
        <p>We may suspend or terminate your account for serious or repeated violations of these terms, without notice if necessary to protect users or the platform. You may delete your account at any time from Settings — see our Privacy Policy for what happens to your data.</p>
      </Section>

      <Section title="10. Liability">
        <p>WiamApp provides the platform that connects customers and workers but is not responsible for the quality of work performed, damage caused during a job, or disputes that cannot be resolved through our platform. We strongly recommend that you exercise your own judgement when booking.</p>
        <p>To the extent permitted by Ghanaian law, WiamApp's liability to you is limited to the amount you paid for the relevant booking.</p>
      </Section>

      <Section title="11. Governing law">
        <p>These terms are governed by the laws of the Republic of Ghana. Any dispute not resolved through our platform dispute process shall be subject to the jurisdiction of the courts of Ghana.</p>
      </Section>

      <Section title="12. Changes to these terms">
        <p>We may update these terms and will notify users by email and in-app notification before material changes take effect. Continued use of WiamApp after changes take effect constitutes acceptance of the updated terms.</p>
      </Section>

      <div className="border-t border-line pt-6 mt-8">
        <p className="text-[12.5px] text-inkFaint">Questions? Contact us at <a href="mailto:legal@wiamapp.com" className="text-gold">legal@wiamapp.com</a></p>
      </div>
    </div>
  );
}
