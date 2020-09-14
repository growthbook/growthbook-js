import GrowthBookClient from '../src';
import {
  ExperimentParams,
  AnalyticsWindow,
  UserAttributes,
} from '../src/types';
import fetchMock from 'jest-fetch-mock';

const client = new GrowthBookClient();

const chooseVariation = (
  userId: string,
  experiment: string,
  options: ExperimentParams = {},
  attributes?: UserAttributes
) => {
  const user = client.user(userId, attributes);
  return user.experiment(experiment, options).variation;
};

// Allow mocking window.location values (e.g. for querystring variation forcing)
global.window = Object.create(window);
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
  },
  writable: true,
});

const mockCallback = () => {
  const onExperimentViewed = jest.fn(a => {
    return a;
  });
  client.configure({
    onExperimentViewed,
  });

  return onExperimentViewed.mock;
};

describe('experiments', () => {
  beforeEach(() => {
    // Reset growthbook configuration
    client.configure({
      enableQueryStringOverride: false,
      enabled: true,
      onExperimentViewed: () => {
        // Nothing
      },
      ga: undefined,
      segment: undefined,
    });
    client.setExperimentConfigs({});
    window.location.search = '';
  });

  it('defaultWeights', () => {
    expect(chooseVariation('1', 'my-test')).toEqual(1);
    expect(chooseVariation('2', 'my-test')).toEqual(0);
    expect(chooseVariation('3', 'my-test')).toEqual(0);
    expect(chooseVariation('4', 'my-test')).toEqual(1);
    expect(chooseVariation('5', 'my-test')).toEqual(1);
    expect(chooseVariation('6', 'my-test')).toEqual(1);
    expect(chooseVariation('7', 'my-test')).toEqual(0);
    expect(chooseVariation('8', 'my-test')).toEqual(1);
    expect(chooseVariation('9', 'my-test')).toEqual(0);
  });
  it('unevenWeights', () => {
    expect(chooseVariation('1', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
    expect(chooseVariation('2', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
    expect(chooseVariation('3', 'my-test', { weights: [0.1, 0.9] })).toEqual(0);
    expect(chooseVariation('4', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
    expect(chooseVariation('5', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
    expect(chooseVariation('6', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
    expect(chooseVariation('7', 'my-test', { weights: [0.1, 0.9] })).toEqual(0);
    expect(chooseVariation('8', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
    expect(chooseVariation('9', 'my-test', { weights: [0.1, 0.9] })).toEqual(1);
  });
  it('coverage', () => {
    expect(chooseVariation('1', 'my-test', { coverage: 0.4 })).toEqual(-1);
    expect(chooseVariation('2', 'my-test', { coverage: 0.4 })).toEqual(0);
    expect(chooseVariation('3', 'my-test', { coverage: 0.4 })).toEqual(0);
    expect(chooseVariation('4', 'my-test', { coverage: 0.4 })).toEqual(-1);
    expect(chooseVariation('5', 'my-test', { coverage: 0.4 })).toEqual(-1);
    expect(chooseVariation('6', 'my-test', { coverage: 0.4 })).toEqual(-1);
    expect(chooseVariation('7', 'my-test', { coverage: 0.4 })).toEqual(0);
    expect(chooseVariation('8', 'my-test', { coverage: 0.4 })).toEqual(-1);
    expect(chooseVariation('9', 'my-test', { coverage: 0.4 })).toEqual(1);
  });
  it('threeWayTest', () => {
    expect(chooseVariation('1', 'my-test', { variations: 3 })).toEqual(2);
    expect(chooseVariation('2', 'my-test', { variations: 3 })).toEqual(0);
    expect(chooseVariation('3', 'my-test', { variations: 3 })).toEqual(0);
    expect(chooseVariation('4', 'my-test', { variations: 3 })).toEqual(2);
    expect(chooseVariation('5', 'my-test', { variations: 3 })).toEqual(1);
    expect(chooseVariation('6', 'my-test', { variations: 3 })).toEqual(2);
    expect(chooseVariation('7', 'my-test', { variations: 3 })).toEqual(0);
    expect(chooseVariation('8', 'my-test', { variations: 3 })).toEqual(1);
    expect(chooseVariation('9', 'my-test', { variations: 3 })).toEqual(0);
  });
  it('testName', () => {
    expect(chooseVariation('1', 'my-test')).toEqual(1);
    expect(chooseVariation('1', 'my-test-3')).toEqual(0);
  });
  it('missing userId', () => {
    expect(chooseVariation('', 'my-test')).toEqual(-1);
  });
  it('tracking', () => {
    const mock = mockCallback();

    const user1 = client.user('1');
    const user2 = client.user('2');

    user1.experiment('my-tracked-test');
    user1.experiment('my-tracked-test');
    user1.experiment('my-tracked-test');
    user1.experiment('my-other-tracked-test');
    user2.experiment('my-other-tracked-test');

    expect(mock.calls.length).toEqual(3);
    expect(mock.calls[0][0]).toEqual({
      experiment: 'my-tracked-test',
      variation: 1,
      data: {},
      userId: '1',
      userAttributes: {},
    });
    expect(mock.calls[1][0]).toEqual({
      experiment: 'my-other-tracked-test',
      variation: 0,
      data: {},
      userId: '1',
      userAttributes: {},
    });
    expect(mock.calls[2][0]).toEqual({
      experiment: 'my-other-tracked-test',
      variation: 1,
      data: {},
      userId: '2',
      userAttributes: {},
    });
  });

  it('override variation', () => {
    expect(chooseVariation('6', 'forced-test')).toEqual(0);

    const mock = mockCallback();
    client.setExperimentConfigs({
      'forced-test': { force: 1 },
    });
    expect(chooseVariation('6', 'forced-test')).toEqual(1);
    expect(mock.calls.length).toEqual(0);
  });

  it('override weights', () => {
    client.setExperimentConfigs({
      'my-test': { weights: [0.1, 0.9] },
    });
    expect(chooseVariation('2', 'my-test')).toEqual(1);
  });

  it('override coverage', () => {
    client.setExperimentConfigs({
      'my-test': { coverage: 0.4 },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);
  });

  it('targeting', () => {
    client.setExperimentConfigs({
      'my-test': {
        targeting: [
          'member = true',
          'age > 18',
          'source ~ (google|yahoo)',
          'name != matt',
          'email !~ ^.*@exclude.com$',
        ],
      },
    });

    // Matches all
    const user = client.user('1', {
      member: true,
      age: 21,
      source: 'yahoo',
      name: 'george',
      email: 'test@example.com',
    });
    expect(user.experiment('my-test').variation).toEqual(1);

    // Missing negative checks
    user.setAttributes(
      {
        member: true,
        age: 21,
        source: 'yahoo',
      },
      false
    );
    expect(user.experiment('my-test').variation).toEqual(1);

    // Missing all attributes
    user.setAttributes({}, false);
    expect(user.experiment('my-test').variation).toEqual(-1);

    // Fails boolean
    user.setAttributes(
      {
        member: false,
        age: 21,
        source: 'yahoo',
        name: 'george',
        email: 'test@example.com',
      },
      false
    );
    expect(user.experiment('my-test').variation).toEqual(-1);

    // Fails number
    user.setAttributes(
      {
        member: true,
        age: 17,
        source: 'yahoo',
        name: 'george',
        email: 'test@example.com',
      },
      false
    );
    expect(user.experiment('my-test').variation).toEqual(-1);

    // Fails regex
    user.setAttributes(
      {
        member: true,
        age: 21,
        source: 'goog',
        name: 'george',
        email: 'test@example.com',
      },
      false
    );
    expect(user.experiment('my-test').variation).toEqual(-1);

    // Fails not equals
    user.setAttributes(
      {
        member: true,
        age: 21,
        source: 'yahoo',
        name: 'matt',
        email: 'test@example.com',
      },
      false
    );
    expect(user.experiment('my-test').variation).toEqual(-1);

    // Fails not regex
    user.setAttributes(
      {
        member: true,
        age: 21,
        source: 'yahoo',
        name: 'george',
        email: 'test@exclude.com',
      },
      false
    );
    expect(user.experiment('my-test').variation).toEqual(-1);
  });

  it('experiments disabled', () => {
    const mock = mockCallback();
    client.configure({
      enabled: false,
    });

    expect(chooseVariation('1', 'disabled-test')).toEqual(-1);
    expect(mock.calls.length).toEqual(0);
  });

  it('querystring force', () => {
    window.location.search = '?forced-test-qs=1';

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(0);

    client.configure({
      enableQueryStringOverride: true,
    });

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);
  });

  it('querystring force disabled tracking', () => {
    const mock = mockCallback();
    client.configure({
      enableQueryStringOverride: true,
    });

    window.location.search = '?forced-test-qs=1';
    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);

    expect(mock.calls.length).toEqual(0);
  });

  it('querystring ga segment tracking', () => {
    const segment = jest.fn((a, b) => {
      return [a, b];
    });
    const ga = jest.fn((a, b, c, d, e) => {
      return [a, b, c, d, e];
    });
    (window as AnalyticsWindow).analytics = {
      track: segment,
    };
    (window as AnalyticsWindow).ga = ga;

    // Should not track by default
    chooseVariation('1', 'my-test');
    expect(segment.mock.calls.length).toEqual(0);
    expect(ga.mock.calls.length).toEqual(0);

    // Opt into tracking
    client.configure({
      ga: 5,
      segment: true,
    });

    // Should track now
    expect(chooseVariation('2', 'my-test')).toEqual(0);
    expect(segment.mock.calls.length).toEqual(1);
    expect(segment.mock.calls[0]).toEqual([
      'Experiment Viewed',
      { experiment_id: 'my-test', variation_id: 0 },
    ]);
    expect(ga.mock.calls.length).toEqual(2);
    expect(ga.mock.calls[0]).toEqual(['set', 'dimension5', 'my-test:0']);
    expect(ga.mock.calls[1]).toEqual([
      'send',
      'event',
      'experiment',
      'my-test',
      '0',
    ]);
  });

  it('querystring missing ga and segment', () => {
    // Opt into tracking
    client.configure({
      ga: 5,
      segment: true,
    });

    // No errors thrown, even though window.ga and window.analytics are missing
    expect(chooseVariation('2', 'my-test')).toEqual(0);
  });

  it('configData experiment', () => {
    const user = client.user('1');

    expect(
      user.experiment('my-test', {
        data: {
          color: ['blue', 'green'],
          size: ['small', 'large'],
        },
      })
    ).toEqual({
      experiment: 'my-test',
      variation: 1,
      data: {
        color: 'green',
        size: 'large',
      },
    });

    // Fallback to control config data if not in test
    expect(
      user.experiment('my-test', {
        coverage: 0.01,
        data: {
          color: ['blue', 'green'],
          size: ['small', 'large'],
        },
      })
    ).toEqual({
      experiment: 'my-test',
      variation: -1,
      data: {
        color: 'blue',
        size: 'small',
      },
    });
  });

  it('pull configs from api', async () => {
    fetchMock.enableMocks();
    fetchMock.mockResponse(
      JSON.stringify({
        status: 200,
        experiments: {
          'my-test': {
            variations: 3,
          },
        },
      })
    );

    await client.pullExperimentConfigs('12345');

    expect(client.experiments).toEqual({
      'my-test': {
        variations: 3,
      },
    });
  });

  it('pull configs from api 403', async () => {
    fetchMock.enableMocks();
    fetchMock.mockResponseOnce(
      JSON.stringify({
        status: 403,
        message: 'Invalid API key',
      })
    );

    await client.pullExperimentConfigs('12345');

    expect(client.experiments).toEqual({});
  });

  it('pull configs from api network error', async () => {
    fetchMock.enableMocks();
    const error = new Error('Network error');
    fetchMock.mockRejectOnce(error);

    // Mock console.error
    const origError = console.error;
    const consoleErrors: any[] = [];
    console.error = (...args: any[]) => {
      consoleErrors.push(args);
    };

    await client.pullExperimentConfigs('12345');

    // Restore original console.error
    console.error = origError;

    expect(client.experiments).toEqual({});
    expect(consoleErrors.length).toEqual(1);
    expect(consoleErrors[0][0]).toEqual(error);
  });

  it('configData lookup', () => {
    client.setExperimentConfigs({
      'button-color-size-chrome': {
        targeting: ['browser = chrome'],
        data: {
          'button.color': ['blue', 'green'],
          'button.size': ['small', 'large'],
        },
      },
      'button-color-safari': {
        targeting: ['browser = safari'],
        data: {
          'button.color': ['blue', 'green'],
        },
      },
    });

    const user = client.user('1');

    // No matches
    expect(user.lookupByDataKey('button.unknown')).toEqual({
      experiment: undefined,
      variation: undefined,
      value: undefined,
    });

    // First matching experiment
    user.setAttributes({
      browser: 'chrome',
    });
    expect(user.lookupByDataKey('button.color')).toEqual({
      experiment: 'button-color-size-chrome',
      variation: 0,
      value: 'blue',
    });
    expect(user.lookupByDataKey('button.size')).toEqual({
      experiment: 'button-color-size-chrome',
      variation: 0,
      value: 'small',
    });

    // Fallback experiment
    user.setAttributes({
      browser: 'safari',
    });
    expect(user.lookupByDataKey('button.color')).toEqual({
      experiment: 'button-color-safari',
      variation: 0,
      value: 'blue',
    });

    // Fallback undefined
    expect(user.lookupByDataKey('button.size')).toEqual({
      experiment: undefined,
      variation: undefined,
      value: undefined,
    });
  });
});
