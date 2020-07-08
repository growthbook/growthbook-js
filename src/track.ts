import { EventProperties, config } from './config';

const trackQueue: [string, EventProperties][] = [];

export const track = (event: string, properties: EventProperties) => {
  if (!config.trackingHost) {
    trackQueue.push([event, properties]);
    return;
  }
  if (typeof fetch === 'undefined') {
    return;
  }

  fetch(
    `${config.trackingHost}/t?payload=${encodeURIComponent(
      JSON.stringify({
        user_id: config.userId,
        anonymous_id: config.anonymousId,
        url: window.location.href,
        referrer: document.referrer,
        event,
        properties: {
          ...config.defaultTrackingProps,
          ...properties,
        },
      })
    )}`,
    {
      method: 'GET',
      keepalive: true,
      mode: 'no-cors',
    }
  ).catch(e => {
    // Fail silently on production
    if (process.env.NODE_ENV !== 'production') {
      console.error(e);
    }
  });
};

export const onInit = () => {
  trackQueue.forEach(queue => {
    track(...queue);
  });
};
