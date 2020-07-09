import { config } from './config';
import { queueEvent, setProcessFunction } from './queue';
import { EventProperties } from './types';

export const track = (event: string, properties: EventProperties = {}) => {
  const props = {
    ...config.defaultTrackingProps,
    ...properties,
  };

  // Tracking host hasn't been configured yet, queue up events
  if (!config.trackingHost) {
    queueEvent(event, properties);
    return;
  }
  // Not in a modern browser, skip
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
        properties: props,
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

setProcessFunction(track);
