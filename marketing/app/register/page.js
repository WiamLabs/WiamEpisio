// © 2026 WiamApp. Powered by WiamLabs
// app/register/page.js — the missing piece: this is the actual
// working registration flow the homepage buttons were pointing to
// (app.wiamapp.com never existed). Handles customer + worker
// signup, OTP verification, and referral code capture from
// ?ref=CODE links shared by the referral system.
//
// Business registration is intentionally NOT handled here — that
// already has its own dedicated multi-step flow in the Business
// Web portal at /apply.

import { Suspense } from 'react';
import RegisterForm from './RegisterForm';

export const metadata = {
  title: 'Create your account',
  description: 'Join WiamApp as a customer or register as a verified worker.',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
