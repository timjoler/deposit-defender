'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paid = searchParams.get('paid');

  useEffect(() => {
    if (paid === 'true') {
      // Store in localStorage that payment was successful
      localStorage.setItem('deposit_defender_paid', 'true');
      // Redirect back to main page with ?paid=true so it gets picked up
      setTimeout(() => {
        router.push('/?paid=true');
      }, 2000);
    } else {
      // If no paid parameter, redirect to home
      router.push('/');
    }
  }, [paid, router]);

  if (paid === 'true') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-semibold text-stone-50">
            Payment Successful!
          </h1>
          <p className="mt-2 text-stone-300">
            Your letter has been unlocked. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
        <p className="mt-4 text-stone-300">Redirecting...</p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
          <p className="mt-4 text-stone-300">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

