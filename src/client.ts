import { ClientConfigInterface, UserArg, Experiment } from './types';
import GrowthBookUser from './user';

export default class GrowthBookClient {
  config: ClientConfigInterface;
  experiments: Experiment[] = [];
  users: GrowthBookUser[] = [];

  private onPopState: () => void;

  constructor(config: Partial<ClientConfigInterface> = {}) {
    this.config = {
      enabled: true,
      ...config,
    };

    this.onPopState = () => {
      this.setUrl(window.location.href);
    };

    if (
      !config.url &&
      typeof window !== 'undefined' &&
      window?.location?.href
    ) {
      this.config.url = window.location.href;
      window.addEventListener('popstate', this.onPopState);
    }
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.onPopState);
    }
    this.users.forEach(user => {
      user.destroy();
    });
    this.users = [];
    this.experiments = [];
  }
}
