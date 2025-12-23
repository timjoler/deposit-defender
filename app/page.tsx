'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { ArrowRight, Info, Lock, Scale, ShieldCheck, Copy, Check } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

type ContextMode = 'dispute' | 'admit';

type CaseStrength = 'High' | 'Medium' | 'Low';

type AiResult = {
  strength: CaseStrength;
  act_cited: string;
  summary: string;
  letter: string;
};

const LOADING_STEPS = [
  'Scanning correspondence...',
  'Checking Tenant Fees Act 2019...',
  'Analyzing case strength...',
  'Finalizing draft...',
] as const;

function buildFallbackDraft(email: string, context: ContextMode): AiResult {
  const lowered = email.toLowerCase();
  const mentionsCleaning =
    lowered.includes('cleaning') || lowered.includes('professional clean');
  const mentionsCarpet = lowered.includes('carpet');
  const mentionsRepairs = lowered.includes('repair') || lowered.includes('damage');

  let strength: CaseStrength = 'Medium';
  let act = 'Tenant Fees Act 2019';
  let summary =
    'Reasonable prospects of reducing the proposed deductions, particularly around fees and wear and tear.';

  if (context === 'dispute') {
    if (mentionsCleaning) {
      strength = 'High';
      act = 'Tenant Fees Act 2019 – Schedule 1 (Permitted Payments)';
      summary =
        'Strong case: the landlord appears to be claiming broad “professional cleaning” or admin fees which are often prohibited unless clearly evidenced and limited to actual loss.';
    } else if (mentionsCarpet || mentionsRepairs) {
      strength = 'Medium';
      act = 'Housing Act 2004 & Consumer Rights Act 2015';
      summary =
        'Mixed case: some items may be legitimate, but the landlord still has to prove loss and compliance with deposit protection rules and fair contract terms.';
    } else {
      strength = 'Medium';
      act = 'Housing Act 2004 (Deposit Protection) & Consumer Rights Act 2015';
      summary =
        'There may be scope to challenge the deductions, especially if the deposit was not protected correctly or charges are not transparently set out.';
    }
  } else {
    // admit fault but dispute quantum
    strength = mentionsCarpet || mentionsCleaning ? 'High' : 'Medium';
    act = 'Tenant Fees Act 2019 & Consumer Rights Act 2015 (fairness of terms)';
    summary =
      strength === 'High'
        ? 'Good prospects of reducing the amount: even where some responsibility is accepted, the landlord cannot charge “new for old” and must allow for age, condition and fair wear and tear.'
        : 'There is a realistic chance of reducing the figures by relying on apportionment and betterment, even though some liability is accepted.';
  }

  const opening =
    'Dear Sir or Madam,\n\nI write in response to your proposed deductions from my tenancy deposit. I do not accept the sums you have claimed and set out below my position with reference to the relevant housing legislation and guidance.';

  const liabilityParagraph =
    context === 'dispute'
      ? 'First, I dispute liability for the majority of the alleged damage and charges. Your schedule overstates both the extent of any disrepair and the cost of remedying it. Under the Housing Act 2004 and the Landlord and Tenant Act 1985 (section 11), landlords must distinguish between genuine disrepair caused by a tenant and ordinary wear and tear that arises from normal use over time.'
      : 'I acknowledge that some responsibility may rest with me. However, the level of the deductions you propose is excessive and does not reflect the legal requirement to consider fair wear and tear, age and condition, and to avoid any “betterment” or profit at the tenant’s expense.';

  const cleaningParagraph = mentionsCleaning
    ? 'In relation to cleaning, the Tenant Fees Act 2019 restricts landlords and agents from imposing general “professional cleaning” or blanket charges. Any cleaning cost must be based on clear evidence of the property’s condition at check-in and check-out, and must represent a genuine, reasonable cost of returning the property to its original condition – not an opportunity to improve it.'
    : 'Any claim for redecoration, gardening or similar work must be supported by detailed, contemporaneous check-in and check-out evidence. General assertions of a need to “freshen up” the property are not, by themselves, a lawful basis for substantial deductions from a protected deposit.';

  const carpetParagraph = mentionsCarpet
    ? 'Where you seek to charge for carpet or flooring, you are required to make appropriate deductions for age and prior condition. The principle of betterment – reflected in tenancy deposit scheme guidance and consistent with the Consumer Rights Act 2015 – means you cannot replace a worn item with something new at my expense, save for a proportionate contribution that reflects any actual loss beyond fair wear and tear.'
    : 'For any items you say require replacement, you must show that the cost claimed reflects only the remaining value of the item, taking into account its age and prior condition, rather than the full cost of a brand‑new replacement.';

  const depositParagraph =
    'Under the Housing Act 2004 you are also under a duty to have complied with tenancy deposit protection requirements and to provide clear, itemised evidence to any deposit scheme or court. Unsupported or inflated figures are unlikely to be upheld by an adjudicator.';

  const closing =
    'In light of the above, I invite you to review your proposed deductions and provide a fully itemised, evidence‑based breakdown that complies with the Tenant Fees Act 2019, the Housing Act 2004, the Landlord and Tenant Act 1985 and the Consumer Rights Act 2015. If we are unable to reach a fair and lawful compromise, I will have no option but to ask the deposit protection scheme or a court to determine the matter.\n\nYours faithfully,\n[Your Name]';

  return {
    strength,
    act_cited: act,
    summary,
    letter: [opening, liabilityParagraph, cleaningParagraph, carpetParagraph, depositParagraph, closing].join(
      '\n\n',
    ),
  };
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [emailText, setEmailText] = useState('');
  const [context, setContext] = useState<ContextMode>('dispute');
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [letterUnlocked, setLetterUnlocked] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Replace with your actual Stripe checkout link
  const STRIPE_CHECKOUT_URL = '[PASTE_YOUR_STRIPE_LINK_HERE]';

  const currentLoadingLabel = LOADING_STEPS[loadingStepIndex] ?? LOADING_STEPS[0];

  const [visibleParagraph, blurredParagraphs] = useMemo(() => {
    if (!result?.letter) return ['', ''];
    const parts = result.letter.split(/\n\s*\n/);
    if (!parts.length) return ['', ''];
    const [first, ...rest] = parts;
    return [first.trim(), rest.join('\n\n').trim()];
  }, [result]);

  const strengthColorClasses = useMemo(() => {
    switch (result?.strength) {
      case 'High':
        return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/60';
      case 'Medium':
        return 'bg-amber-500/15 text-amber-200 border-amber-400/60';
      case 'Low':
        return 'bg-rose-500/15 text-rose-200 border-rose-400/60';
      default:
        return 'bg-stone-800/40 text-stone-200 border-stone-700';
    }
  }, [result?.strength]);

  const strengthBarValue = useMemo(() => {
    if (!result) return 0;
    if (result.strength === 'High') return 90;
    if (result.strength === 'Medium') return 55;
    return 25;
  }, [result]);

  const showPaywall = useMemo(
    () => !!result && (result.strength === 'High' || result.strength === 'Medium') && !isPaid,
    [result, isPaid],
  );

  // Check URL for paid=true parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const paid = searchParams.get('paid');
      if (paid === 'true') {
        setIsPaid(true);
        setLetterUnlocked(true);
        // Save to localStorage for persistence
        localStorage.setItem('deposit_defender_paid', 'true');
        // Clean up URL by removing the parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('paid');
        window.history.replaceState({}, '', url.toString());
      } else {
        // Check localStorage for persisted payment status
        const savedPaid = localStorage.getItem('deposit_defender_paid');
        if (savedPaid === 'true') {
          setIsPaid(true);
          setLetterUnlocked(true);
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStepIndex(0);
      setProgress(0);
      return;
    }

    let step = 0;
    let elapsed = 0;
    const totalMs = 4000;
    const tickMs = 80;

    const interval = setInterval(() => {
      elapsed += tickMs;
      const ratio = Math.min(1, elapsed / totalMs);
      setProgress(Math.round(ratio * 100));

      const newStep = Math.min(
        LOADING_STEPS.length - 1,
        Math.floor((elapsed / totalMs) * LOADING_STEPS.length),
      );
      if (newStep !== step) {
        step = newStep;
        setLoadingStepIndex(step);
      }

      if (elapsed >= totalMs) {
        clearInterval(interval);
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleDraft = useCallback(async () => {
    setError(null);

    // Validation checks
    if (!confirmed) {
      setError('Please confirm that your details are true and that this is not legal advice.');
      return;
    }

    const lower = emailText.toLowerCase();
    if (lower.includes('withhold rent') || lower.includes('rent strike')) {
      setError(
        'Deposit Defender cannot draft or support rent strike or withholding-rent strategies. Please seek independent legal advice.',
      );
      return;
    }

    if (!emailText.trim()) {
      setError("Please paste your landlord's email so we can analyse it.");
      return;
    }

    setIsLoading(true);
    setLetterUnlocked(false);
    setLoadingStepIndex(0);

    // 1. The Animation (Keeps the user waiting so it feels valuable)
    const steps = [
      'Scanning correspondence...',
      'Cross-referencing Tenant Fees Act 2019...',
      'Analyzing Case Strength...',
      'Finalizing Draft...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingStepIndex(i);
      await new Promise((r) => setTimeout(r, 800));
    }

    try {
      // Map context to the format expected by the API
      const contextLabel = context === 'dispute' ? 'Innocent/Dispute' : 'Guilty/Mitigate';

      // 2. Call our Backend API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: emailText,
          context: contextLabel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = 
          typeof errorData.error === 'string' 
            ? errorData.error 
            : errorData.error?.message || 'API Failed';
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Validate the response has all required fields
      if (!data || !data.strength || !data.summary || !data.letter) {
        console.warn('OpenAI response incomplete, using fallback');
        setResult(buildFallbackDraft(emailText, context));
      } else {
        setResult(data as AiResult);
      }
    } catch (error: any) {
      console.error('Error:', error);
      setError(error?.message || 'Something went wrong. Please check your internet connection.');
      // Use fallback on error
      setResult(buildFallbackDraft(emailText, context));
    } finally {
      setIsLoading(false);
      setLoadingStepIndex(0);
    }
  }, [context, confirmed, emailText]);

  return (
    <main className="flex min-h-screen justify-center px-4 py-10 text-stone-100">
      <div className="w-full max-w-5xl space-y-10">
        {/* Payment Success Banner */}
        {isPaid && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="font-semibold">Payment Successful. Letter Unlocked.</span>
            </div>
          </div>
        )}
        
        {/* Header */}
        <header className="flex flex-col gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="flex items-center justify-center gap-3 md:justify-start">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900/80 border border-amber-500/40 shadow-lg shadow-amber-900/40">
              <ShieldCheck className="h-7 w-7 text-amber-400" aria-hidden />
            </span>
            <div>
                <p className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-300/80">
                  Deposit Defender
                </p>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50 md:text-4xl">
                Deposit Defender UK
          </h1>
            </div>
          </div>
          <p className="max-w-md text-sm text-stone-300 md:text-base">
            <span className="font-semibold text-stone-100">
              Do not let landlords keep your money unfairly.
            </span>
            <br />
            Turn that angry email into a calm, legally framed rebuttal letter in seconds.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)] items-start">
          {/* Left column: input + sales */}
          <section className="space-y-6">
            {/* Input card */}
            <div className="card p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/80 mb-1">
                    Step 1 · Your side of the story
                  </p>
                  <h2 className="text-lg font-semibold text-stone-50">
                    Paste the angry email from your landlord here...
                  </h2>
                </div>
                <span className="badge-pill">UK Tenancies</span>
              </div>

              <div className="relative">
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  className="h-48 w-full resize-none rounded-xl border border-stone-700/80 bg-stone-900/80 px-4 py-3 text-base text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 scrollbar-thin"
                  placeholder={
                    'Paste the full text of the email or deposit deduction schedule.\n\nExample: "We are withholding £750 for professional cleaning, repainting, and carpet replacement..."'
                  }
                />
                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-stone-50/5 ring-offset-0" />
              </div>

              {/* Context toggle */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-300 flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-amber-400" aria-hidden />
                  How do you want to position your case?
                </p>
                <div className="inline-flex rounded-full border border-stone-700/80 bg-stone-900/70 p-1 text-sm font-medium text-stone-200">
                  <button
                    type="button"
                    onClick={() => setContext('dispute')}
                    className={`flex-1 px-3 py-1.5 rounded-full transition ${
                      context === 'dispute'
                        ? 'bg-amber-500 text-stone-950 shadow-sm shadow-amber-900/40'
                        : 'hover:bg-stone-800/80 text-stone-300'
                    }`}
                  >
                    I Dispute This Entirely
                  </button>
                  <button
                    type="button"
                    onClick={() => setContext('admit')}
                    className={`flex-1 px-3 py-1.5 rounded-full transition ${
                      context === 'admit'
                        ? 'bg-amber-500 text-stone-950 shadow-sm shadow-amber-900/40'
                        : 'hover:bg-stone-800/80 text-stone-300'
                    }`}
                  >
                    I Admit Fault, But The Price Is Too High
                  </button>
                </div>
        </div>

              {/* Guardrail checkbox */}
              <label className="mt-2 flex items-start gap-3 rounded-2xl border border-stone-700/80 bg-stone-900/70 px-4 py-3 text-sm text-stone-200">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-stone-600 bg-stone-900 text-amber-500 focus:ring-amber-500"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I confirm the details above are true. I understand this is for information only and
                  does <span className="font-semibold">not</span> constitute formal legal advice.
                </span>
              </label>

              {/* Action & error */}
              <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  onClick={handleDraft}
                  disabled={!confirmed || !emailText.trim() || isLoading}
                  className="btn-primary w-full md:w-auto"
                >
                  <span className="flex items-center gap-2">
                    {isLoading ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-200" />
                        Generating your legal-style rebuttal...
                      </>
                    ) : (
                      <>
                        Draft Legal Rebuttal
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </span>
                </button>

                <p className="flex items-center gap-2 text-[11px] text-stone-400">
                  <Info className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                  We reference UK statutes, but you should always double-check with Citizens Advice or
                  a solicitor before taking action.
                </p>
              </div>

              {/* Loading state */}
              {isLoading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-stone-300">
                    <span className="font-medium tracking-wide uppercase">
                      {currentLoadingLabel}
                    </span>
                    <span className="tabular-nums text-stone-400">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-800/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 transition-all duration-[80ms]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                  {error}
                </p>
              )}
            </div>

            {/* Sales section */}
            <section className="space-y-4">
              <div className="card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/80 mb-1">
                      Why this works
                    </p>
                    <h3 className="text-lg font-semibold text-stone-50">
                      Is £4.99 worth saving £500?
                    </h3>
                    <p className="mt-2 text-sm text-stone-300">
                      A clear, statute-backed letter forces the landlord or agent to justify every
                      pound. Most back down long before a dispute ever reaches a tribunal.
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-stone-300 sm:block">
                    <p className="font-semibold text-amber-300">£50k+ deposits</p>
                    <p>flagged and challenged</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-400">
                      Sarah, London
                    </p>
                    <p className="mt-1 font-medium text-stone-50">
                      “Saved me <span className="text-emerald-300">£150</span> on cleaning fees.”
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      Agent dropped an unlawful “professional clean” charge after getting the letter.
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-400">
                      Mike, Leeds
                    </p>
                    <p className="mt-1 font-medium text-stone-50">
                      “Argued betterment on a carpet claim.”
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      Deposit scheme adjudicator reduced a £600 carpet bill to £120 after
                      depreciation.
                    </p>
                  </div>
                  <div className="glass flex flex-col justify-between rounded-xl p-3">
                    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-400">
                      Results so far
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-300">£50k+</p>
                    <p className="text-xs text-stone-400">
                      Estimated total protected deposits where tenants pushed back with structured
                      letters.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="flex items-start gap-2 text-sm text-stone-400">
                  <Info className="mt-[2px] h-4 w-4 text-stone-500" aria-hidden />
                  <span>
                    <span className="font-semibold">Disclaimer:</span> Deposit Defender is an
                    information tool. We are not a law firm and this does not create a
                    solicitor‑client relationship. Always verify key points with Citizens Advice or a
                    qualified housing solicitor.
                  </span>
                </p>
                
                <details className="text-sm text-stone-400">
                  <summary className="cursor-pointer font-semibold text-stone-300 hover:text-stone-200">
                    Terms and Conditions
                  </summary>
                  <div className="mt-3 space-y-2 pl-4 text-sm leading-relaxed">
                    <p>
                      <strong>1. Service Nature:</strong> Deposit Defender is an information tool that generates draft letters based on UK tenancy law. It is not a substitute for professional legal advice.
                    </p>
                    <p>
                      <strong>2. No Legal Relationship:</strong> Use of this service does not create a solicitor-client relationship. We are not a law firm and do not provide legal representation.
                    </p>
                    <p>
                      <strong>3. Accuracy:</strong> While we strive for accuracy, we cannot guarantee that the generated letters will be suitable for your specific circumstances. Always review and verify information before sending.
                    </p>
                    <p>
                      <strong>4. Payment:</strong> Payment is required to unlock the full letter for High and Medium strength cases. Low strength cases are provided free of charge as an honest assessment.
                    </p>
                    <p>
                      <strong>5. Refunds:</strong> Given the digital nature of the service, refunds are not available once the letter has been unlocked. However, if you believe there has been an error, please contact us.
                    </p>
                    <p>
                      <strong>6. Limitation of Liability:</strong> We are not liable for any outcomes resulting from the use of generated letters. Users are responsible for their own legal decisions.
                    </p>
                    <p>
                      <strong>7. Data:</strong> We do not store your correspondence or personal information beyond what is necessary to generate the draft letter.
                    </p>
                    <p>
                      <strong>8. UK Law Only:</strong> This service applies UK tenancy law only. It is not suitable for properties outside England, Wales, Scotland, or Northern Ireland.
                    </p>
                  </div>
                </details>
              </div>
            </section>
          </section>

          {/* Right column: results */}
          <section className="space-y-4">
            <div className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/80 mb-1">
                    Step 2 · Assessment
                  </p>
                  <h2 className="text-lg font-semibold text-stone-50">Case strength at a glance</h2>
                  <p className="mt-1 text-sm text-stone-300">
                    We weigh the landlord&apos;s email against key UK tenancy statutes to estimate how
                    strong your position is.
                  </p>
                </div>
                <div className={`badge-pill ${strengthColorClasses}`}>
                  <span className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                  {result?.strength ? `${result.strength} case` : 'Awaiting input'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-stone-300">
                  <span>Landlord position vs. statute</span>
                  <span className="tabular-nums">
                    {result ? `${strengthBarValue}%` : '–'} confidence
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-800/80">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result?.strength === 'High'
                        ? 'bg-emerald-400'
                        : result?.strength === 'Medium'
                        ? 'bg-amber-400'
                        : result?.strength === 'Low'
                        ? 'bg-rose-500'
                        : 'bg-stone-600'
                    }`}
                    style={{ width: `${strengthBarValue || 0}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-3 text-sm text-stone-200">
                {result ? (
                  <>
                    <p className="font-medium">{result.summary}</p>
                    <p className="text-sm text-stone-400">
                      <span className="badge-pill inline-flex items-center gap-1 bg-stone-900/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Legislation Applied: <span className="font-semibold">{result.act_cited}</span>
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-base text-stone-400">
                    Once you paste the email and generate a draft, we&apos;ll show a simple traffic‑light
                    view of your position with the key statute we relied on.
                  </p>
                )}
              </div>
            </div>

            {/* Letter card */}
            <div className="card relative overflow-hidden p-0">
              <div className="border-b border-stone-800/80 bg-stone-900/80 px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/80 mb-1">
                    Step 3 · Your letter
                  </p>
                  <h2 className="text-lg font-semibold text-stone-50">
                    {result?.strength === 'Low' 
                      ? 'Free advice (weak case assessment)' 
                      : 'Structured rebuttal, in solicitor-style language'}
                  </h2>
                </div>
                {result?.strength !== 'Low' && (
                  <Lock
                    className={`h-4 w-4 ${
                      showPaywall && !letterUnlocked ? 'text-amber-300' : 'text-stone-600'
                    }`}
                    aria-hidden
                  />
                )}
              </div>

              <div className={`relative rounded-b-2xl bg-stone-950/90 ${
                result?.strength === 'Low' ? 'max-h-[520px] overflow-y-auto' : 'max-h-[500px] overflow-hidden flex flex-col'
              }`}>
                {!result ? (
                  <div className="flex h-56 flex-col items-center justify-center text-center text-sm text-stone-400 p-6">
                    <p className="mb-2 font-medium text-stone-200">
                      Your drafted letter will appear here.
                    </p>
                    <p>
                      We&apos;ll mirror the tone of a calm, experienced housing solicitor – firm but
                      professional.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className={`relative overflow-y-auto pr-2 scrollbar-thin flex-1 px-6 pt-6 ${
                      result.strength === 'Low' ? 'max-h-[300px]' : showPaywall && !letterUnlocked ? 'max-h-[280px]' : 'max-h-[400px]'
                    }`}>
                    <article className="mx-auto max-w-none rounded-2xl bg-stone-950/95 p-6 text-sm leading-relaxed text-stone-100 shadow-inner shadow-stone-900/60">
                      <div className="mb-3 border-b border-stone-800/80 pb-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                        Draft for your review only – check before sending
                      </div>
                      <div className="space-y-4 font-serif text-base text-stone-50">
                        {visibleParagraph && <p>{visibleParagraph}</p>}
                        {blurredParagraphs && (
                          <div
                            className={`relative transition-all ${
                              showPaywall && !letterUnlocked
                                ? 'pointer-events-none'
                                : 'pointer-events-auto'
                            }`}
                          >
                            <div
                              className={`space-y-4 ${
                                showPaywall && !letterUnlocked && !isPaid
                                  ? 'blur-sm opacity-60'
                                  : 'blur-0 opacity-100'
                              }`}
                            >
                              {blurredParagraphs.split(/\n\s*\n/).map((para, idx) => (
                                <p key={idx}>{para}</p>
                              ))}
                            </div>

                            {showPaywall && !letterUnlocked && !isPaid && (
                              <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-gradient-to-t from-stone-950/95 via-stone-950/60 to-transparent">
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                  
                  {showPaywall && !letterUnlocked && !isPaid && (
                    <div className="px-6 pb-6 pt-4 border-t border-stone-800/80 bg-stone-950/95 flex flex-col items-center gap-3 text-center">
                      <p className="text-sm text-stone-200">
                        See the full draft, including specific statutory references and a
                        closing position you can send to your landlord or deposit scheme.
                      </p>
                      <button
                        type="button"
                        className="btn-primary px-6"
                        onClick={() => {
                          if (STRIPE_CHECKOUT_URL && STRIPE_CHECKOUT_URL !== '[PASTE_YOUR_STRIPE_LINK_HERE]') {
                            window.location.href = STRIPE_CHECKOUT_URL;
                          } else {
                            alert('Stripe checkout URL not configured. Please add your Stripe checkout link.');
                          }
                        }}
                      >
                        Unlock Full Letter (£4.99)
                      </button>
                      <p className="text-xs text-stone-400">
                        Secure payment via Stripe. Your letter will be unlocked after payment.
                      </p>
                    </div>
                  )}
                  
                  {isPaid && letterUnlocked && (
                    <div className="px-6 pb-6 pt-4 border-t border-stone-800/80 bg-stone-950/95 flex flex-col items-center gap-3 text-center">
                      <button
                        type="button"
                        className="btn-primary px-6 flex items-center gap-2"
                        onClick={async () => {
                          if (result?.letter) {
                            try {
                              await navigator.clipboard.writeText(result.letter);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            } catch (err) {
                              console.error('Failed to copy:', err);
                              alert('Failed to copy to clipboard');
                            }
                          }
                        }}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy to Clipboard
                          </>
                        )}
                      </button>
                      <p className="text-xs text-stone-400">
                        Your letter is ready to send. Copy it and paste into your email.
                      </p>
                    </div>
                  )}
                  
                  {result && result.strength === 'Low' && (
                    <div className="mx-6 mb-6 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                      <p className="font-semibold mb-2">Honest assessment:</p>
                      <p className="mb-2">
                        Because your case is weak, we won&apos;t charge you for this draft. However, here&apos;s some honest advice to help mitigate the situation:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>You&apos;re likely to be at least partly liable for some of the deductions.</li>
                        <li>A confrontational letter may do more harm than good in this situation.</li>
                        <li>Focus on negotiating a reasonable, evidence‑based compromise with your landlord.</li>
                        <li>Consider speaking to Citizens Advice or a housing solicitor before escalating.</li>
                        <li>If you do proceed, be prepared to accept some responsibility and negotiate from a position of compromise rather than confrontation.</li>
                      </ul>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          </section>
        </div>
        </div>
      </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-stone-300">Loading...</p>
        </div>
    </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

