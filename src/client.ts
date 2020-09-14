import { ClientConfigInterface, UserAttributes } from './types';
import GrowthBookUser from './user';

export default class GrowthBookClient {
  config: ClientConfigInterface;

  constructor(config: Partial<ClientConfigInterface> = {}) {
    this.config = config;
  }

  configure(config: Partial<ClientConfigInterface>): void {
    Object.assign(this.config, config);
  }

  user(id: string, attributes: UserAttributes = {}): GrowthBookUser {
    return new GrowthBookUser(id, attributes, this);
  }
}
