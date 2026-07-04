// © 2026 WiamApp. Powered by WiamLabs
// app/contact/page.js

export const metadata = {
  title: 'Contact WiamApp',
  description: 'Get in touch with the WiamApp team — support, business enquiries, press, and partnerships.',
};

const CONTACTS = [
  {
    title: 'Customer support',
    desc: 'Problems with a booking, payment question, or account issue.',
    email: 'support@wiamapp.com',
    cta: 'Also reachable from the Help section in the app.',
  },
  {
    title: 'Business accounts',
    desc: 'Questions about WiamApp Business plans, Gold verification, or team features.',
    email: 'business@wiamapp.com',
    cta: 'Or apply directly at wiamapp.com/apply',
  },
  {
    title: 'Partnerships',
    desc: 'Trade associations, government bodies, or companies interested in working with WiamApp.',
    email: 'partnerships@wiamapp.com',
    cta: null,
  },
  {
    title: 'Press and media',
    desc: 'Media enquiries, interview requests, and press pack.',
    email: 'press@wiamapp.com',
    cta: null,
  },
  {
    title: 'Careers',
    desc: 'Job applications and hiring questions.',
    email: 'careers@wiamapp.com',
    cta: 'Or see open roles at wiamapp.com/careers',
  },
  {
    title: 'Legal and data',
    desc: 'Terms queries, GDPR requests, and data deletion.',
    email: 'privacy@wiamapp.com',
    cta: null,
  },
];

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold text-ink mb-2">Get in touch</h1>
        <p className="text-inkMuted text-[14px]">We're a small team — every email goes to a real person, not a ticket system.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {CONTACTS.map((c) => (
          <div key={c.title} className="border border-line rounded-card p-5">
            <div className="font-semibold text-[14px] text-ink mb-1">{c.title}</div>
            <p className="text-[12.5px] text-inkMuted mb-3">{c.desc}</p>
            <a href={`mailto:${c.email}`} className="text-[13px] font-semibold text-gold">{c.email}</a>
            {c.cta && <p className="text-[11.5px] text-inkFaint mt-2">{c.cta}</p>}
          </div>
        ))}
      </div>

      <div className="mt-10 bg-paper border border-line rounded-card p-6">
        <h2 className="font-semibold text-[14px] text-ink mb-2">Based in Accra, Ghana</h2>
        <p className="text-[13px] text-inkMuted">
          WiamApp is built and operated by WiamLabs — a product studio working on the trust and payments layer for the informal services economy in West Africa and beyond.
        </p>
      </div>
    </div>
  );
}
