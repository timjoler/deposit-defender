'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Verify payment
    fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.verified) {
          setVerified(true);
          // Store in localStorage that payment was successful
          localStorage.setItem('deposit_defender_payment_verified', 'true');
          // Redirect back to main page after 2 seconds
          setTimeout(() => {
            router.push('/');
          }, 2000);
        } else {
          setVerified(false);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Verification error:', error);
        setLoading(false);
      });
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
          <p className="mt-4 text-stone-300">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (verified) {
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
        <p className="text-stone-300">Payment verification failed.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 btn-primary"
        >
          Return to Home
        </button>
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

