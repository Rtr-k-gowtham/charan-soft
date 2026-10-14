// src/components/pwa/PwaInstallPrompt.tsx
import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Sparkles, Check, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // 1. Check if app is running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return; // Already running as installed PWA, do not show prompt
    }

    // 2. Detect mobile & iOS
    const ua = navigator.userAgent || '';
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768;
    const iosCheck = /iPhone|iPad|iPod/i.test(ua);
    setIsMobile(mobileCheck);
    setIsIOS(iosCheck);

    // 3. Check dismissal memory (dismissed for 12 hours)
    const dismissedUntil = localStorage.getItem('csg_pwa_dismissed_until');
    const isDismissed = dismissedUntil && Date.now() < parseInt(dismissedUntil, 10);

    // 4. Capture beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isDismissed && mobileCheck) {
        setShowPrompt(true);
      }
    };

    // 5. Capture successful install
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 5000);
    };

    const handleManualShow = () => {
      setShowPrompt(true);
      if (iosCheck) {
        setShowIOSGuide(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('show-pwa-install-prompt', handleManualShow);

    // If mobile & iOS & not standalone & not dismissed, display prompt after a slight delay
    if (mobileCheck && iosCheck && !checkStandalone() && !isDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('show-pwa-install-prompt', handleManualShow);
      };
    }

    // If mobile & non-iOS, but beforeinstallprompt takes time or fallback on mobile browsers
    if (mobileCheck && !iosCheck && !checkStandalone() && !isDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('show-pwa-install-prompt', handleManualShow);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('show-pwa-install-prompt', handleManualShow);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setShowPrompt(false);
          setDeferredPrompt(null);
        } else {
          // User cancelled prompt
          handleDismiss(4);
        }
      } catch (err) {
        console.error('Error triggering PWA installation:', err);
      }
    } else {
      // Fallback instructions for browsers without programmatic prompt
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = (hours = 12) => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    localStorage.setItem('csg_pwa_dismissed_until', String(Date.now() + hours * 60 * 60 * 1000));
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Success Notification Banner */}
      {installSuccess && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-emerald-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between text-xs animate-bounce">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span className="font-semibold">CHERAN SOFT app installed successfully!</span>
          </div>
          <button onClick={() => setInstallSuccess(false)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Install Popup on Mobile (< md) */}
      {showPrompt && (
        <aside
          role="region"
          aria-label="Install Cheran Soft Goods app"
          className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900/95 text-white rounded-3xl p-4 shadow-2xl border border-slate-700/60 backdrop-blur-md animate-fade-in transition-all"
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* App Icon - Compact & Crisp */}
              <div className="w-10 h-10 min-w-[40px] max-w-[40px] min-h-[40px] max-h-[40px] rounded-xl bg-white p-1 shrink-0 shadow-sm border border-slate-200/30 overflow-hidden flex items-center justify-center">
                <img
                  src="/icon-192.png"
                  alt="Cheran Soft Icon"
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-white tracking-tight">
                    CHERAN SOFT GOODS
                  </span>
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase rounded-md tracking-wider flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Mobile App
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 font-medium leading-snug">
                  Install this app on your phone for full-screen view & faster access.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleDismiss(12)}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Close"
              aria-label="Close install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* iOS Safari Step-by-Step Instructions */}
          {showIOSGuide && (
            <div className="mt-3.5 p-3 bg-slate-800/90 rounded-2xl border border-slate-700 text-xs text-slate-200 space-y-2 animate-fade-in">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-brand-400" />
                <span>How to Install on iPhone / iPad:</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" /> in Safari's bottom toolbar.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-emerald-400" />.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>Tap <strong>Add</strong> at top right to launch directly from your home screen!</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 mt-3.5 pt-1">
            <button
              onClick={() => handleDismiss(12)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Later
            </button>

            <button
              onClick={handleInstallClick}
              className="flex-1 min-h-[40px] flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{isIOS ? (showIOSGuide ? 'Got It' : 'Install on iPhone') : 'Install App'}</span>
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
