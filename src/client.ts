import { ClientConfigInterface, UserArg, ExperimentOverride } from './types';
import GrowthBookUser from './user';

export const clients: Set<GrowthBookClient> = new Set();

export default class GrowthBookClient {
  config: ClientConfigInterface;
  overrides: Map<string, ExperimentOverride> = new Map();
  users: GrowthBookUser[] = [];
  forcedVariations: Map<string, number> = new Map();

  private subscriptions: Set<() => void> = new Set();
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
  }

  setUrl(url: string) {
    this.config.url = url;
  }

  user({ anonId, id, attributes }: UserArg): GrowthBookUser {
    const user = new GrowthBookUser(
      id || '',
      anonId || '',
      attributes || {},
      this
    );
    this.users.push(user);
    this.subscriptions.forEach(s => s());
    return user;
  }

  subscribe(cb: () => void) {
    this.subscriptions.add(cb);
    return () => this.subscriptions.delete(cb);
  }

  destroy() {
    this.users.forEach(user => {
      user.destroy();
    });
    this.users = [];
    this.overrides.clear();
    this._enabled = false;
    this.forcedVariations.clear();
    this.subscriptions.clear();

    // Remove from clients set
    clients.delete(this);
  }

  importOverrides(overrides: Record<string, ExperimentOverride>) {
    Object.keys(overrides).forEach(key => {
      this.overrides.set(key, overrides[key]);
    });
  }
}
