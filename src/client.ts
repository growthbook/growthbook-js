import {
  ClientConfigInterface,
  UserAttributes,
  ExperimentsConfig,
} from './types';
import GrowthBookUser from './user';

export default class GrowthBookClient {
  config: ClientConfigInterface;
  experiments: ExperimentsConfig = {};

  constructor(config: Partial<ClientConfigInterface> = {}) {
    this.config = config;
  }

  configure(config: Partial<ClientConfigInterface>): void {
    // TODO: validate config options
    Object.assign(this.config, config);
  }

  setExperimentConfigs(experiments: ExperimentsConfig): void {
    this.experiments = experiments;
  }

  user(id: string, attributes: UserAttributes = {}): GrowthBookUser {
    return new GrowthBookUser(id, attributes, this);
  }

  async pullExperimentConfigs(apiKey: string): Promise<boolean> {
    if (typeof window === 'undefined' || !window.fetch) {
      return false;
    }
    try {
      const res = await fetch(`https://cdn.growthbook.io/config/${apiKey}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 200 && json.experiments) {
          this.experiments = json.experiments;
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }

    return false;
  }
}
