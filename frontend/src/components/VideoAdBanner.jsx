import React, { useEffect, useRef, useState } from 'react';

const VIDEO_URL = '/videos/omniscale-ai-videoAd.mp4';
const WATCHED_KEY = 'omniscale_ad_watched';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'video[controls]',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function VideoAdBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [adWatched, setAdWatched] = useState(false);

  const triggerButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    try {
      setAdWatched(localStorage.getItem(WATCHED_KEY) === 'true');
    } catch {
      // The video remains usable when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && (
        document.activeElement === first ||
        !dialog.contains(document.activeElement)
      )) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (
          document.activeElement === last ||
          !dialog.contains(document.activeElement)
        )
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (videoRef.current) {
        videoRef.current.pause();
      }

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        triggerButtonRef.current?.focus();
      }
    };
  }, [isOpen]);

  const handleVideoEnded = () => {
    setAdWatched(true);

    try {
      localStorage.setItem(WATCHED_KEY, 'true');
    } catch {
      // Completion remains recorded in component state for this session.
    }
  };

  const closeModal = () => setIsOpen(false);

  return (
    <>
      <section
        aria-label="OmniScale AI video introduction"
        className="mx-auto mb-8 w-full max-w-2xl"
      >
        <div className="group flex flex-col gap-4 rounded-2xl border border-sky-400/20 bg-slate-900/75 p-4 shadow-lg shadow-sky-950/20 backdrop-blur-xl transition hover:border-sky-400/40 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300 transition group-hover:bg-sky-400/20">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
              >
                <path
                  d="M8 5.5v13l10-6.5-10-6.5Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-white sm:text-base">
                Discover OmniScale AI
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                See how to build, automate and scale with AI.
              </p>
              {adWatched && (
                <p className="mt-1 text-xs text-emerald-400" role="status">
                  Video completed
                </p>
              )}
            </div>
          </div>

          <button
            ref={triggerButtonRef}
            type="button"
            onClick={() => setIsOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-sky-950/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M8 5.5v13l10-6.5-10-6.5Z"
                fill="currentColor"
              />
            </svg>
            {adWatched ? 'Watch again' : 'Watch video'}
          </button>
        </div>
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/95 p-3 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="omniscale-video-title"
            aria-describedby="omniscale-video-description"
            tabIndex={-1}
            className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
                  OmniScale AI
                </p>
                <h2
                  id="omniscale-video-title"
                  className="mt-1 text-base font-bold text-white sm:text-lg"
                >
                  Build, automate and scale with AI
                </h2>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
                aria-label="Close video"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              </button>
            </header>

            <p id="omniscale-video-description" className="sr-only">
              Watch the OmniScale AI platform introduction. Use the video
              controls to pause, seek, or adjust the volume.
            </p>

            <div className="bg-black">
              <video
                ref={videoRef}
                className="block max-h-[72vh] w-full bg-black object-contain"
                controls
                autoPlay
                playsInline
                preload="none"
                onEnded={handleVideoEnded}
              >
                <source src={VIDEO_URL} type="video/mp4" />
                Your browser does not support HTML video playback.
              </video>
            </div>

            <footer className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <p className="text-xs text-slate-400">
                OmniScale AI platform introduction
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
