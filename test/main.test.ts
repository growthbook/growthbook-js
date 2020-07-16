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

const parseCall = (call: any): { init: any; host: string; payload: any } => {
  const [url, init] = call;

  if (typeof url !== 'string') {
    throw new Error('Expected string url, received ' + typeof url + ': ' + url);
  }

  const [host, payload] = url.split('/t?payload=');
  return {
    init,
    host,
    payload: JSON.parse(decodeURIComponent(payload)),
  };
};

// Allow mocking window.location values (e.g. for querystring variation forcing)
global.window = Object.create(window);
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
  },
  writable: true,
});

describe('experiments', () => {
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

  it('querystring force', () => {
    fetchMock.mockResponse(JSON.stringify({}));

    growthbook.configure({
      experimentQueryStringOverride: true,
    });

    window.location.search = '?forced-test-qs=1';

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);

    window.location.search = '';
    growthbook.configure({
      experimentQueryStringOverride: false,
    });

    expect(fetchMock.mock.calls.length).toEqual(0);
  });

  it('track override', () => {
    fetchMock.mockResponse(JSON.stringify({}));

    let customTrack;
    growthbook.configure({
      trackExperimentOverride: (experiment, variation) => {
        customTrack = { experiment, variation };
      },
    });

    chooseVariation('123', 'my-tracked-test');

    expect(fetchMock.mock.calls.length).toEqual(0);
    expect(customTrack).toEqual({
      experiment: 'my-tracked-test',
      variation: 1,
    });

    growthbook.configure({
      trackExperimentOverride: undefined,
    });
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

describe('tracking', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({}));
    growthbook.resetDefaultTrackingProps();
    growthbook.configure({
      trackingHost: 'https://track.example.com',
      userId: '123',
      anonymousId: 'abc',
    });
  });

  it('hits correct endpoint', () => {
    growthbook.track('clicked_button', { color: 'red' });

    expect(fetchMock.mock.calls.length).toEqual(1);
    const { init, host, payload } = parseCall(fetchMock.mock.calls[0]);

    expect(init).toEqual({
      method: 'GET',
      keepalive: true,
      mode: 'no-cors',
    });
    expect(host).toEqual('https://track.example.com');
    expect(payload).toEqual({
      user_id: '123',
      anonymous_id: 'abc',
      url: 'http://localhost/',
      referrer: '',
      event: 'clicked_button',
      properties: {
        color: 'red',
      },
    });
  });

  it('default tracking props', () => {
    growthbook.configure({
      defaultTrackingProps: {
        extra: 'prop',
      },
    });
    growthbook.track('clicked_button', { color: 'red' });

    expect(fetchMock.mock.calls.length).toEqual(1);
    const { payload } = parseCall(fetchMock.mock.calls[0]);
    expect(payload.properties).toEqual({
      extra: 'prop',
      color: 'red',
    });
  });

  it('tracking props merge', () => {
    // Merge tracking props from multiple configure calls
    growthbook.configure({
      defaultTrackingProps: {
        extra: 'prop',
      },
    });
    growthbook.configure({
      defaultTrackingProps: {
        another: 'one',
      },
    });
    growthbook.track('clicked_button', { color: 'red' });

    expect(fetchMock.mock.calls.length).toEqual(1);
    const { payload } = parseCall(fetchMock.mock.calls[0]);

    expect(payload.properties).toEqual({
      extra: 'prop',
      another: 'one',
      color: 'red',
    });
  });

  it('complex props', () => {
    const props = {
      string: 'string',
      number: 123.4,
      boolean: true,
      array: ['hello', 'world'],
      object: {
        key: 'value',
      },
    };

    growthbook.track('clicked_button', props);

    expect(fetchMock.mock.calls.length).toEqual(1);
    const { payload } = parseCall(fetchMock.mock.calls[0]);

    expect(payload.properties).toEqual(props);
  });

  it('event queue', () => {
    growthbook.configure({
      trackingHost: undefined,
    });

    growthbook.track('clicked_button', {});
    expect(fetchMock.mock.calls.length).toEqual(0);

    growthbook.configure({
      trackingHost: 'https://track2.example.com',
    });
    expect(fetchMock.mock.calls.length).toEqual(1);

    const { host } = parseCall(fetchMock.mock.calls[0]);
    expect(host).toEqual('https://track2.example.com');
  });
});

describe('browser init', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({}));
    growthbook.resetDefaultTrackingProps();
    growthbook.resetExperimentConfig();
  });

  it('init experiments', () => {
    window.GB_DATA = window.GB_DATA || [];
    window.GB_DATA.push({
      experiments: {
        'my-init-experiment': {
          variation: 1,
        },
      },
      events: {},
    });

    expect(chooseVariation('1', 'my-init-experiment')).toEqual(1);
  });

  it('init dom tracking', () => {
    window.GB_DATA = window.GB_DATA || [];
    window.GB_DATA.push({
      experiments: {},
      events: {
        click: [
          {
            name: 'clicked_my_button',
            selector: '.my-button',
            properties: {
              color: 'green',
            },
          },
        ],
      },
    });

    // Click on button
    document.body.innerHTML =
      '<div>' +
      '  <span id="username" />' +
      '  <button class="my-button" />' +
      '</div>';
    let el = document.querySelector('.my-button');
    if (!(el instanceof HTMLElement)) {
      throw new Error('Expecting html element: ' + typeof el);
    }
    el.click();

    // See if it was tracked with the proper params
    expect(fetchMock.mock.calls.length).toEqual(1);
    const { payload } = parseCall(fetchMock.mock.calls[0]);
    expect(payload.event).toEqual('clicked_my_button');
    expect(payload.properties).toEqual({
      color: 'green',
    });
  });
});
