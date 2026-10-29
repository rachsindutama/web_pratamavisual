import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DEFAULT_ADMIN_ID = import.meta.env.VITE_DEFAULT_ADMIN_ID || 'DEFAULT_ADMIN_UID';

export function useSiteSettings(adminId = DEFAULT_ADMIN_ID) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const docRef = doc(db, 'siteSettings', adminId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.funFacts) {
            data.achievements = data.funFacts;
          }
          if (data.defaultEstimatedDays === undefined) data.defaultEstimatedDays = 30;
          if (data.maxRevisions === undefined) data.maxRevisions = 3;
          setSettings(data);
        } else {
          // Return default empty settings
          setSettings({
            brandName: 'PORTFOLIO',
            navLinks: {
              home: 'HOME',
              pricing: 'PRICING',
              contact: 'CONTACT',
            },
            footerLinks: {
              aboutMe: { label: 'About me', url: '/about', heading: 'FIND OUT MORE' },
              instagram: { label: 'Instagram', url: '#', heading: 'FOLLOW ME ON' },
              connect: { label: 'Connect', url: '/booking', heading: 'GET IN TOUCH' },
            },
            copyrightText: `© ${new Date().getFullYear()} Portfolio`,
            termsAndConditions: 'Please agree to our terms of service before booking.',
            achievements: [
              { number: '26+', description: 'This is a paragraph. Click edit and enter your own text.' },
              { number: '15+', description: 'This is a paragraph. Click edit and enter your own text.' },
              { number: '109+', description: 'This is a paragraph. Click edit and enter your own text.' },
              { number: '3', description: 'This is a paragraph. Click edit and enter your own text.' }
            ],
            sectionTitles: {
              portfolio: 'Portfolio',
              achievements: 'Achievements',
              testimonials: 'Client Stories'
            },
            achievementsSubtitle: '',
            defaultEstimatedDays: 30,
            maxRevisions: 3,
            kpiTargets: {
              netSales: '40% - 70%',
              netProfit: '40% - 70%',
              grossProfit: '60% - 80%',
              cogs: '20% - 40%',
              opex: '10% - 25%',
              expProfit: '<50%',
              collectRatio: '70% - 90%',
              arRatio: '<30%'
            }
          });
        }
      } catch (err) {
        console.error('Error fetching site settings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [adminId]);

  useEffect(() => {
    if (settings?.faviconUrl) {
      // 0. Cache for Instant Reload
      try {
        localStorage.setItem('cached_favicon', settings.faviconUrl);
      } catch (e) {}

      // 1. Update Standard Favicon
      let link = document.getElementById("dynamic-favicon") || document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.id = 'dynamic-favicon';
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;

      // 2. Update PWA Manifest Icon Dynamically
      let manifestLink = document.getElementById("dynamic-manifest") || document.querySelector("link[rel='manifest']");
      if (manifestLink) {
        const manifest = {
          name: "Pratamavisual",
          short_name: "Pratamavisual",
          description: "Photography Portfolio & Client Booking",
          start_url: "/",
          display: "standalone",
          background_color: "#0B0B0B",
          theme_color: "#0B0B0B",
          icons: [
            {
              src: settings.faviconUrl,
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: settings.faviconUrl,
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            }
          ]
        };
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        manifestLink.href = URL.createObjectURL(blob);
      }
    }
  }, [settings?.faviconUrl]);

  return { settings, loading, error };
}
