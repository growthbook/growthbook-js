import growthbook from '../src';
import { ExperimentOptions } from '../src/experiment';
import fetchMock from 'jest-fetch-mock';

growthbook.configure({
  trackingHost: 'https://track.example.com',
});

fetchMock.enableMocks();

const chooseVariation = (
  uid: string,
  test: string,
  options: ExperimentOptions = {}
) => {
  growthbook.configure({
    userId: uid,
  });
  return growthbook.experimentByUser(test, options);
};

describe('bucketing', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('defaultWeights', () => {
    fetchMock.mockResponse(JSON.stringify({}));
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
    fetchMock.mockResponse(JSON.stringify({}));
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
    fetchMock.mockResponse(JSON.stringify({}));
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
    fetchMock.mockResponse(JSON.stringify({}));
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
    fetchMock.mockResponse(JSON.stringify({}));
    expect(chooseVariation('1', 'my-test')).toEqual(1);
    expect(chooseVariation('1', 'my-test-3')).toEqual(0);
  });
  it('missing uid', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    expect(chooseVariation('', 'my-test')).toEqual(-1);
  });
  it('tracking', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    chooseVariation('1', 'my-tracked-test');
    chooseVariation('1', 'my-tracked-test');
    chooseVariation('1', 'my-tracked-test');
    chooseVariation('1', 'my-other-tracked-test');
    chooseVariation('2', 'my-other-tracked-test');

    expect(fetchMock.mock.calls.length).toEqual(3);
  });

  it('override variation', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    expect(chooseVariation('6', 'forced-test')).toEqual(0);
    growthbook.configure({
      experimentConfig: {
        'forced-test': { variation: 1 },
      },
    });
    expect(chooseVariation('6', 'forced-test')).toEqual(1);
    growthbook.resetExperimentConfig();
  });

  it('override variation, tracking disabled', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    growthbook.configure({
      experimentConfig: {
        'forced-test-2': { variation: 1 },
      },
    });
    chooseVariation('1', 'forced-test-2');
    growthbook.resetExperimentConfig();

    expect(fetchMock.mock.calls.length).toEqual(0);
  });

  it('override weights', () => {
    fetchMock.mockResponse(JSON.stringify({}));

    growthbook.configure({
      experimentConfig: {
        'my-test': { weights: [0.1, 0.9] },
      },
    });

    expect(chooseVariation('2', 'my-test')).toEqual(1);

    growthbook.resetExperimentConfig();
  });

  it('override coverage', () => {
    fetchMock.mockResponse(JSON.stringify({}));

    growthbook.configure({
      experimentConfig: {
        'my-test': { coverage: 0.4 },
      },
    });

    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    growthbook.resetExperimentConfig();
  });

  it('experiments disabled', () => {
    fetchMock.mockResponse(JSON.stringify({}));

    growthbook.configure({
      enableExperiments: false,
    });

    expect(chooseVariation('1', 'disabled-test')).toEqual(-1);

    growthbook.configure({
      enableExperiments: true,
    });

    expect(fetchMock.mock.calls.length).toEqual(0);
  });

  it('localStorage persist', () => {
    fetchMock.mockResponse(JSON.stringify({}));

    growthbook.configure({
      anonymousId: '12345',
      userId: '12345',
    });
    // Device experiments should persist the variation in local storage and ignore weight changes
    expect(
      growthbook.experimentByDevice('my-device-test', { weights: [0.99, 0.01] })
    ).toEqual(0);
    expect(
      growthbook.experimentByDevice('my-device-test', { weights: [0.01, 0.99] })
    ).toEqual(0);

    // User experiments should NOT use local storage and instead change when the weights change
    expect(
      growthbook.experimentByUser('my-user-test', { weights: [0.01, 0.99] })
    ).toEqual(1);
    expect(
      growthbook.experimentByUser('my-user-test', { weights: [0.99, 0.01] })
    ).toEqual(0);
  });
});
