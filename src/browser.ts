import { ExperimentConfig, config } from './config';
import { track } from './track';

interface GrowthbookData {
  experiments: ExperimentConfig;
  events: {
    [key: string]: {
      urlPattern?: string;
      selector: string;
      name: string;
      properties?: {
        [key: string]: any;
      };
    }[];
  };
}

declare global {
  interface Window {
    GB_DATA?:
      | {
          push: (data: GrowthbookData) => void;
        }
      | GrowthbookData[];
  }
}

const processData = (data: GrowthbookData) => {
  if (data.experiments) {
    Object.assign(config.experimentConfig, data.experiments);
  }

  if (data.events) {
    Object.keys(data.events).forEach(k => {
      const events = data.events[k].map(e => ({
        ...e,
        urlRegex: e.urlPattern ? new RegExp(e.urlPattern, 'i') : null,
      }));

      document.addEventListener(k, function(e) {
        if (e.target instanceof HTMLElement) {
          const t = e.target;
          const u = window.location.href;
          for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            if (!ev.urlRegex || ev.urlRegex?.test(u)) {
              if (t.closest(ev.selector)) {
                track(ev.name, ev.properties || {});
                // Only track the first matching element
                return;
              }
            }
          }
        }
      });
    });
  }
};

if (typeof window !== 'undefined') {
  // If the data was already queued
  if (Array.isArray(window.GB_DATA) && window.GB_DATA[0]) {
    processData(window.GB_DATA[0]);
  }

  // Swap out the temp array with the real growthbook config object
  window.GB_DATA = {
    push: processData,
  };
}
