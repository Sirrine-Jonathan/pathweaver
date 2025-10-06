import React, { useState, useEffect } from 'react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex items-center justify-between z-50">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600 rounded-full"></div>
        <div>
          <p className="font-semibold text-gray-900">Install Pathweaver</p>
          <p className="text-sm text-gray-600">Get the full app experience</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={handleDismiss}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;