import { EventProperties, TrackFunction } from './types';

type QueueEntry = [string, EventProperties];

let q: QueueEntry[] = [];

let processFunction: TrackFunction | null = null;

export const setProcessFunction = (f: TrackFunction) => {
  processFunction = f;
};

export const queueEvent = (eventName: string, properties: EventProperties) => {
  q.push([eventName, properties]);
};

export const processQueue = () => {
  if (!processFunction) {
    return;
  }

  const items = [...q];
  q = [];

  items.forEach(([event, properties]) => {
    if (processFunction) {
      processFunction(event, properties);
    }
  });
};
