import { ClientConfigInterface, UserArg, Experiment } from './types';
import GrowthBookUser from './user';

export const clients: Set<GrowthBookClient> = new Set();

export default class GrowthBookClient {
  config: ClientConfigInterface;
  experiments: Experiment[] = [];
  users: GrowthBookUser[] = [];

  private _enabled: boolean;

  constructor(config: Partial<ClientConfigInterface> = {}) {
    this._enabled = true;

    this.config = {
      enableQueryStringOverride: true,
      ...config,
    };

    if (
      !config.url &&
      typeof window !== 'undefined' &&
      window?.location?.href
    ) {
      this.config.url = window.location.href;
    }

    clients.add(this);
  }

  isEnabled() {
    return this._enabled;
  }

  enable() {
    this._enabled = true;
  }

  disable() {
    this._enabled = false;
    this.users.forEach(user => {
      user.deactivateAllExperiments();
    });
  }

  setUrl(url: string) {
    this.config.url = url;
    this.users.forEach(user => {
      user.refreshActiveExperiments();
    });
  }

  user({ anonId, id, attributes }: UserArg): GrowthBookUser {
    const user = new GrowthBookUser(
      id || '',
      anonId || '',
      attributes || {},
      this
    );
    this.users.push(user);
    return user;
  }

  destroy() {
    this.users.forEach(user => {
      user.destroy();
    });
    this.users = [];
    this.experiments = [];
    this._enabled = false;

    // Remove from clients set
    clients.delete(this);
  }
}
