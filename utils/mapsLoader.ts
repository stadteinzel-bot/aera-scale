/**
 * Google Maps API Loader
 * Dynamically injects the Google Maps script into the document head.
 */
export const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.google?.maps) {
            resolve();
            return;
        }

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
            || (window as any)?._env_?.VITE_GOOGLE_MAPS_API_KEY
            || '';
        if (!apiKey) {
            console.error("Google Maps API Key is missing! Check .env or Cloud Run vars.");
            reject(new Error("Google Maps API Key missing"));
            return;
        }

        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            resolve(); // Script already added
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            console.log("✅ Google Maps API Loaded");
            resolve();
        };

        script.onerror = (err) => {
            console.error("❌ Failed to load Google Maps API:", err);
            reject(err);
        };

        document.head.appendChild(script);
    });
};
