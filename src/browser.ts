import { clients } from './client';

export type Method = 'disable' | 'enable';

declare global {
  interface Window {
    growthbook:
      | Method[]
      | {
          push: (method: Method) => void;
        };
  }
}

if (typeof window !== 'undefined') {
  const queue = (window.growthbook || []) as Method[];

  window.growthbook = {
    push: (method: Method) => {
      if (method === 'disable') {
        clients.forEach(client => {
          client.disable();
        });
      } else if (method === 'enable') {
        clients.forEach(client => {
          client.enable();
        });
      }
    },
  };

  queue.forEach(method => {
    window.growthbook.push(method);
  });
}
