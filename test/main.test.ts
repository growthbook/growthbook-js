import growthbook from '../src';
import { ExperimentParams, AnalyticsWindow } from '../src/types';
import { clearExperimentsTracked } from '../src/experiment';

const chooseVariation = (
  userId: string | null,
  test: string,
  options: ExperimentParams = {}
) => {
  if (userId) {
    growthbook.configure({
      userId,
    });
  }
  return growthbook.experiment(test, options);
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
  const onExperimentViewed = jest.fn((a, b) => {
    return [a, b];
  });
  growthbook.configure({
    onExperimentViewed,
  });

  return onExperimentViewed.mock;
};

describe('experiments', () => {
  beforeEach(() => {
    // Reset growthbook configuration
    growthbook.configure({
      attributes: {},
      enableQueryStringOverride: false,
      enabled: true,
      experiments: {},
      onExperimentViewed: () => {
        // Nothing
      },
      userId: undefined,
      ga: undefined,
      segment: false,
    });
    clearExperimentsTracked();
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
    expect(chooseVariation(null, 'my-test')).toBeGreaterThan(-1);
  });
  it('tracking', () => {
    const mock = mockCallback();

    chooseVariation('1', 'my-tracked-test');
    chooseVariation('1', 'my-tracked-test');
    chooseVariation('1', 'my-tracked-test');
    chooseVariation('1', 'my-other-tracked-test');
    chooseVariation('2', 'my-other-tracked-test');

    expect(mock.calls.length).toEqual(3);
    expect(mock.calls[0][0]).toEqual('my-tracked-test');
    expect(mock.calls[0][1]).toEqual(1);
  });

  it('override variation', () => {
    expect(chooseVariation('6', 'forced-test')).toEqual(0);

    const mock = mockCallback();
    growthbook.configure({
      experiments: {
        'forced-test': { force: 1 },
      },
    });
    expect(chooseVariation('6', 'forced-test')).toEqual(1);
    expect(mock.calls.length).toEqual(0);
  });

  it('override weights', () => {
    growthbook.configure({
      experiments: {
        'my-test': { weights: [0.1, 0.9] },
      },
    });
    expect(chooseVariation('2', 'my-test')).toEqual(1);
  });

  it('override coverage', () => {
    growthbook.configure({
      experiments: {
        'my-test': { coverage: 0.4 },
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);
  });

  it('targeting', () => {
    growthbook.configure({
      experiments: {
        'my-test': {
          targeting: [
            'member = true',
            'age > 18',
            'source ~ (google|yahoo)',
            'name != matt',
            'email !~ ^.*@exclude.com$',
          ],
        },
      },
    });

    // Matches all
    growthbook.configure({
      attributes: {
        member: true,
        age: 21,
        source: 'yahoo',
        name: 'george',
        email: 'test@example.com',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(1);

    // Missing negative checks
    growthbook.configure({
      attributes: {
        member: true,
        age: 21,
        source: 'yahoo',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(1);

    // Missing all attributes
    growthbook.configure({
      attributes: {},
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    // Fails boolean
    growthbook.configure({
      attributes: {
        member: false,
        age: 21,
        source: 'yahoo',
        name: 'george',
        email: 'test@example.com',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    // Fails number
    growthbook.configure({
      attributes: {
        member: true,
        age: 17,
        source: 'yahoo',
        name: 'george',
        email: 'test@example.com',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    // Fails regex
    growthbook.configure({
      attributes: {
        member: true,
        age: 21,
        source: 'goog',
        name: 'george',
        email: 'test@example.com',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    // Fails not equals
    growthbook.configure({
      attributes: {
        member: true,
        age: 21,
        source: 'yahoo',
        name: 'matt',
        email: 'test@example.com',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    // Fails not regex
    growthbook.configure({
      attributes: {
        member: true,
        age: 21,
        source: 'yahoo',
        name: 'george',
        email: 'test@exclude.com',
      },
    });
    expect(chooseVariation('1', 'my-test')).toEqual(-1);
  });

  it('experiments disabled', () => {
    const mock = mockCallback();
    growthbook.configure({
      enabled: false,
    });

    expect(chooseVariation('1', 'disabled-test')).toEqual(-1);
    expect(mock.calls.length).toEqual(0);
  });

  it('querystring force', () => {
    window.location.search = '?forced-test-qs=1';

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(0);

    growthbook.configure({
      enableQueryStringOverride: true,
    });

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);
  });

  it('querystring force disabled tracking', () => {
    const mock = mockCallback();
    growthbook.configure({
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
    growthbook.configure({
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
    growthbook.configure({
      ga: 5,
      segment: true,
    });

    // No errors thrown, even though window.ga and window.analytics are missing
    expect(chooseVariation('2', 'my-test')).toEqual(0);
  });
});
