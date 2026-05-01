import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const setMeta = (name: string, content: string) => {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
};

const setLink = (rel: string, href: string, attrs: Record<string, string> = {}) => {
  const selector = `link[rel="${rel}"]${Object.entries(attrs)
    .map(([k, v]) => `[${k}="${v}"]`)
    .join('')}`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  el.href = href;
};

/**
 * Loads PWA settings from the DB and injects a fresh manifest blob URL,
 * along with theme-color, apple-touch-icon, and apple splash images.
 */
export const usePwaManifest = () => {
  useEffect(() => {
    let blobUrl: string | null = null;
    (async () => {
      const { data } = await supabase
        .from('pwa_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!data) return;

      const icons: any[] = [];
      if (data.icon_192_url) {
        icons.push({ src: data.icon_192_url, sizes: '192x192', type: 'image/png', purpose: 'any' });
      } else {
        icons.push({ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' });
      }
      if (data.icon_512_url) {
        icons.push({ src: data.icon_512_url, sizes: '512x512', type: 'image/png', purpose: 'any' });
      } else {
        icons.push({ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' });
      }
      if (data.maskable_icon_url) {
        icons.push({ src: data.maskable_icon_url, sizes: '512x512', type: 'image/png', purpose: 'maskable' });
      }

      const manifest = {
        name: data.name,
        short_name: data.short_name,
        description: data.description,
        start_url: data.start_url,
        scope: data.scope,
        display: data.display,
        orientation: data.orientation,
        background_color: data.background_color,
        theme_color: data.theme_color,
        lang: data.lang,
        categories: data.categories,
        icons,
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      blobUrl = URL.createObjectURL(blob);

      // Replace existing manifest link
      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = blobUrl;

      // theme & status bar
      setMeta('theme-color', data.theme_color);
      setMeta('apple-mobile-web-app-title', data.short_name);
      setMeta('description', data.description ?? '');
      document.title = data.name;

      // Apple touch icon
      if (data.apple_touch_icon_url) {
        setLink('apple-touch-icon', data.apple_touch_icon_url);
      }

      // Apple splash (light/dark)
      if (data.splash_url) {
        setLink('apple-touch-startup-image', data.splash_url, {
          media: '(prefers-color-scheme: light)',
        });
      }
      if (data.splash_dark_url) {
        setLink('apple-touch-startup-image', data.splash_dark_url, {
          media: '(prefers-color-scheme: dark)',
        });
      }
    })();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);
};
