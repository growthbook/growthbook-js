import growthbook from '../src';
import { ExperimentParams } from '../src/types';
import { clearExperimentsTracked } from '../src/experiment';

const chooseVariation = (
  uuid: string | null,
  test: string,
  options: ExperimentParams = {}
) => {
  if (uuid) {
    growthbook.configure({
      uuid,
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
  const onAssignment = jest.fn((a, b) => {
    return [a, b];
  });
  growthbook.configure({
    onAssignment,
  });

  return onAssignment.mock;
};

describe('experiments', () => {
  beforeEach(() => {
    // Reset growthbook configuration
    growthbook.configure({
      attributes: {},
      enableQueryStringOverride: false,
      enabled: true,
      experiments: {},
      onAssignment: () => {
        // Nothing
      },
      uuid: undefined,
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
  it('missing uuid', () => {
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
});
