import React, { useState } from 'react';

export default function AuthPanel({ onAuthChange }) {
  const [agreedToTerms, setAgreedToTerms] = useState(true); // Pre-checked as requested

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (!agreedToTerms) {
      alert('You must agree to the Terms of Service and Privacy Policy to sign up.');
      return;
    }
    // Proceed with authentication / signup flow
  };

  return (
    <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
      {/* Existing inputs... */}

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="termsConsent"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
          required
        />
        <label htmlFor="termsConsent" className="text-xs text-slate-400">
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">
            Privacy Policy
          </a>.
        </label>
      </div>

      <button
        type="submit"
        disabled={!agreedToTerms}
        className={`w-full py-3 px-4 rounded-xl font-bold text-white transition ${
          agreedToTerms ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 cursor-not-allowed opacity-50'
        }`}
      >
        Sign Up / Continue
      </button>
    </form>
  );
}
