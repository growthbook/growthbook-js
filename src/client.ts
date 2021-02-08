import { ClientConfigInterface, UserArg, Experiment } from './types';
import GrowthBookUser from './user';

export default class GrowthBookClient {
  config: ClientConfigInterface;
  experiments: Experiment[] = [];

  constructor(config: Partial<ClientConfigInterface> = {}) {
    this.config = {
      ...config
    };

    if(!config.url && typeof window !== "undefined" && window?.location?.href) {
      this.config.url = window.location.href;
    }
  }

  user({ anonId, id, attributes }: UserArg): GrowthBookUser {
    return new GrowthBookUser(id || '', anonId || '', attributes || {}, this);
  }
}
