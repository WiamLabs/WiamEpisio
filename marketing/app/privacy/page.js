// © 2026 WiamApp. Powered by WiamLabs
// app/privacy/page.js — includes data deletion section (covers
// Apple/Google's in-app purchase data deletion requirement too).

export const metadata = {
  title: 'Privacy Policy',
  description: 'What data WiamApp collects, how it is used, and how to delete your account and data.',
};

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-[17px] font-bold text-ink mb-3">{title}</h2>
      <div className="text-[13.5px] text-inkMuted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="font-display text-2xl font-bold text-ink mb-2">Privacy Policy</h1>
      <p className="text-[13px] text-inkMuted mb-10">Last updated: June 2026</p>

      <Section title="1. Who we are">
        <p>WiamApp is operated by WiamLabs, based in Ghana. We are the data controller for information collected through the WiamApp mobile app and web services.</p>
        <p>Questions or requests about your data: <a href="mailto:privacy@wiamapp.com" className="text-gold">privacy@wiamapp.com</a></p>
      </Section>

      <Section title="2. What data we collect">
        <p><strong className="text-ink">Account data:</strong> name, email, phone number, city, and profile photo. For workers: identity documents (Ghana Card or equivalent) and a verification selfie. For businesses: company registration documents and TIN certificate.</p>
        <p><strong className="text-ink">Booking data:</strong> services booked, dates, locations, prices paid, and payment references. Payment card details are handled directly by Paystack and never stored on WiamApp's servers.</p>
        <p><strong className="text-ink">Location data:</strong> approximate location when searching for workers nearby, and — for emergency jobs only — precise location to dispatch the nearest available worker. We do not track location continuously.</p>
        <p><strong className="text-ink">Messages:</strong> text messages sent through the WiamApp chat are scanned by AI to detect off-platform contact attempts. Voice messages are stored but not transcribed in our current system.</p>
        <p><strong className="text-ink">Device and usage data:</strong> device type, OS version, crash logs, and usage analytics to improve the app. We do not sell this data.</p>
      </Section>

      <Section title="3. How we use your data">
        <p>To provide the service — match bookings, process payments, send notifications.</p>
        <p>To verify identity — Ghana Card / selfie checks are run through our identity verification partner to ensure every worker meets our safety standard before they can accept jobs.</p>
        <p>To calculate your Eligibility Score — a nightly calculation using your completed jobs, ratings, and account history that determines whether you hold the WiamApp Checkmark badge. No personal data is shared externally for this.</p>
        <p>To comply with Ghanaian law — we retain financial transaction records for 7 years as required by the Ghana Revenue Authority.</p>
      </Section>

      <Section title="4. Who we share data with">
        <p>We do not sell your data. We share limited data with:</p>
        <p><strong className="text-ink">Paystack</strong> — to process payments. They handle card data directly under their own PCI-DSS compliance.</p>
        <p><strong className="text-ink">Cloudinary</strong> — to store and serve profile photos and portfolio images.</p>
        <p><strong className="text-ink">Supabase</strong> — our database provider, hosted in EU data centres.</p>
        <p><strong className="text-ink">AI moderation providers</strong> — message text is sent to one of five AI providers (Groq, Google Gemini, OpenRouter, Mistral, Cerebras) for content classification. No personal identifiers are included in these requests.</p>
        <p><strong className="text-ink">Law enforcement</strong> — only when required by valid legal process.</p>
      </Section>

      <Section title="5. Data retention">
        <p>Account data is retained for as long as your account is active. Booking and payment records are retained for 7 years for legal compliance. Identity documents are retained for 2 years after account closure.</p>
        <p>When you delete your account (see below), personal data is deleted within 30 days, except where retention is legally required.</p>
      </Section>

      <Section title="6. Your rights">
        <p>Under the Ghana Data Protection Act 2012 and, where applicable, GDPR, you have the right to: access the data we hold about you, correct inaccurate data, request deletion of your data, object to certain uses of your data, and receive your data in a portable format.</p>
        <p>To exercise any of these rights, contact <a href="mailto:privacy@wiamapp.com" className="text-gold">privacy@wiamapp.com</a></p>
      </Section>

      <Section title="7. How to delete your account and data">
        <p>You can delete your account at any time. There are two ways:</p>
        <p><strong className="text-ink">From the mobile app:</strong> Settings → Account → Delete Account. This immediately removes your account and queues your personal data for deletion within 30 days.</p>
        <p><strong className="text-ink">From the app:</strong> Sign in on your phone → Settings → Delete Account. <strong className="text-ink">By email:</strong> contact support@wiamapp.com and we will process the deletion within 30 days.</p>
        <p><strong className="text-ink">By email:</strong> Send a deletion request to <a href="mailto:privacy@wiamapp.com" className="text-gold">privacy@wiamapp.com</a> from your registered email address. We will confirm deletion within 5 business days.</p>
        <p>After deletion, your name, email, phone, and profile photo are permanently removed. Booking records are anonymised (your personal details are removed, the transaction record is retained for legal compliance). Reviews you left are also anonymised.</p>
      </Section>

      <Section title="8. Cookies">
        <p>Our mobile app does not use browser cookies. Our web portal uses essential cookies for authentication (to keep you signed in) and nothing else. We do not use advertising or tracking cookies.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>We will notify you by email and in-app notification before any material changes to this policy take effect.</p>
      </Section>

      <div className="border-t border-line pt-6 mt-8">
        <p className="text-[12.5px] text-inkFaint">Data requests: <a href="mailto:privacy@wiamapp.com" className="text-gold">privacy@wiamapp.com</a></p>
      </div>
    </div>
  );
}
