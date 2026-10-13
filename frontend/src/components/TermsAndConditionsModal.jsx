import React, { useState } from "react";

export default function TermsAndConditionsModal({ onAccept }) {
  const [readTerms, setReadTerms] = useState(false);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const [showFullLegal, setShowFullLegal] = useState(false);

  const handleProceed = (e) => {
    e.preventDefault();
    if (!readTerms || !readPrivacy) return;
    localStorage.setItem("omniscale_terms_accepted_2026", "true");
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="max-w-4xl w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-100 shadow-2xl my-8">
        
        {/* Header */}
        <div className="border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
              Mandatory Legal Review & Compensation Waiver
            </span>
            <button
              type="button"
              onClick={() => setShowFullLegal(prev => !prev)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
            >
              {showFullLegal ? "← Back to Summary" : "View Full Non-Compensation & Inconvenience Terms →"}
            </button>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mt-2">
            OmniScale AI SaaS — Terms of Service & Absolute Waiver
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {showFullLegal
              ? "Comprehensive legal disclosure regarding zero compensation, zero inconvenience liability, and prototype status."
              : "Please review and accept these terms governing this experimental platform before proceeding."}
          </p>
        </div>

        {/* Content Body */}
        {!showFullLegal ? (
          <div className="max-h-96 overflow-y-auto pr-4 space-y-4 text-sm text-slate-300 border border-slate-800 bg-slate-950/50 p-4 rounded-xl">
            <div>
              <h3 className="font-bold text-white mb-1">1. Experimental Research Prototype Status</h3>
              <p>
                OmniScale AI SaaS is <strong>not</strong> a commercial retail product or commercial enterprise. It is an experimental software project provided strictly on an "AS IS" and "AS AVAILABLE" basis.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">2. Zero Compensation & Inconvenience Waiver</h3>
              <p>
                Users acknowledge and agree that <strong>no financial compensation, damages, restitution, or reimbursement for inconveniences</strong> will be accrued, owed, or paid under any circumstance. All subscription fees offset server hosting and OpenAI API token upkeep exclusively.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">3. Absolute Owner Non-Liability</h3>
              <p>
                Project owners and developers assume absolute zero liability for system outages, AI inaccuracies, data loss, or user inconveniences. Use of this platform is entirely at your own risk.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">4. Anti-Scam & Dispute Restrictions</h3>
              <p>
                This platform is not a scam or fraudulent commercial offering. Bad-faith chargebacks, malicious claims, or demands for punitive compensation constitute a breach of these terms.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto pr-4 space-y-6 text-sm text-slate-300 border border-slate-800 bg-slate-950/50 p-6 rounded-xl leading-relaxed">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Master Legal Disclosure: Non-Compensation & Inconvenience Waiver</h3>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-4">Effective Date: October 2026 | Document ID: OMNI-WAIVER-2026</p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-1">Section A: Absolute Non-Eligibility for Compensation</h4>
              <p>
                By accessing, using, or subscribing to OmniScale AI SaaS, you explicitly agree that project maintainers, owners, and developers bear <strong>zero obligation to provide financial compensation, monetary damages, or credits for any reason whatsoever</strong>, including but not limited to platform downtime, API failures, prompt errors, or service bugs. No compensation or inconvenience claims shall accrue or be entertained.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-1">Section B: Nature of Payments</h4>
              <p>
                Payments processed via PayPal represent non-refundable operational contributions toward infrastructure maintenance and third-party AI token inference costs. They do not represent commercial purchases, commercial guarantees, or investments capable of generating financial returns or inconvenience payouts.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-1">Section C: Total Exclusion of Inconvenience and Consequential Damages</h4>
              <p>
                Project owners shall never be held liable for indirect, incidental, special, or consequential damages, or emotional/operational inconvenience resulting from the use or inability to use the platform. The user assumes 100% responsibility for workflow verification.
              </p>
            </div>
          </div>
        )}

        {/* Acceptance Form */}
        <form onSubmit={handleProceed} className="mt-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={readTerms}
              onChange={(e) => setReadTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300">
              I understand and agree that <strong>no compensation or inconvenience claims will be made or accrued</strong>, and I accept the non-commercial prototype terms.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={readPrivacy}
              onChange={(e) => setReadPrivacy(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300">
              I agree to the <strong>Privacy Policy</strong> regarding secure session tokens and data handling.
            </span>
          </label>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setShowFullLegal(prev => !prev)}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              {showFullLegal ? "Hide Full Document" : "Read Full Document Before Accepting"}
            </button>

            <button
              type="submit"
              disabled={!readTerms || !readPrivacy}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Accept Terms & Access Platform
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}