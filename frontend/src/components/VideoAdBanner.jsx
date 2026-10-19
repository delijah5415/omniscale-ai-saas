import React, { useEffect, useState } from 'react';

export default function VideoAdBanner() {
  const [adWatched, setAdWatched] = useState(false);

  useEffect(() => {
    const status = localStorage.getItem('omniscale_ad_watched');
    if (status === 'true') {
      setAdWatched(true);
    }
  }, []);

  const handleVideoEnded = () => {
    localStorage.setItem('omniscale_ad_watched', 'true');
    setAdWatched(true);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto my-8 p-6 bg-slate-900/90 rounded-2xl border border-cyan-500/40 shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider">
          OmniScale AI Spotlight Advertisement
        </span>
        {adWatched && (
          <span className="text-xs text-emerald-400 font-medium">
            ✓ Ad Completed (Saved in Local Storage)
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-xl bg-black aspect-video flex items-center justify-center border border-slate-800">
        <video
          className="w-full h-full object-cover"
          controls
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
        >
          <source src="/videos/omniscale-ad.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}