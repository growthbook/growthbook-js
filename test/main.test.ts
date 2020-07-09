import growthbook from '../src';
import fetchMock from 'jest-fetch-mock';

growthbook.configure({
  trackingHost: 'https://track.example.com',
});

fetchMock.enableMocks();

const chooseVariation = (uid: string, test: string, weights?: any) => {
  growthbook.configure({
    userId: uid,
  });
  return growthbook.experimentByUser(test, weights);
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
    expect(chooseVariation('1', 'my-test', [0.1, 0.9])).toEqual(1);
    expect(chooseVariation('2', 'my-test', [0.1, 0.9])).toEqual(1);
    expect(chooseVariation('3', 'my-test', [0.1, 0.9])).toEqual(0);
    expect(chooseVariation('4', 'my-test', [0.1, 0.9])).toEqual(1);
    expect(chooseVariation('5', 'my-test', [0.1, 0.9])).toEqual(1);
    expect(chooseVariation('6', 'my-test', [0.1, 0.9])).toEqual(1);
    expect(chooseVariation('7', 'my-test', [0.1, 0.9])).toEqual(0);
    expect(chooseVariation('8', 'my-test', [0.1, 0.9])).toEqual(1);
    expect(chooseVariation('9', 'my-test', [0.1, 0.9])).toEqual(1);
  });
  it('coverage', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    expect(chooseVariation('1', 'my-test', [0.2, 0.2])).toEqual(-1);
    expect(chooseVariation('2', 'my-test', [0.2, 0.2])).toEqual(0);
    expect(chooseVariation('3', 'my-test', [0.2, 0.2])).toEqual(0);
    expect(chooseVariation('4', 'my-test', [0.2, 0.2])).toEqual(-1);
    expect(chooseVariation('5', 'my-test', [0.2, 0.2])).toEqual(-1);
    expect(chooseVariation('6', 'my-test', [0.2, 0.2])).toEqual(-1);
    expect(chooseVariation('7', 'my-test', [0.2, 0.2])).toEqual(0);
    expect(chooseVariation('8', 'my-test', [0.2, 0.2])).toEqual(-1);
    expect(chooseVariation('9', 'my-test', [0.2, 0.2])).toEqual(1);
  });
  it('threeWayTest', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    expect(chooseVariation('1', 'my-test', [0.34, 0.33, 0.33])).toEqual(2);
    expect(chooseVariation('2', 'my-test', [0.34, 0.33, 0.33])).toEqual(0);
    expect(chooseVariation('3', 'my-test', [0.34, 0.33, 0.33])).toEqual(0);
    expect(chooseVariation('4', 'my-test', [0.34, 0.33, 0.33])).toEqual(2);
    expect(chooseVariation('5', 'my-test', [0.34, 0.33, 0.33])).toEqual(1);
    expect(chooseVariation('6', 'my-test', [0.34, 0.33, 0.33])).toEqual(2);
    expect(chooseVariation('7', 'my-test', [0.34, 0.33, 0.33])).toEqual(0);
    expect(chooseVariation('8', 'my-test', [0.34, 0.33, 0.33])).toEqual(1);
    expect(chooseVariation('9', 'my-test', [0.34, 0.33, 0.33])).toEqual(0);
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

  it('forced', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    expect(chooseVariation('6', 'forced-test')).toEqual(0);
    growthbook.configure({
      experimentConfig: {
        'forced-test': 1,
      },
    });
    expect(chooseVariation('6', 'forced-test')).toEqual(1);
    growthbook.resetExperimentConfig();
  });

  it('forced, tracking disabled', () => {
    fetchMock.mockResponse(JSON.stringify({}));
    growthbook.configure({
      experimentConfig: {
        'forced-test-2': 1,
      },
    });
    chooseVariation('1', 'forced-test-2');
    growthbook.resetExperimentConfig();

    expect(fetchMock.mock.calls.length).toEqual(0);
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
});
