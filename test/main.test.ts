import {
  clearAppliedDomChanges,
  getWeightsFromOptions,
  checkRule,
  getQueryStringOverride,
} from '../src/util';
import GrowthBookClient from '../src';
import { Experiment, UserAttributes } from '../src/types';

const client = new GrowthBookClient();

const chooseVariation = (
  userId: string | null,
  experiment: string | Experiment,
  attributes?: UserAttributes,
  anonId?: string
) => {
  const user = client.user({
    id: userId || '',
    anonId: anonId || '',
    attributes: attributes || {},
  });
  return user.experiment(experiment).variation;
};

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
  client.config.onExperimentViewed = onExperimentViewed;

  return onExperimentViewed.mock;
};

describe('experiments', () => {
  beforeEach(() => {
    // Reset growthbook configuration
    client.config.enableQueryStringOverride = false;
    client.config.enabled = true;
    client.config.onExperimentViewed = undefined;
    client.config.url = '';
    client.experiments = [];
    client.users = [];
    clearAppliedDomChanges();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('client has default options', () => {
    const newClient = new GrowthBookClient();
    expect(newClient.config.enabled).toEqual(true);
    expect(!!newClient.config.enableQueryStringOverride).toEqual(false);
    expect(!!newClient.config.onExperimentViewed).toEqual(false);
  });

  it('missing variations', () => {
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    client.experiments.push({
      key: 'my-test',
      variations: 2,
    });

    expect(chooseVariation('1', 'my-test')).toEqual(1);
  });

  it('defaultWeights', () => {
    const exp = {
      key: 'my-test',
      variations: 2,
    };

    expect(chooseVariation('1', exp)).toEqual(1);
    expect(chooseVariation('2', exp)).toEqual(0);
    expect(chooseVariation('3', exp)).toEqual(0);
    expect(chooseVariation('4', exp)).toEqual(1);
    expect(chooseVariation('5', exp)).toEqual(1);
    expect(chooseVariation('6', exp)).toEqual(1);
    expect(chooseVariation('7', exp)).toEqual(0);
    expect(chooseVariation('8', exp)).toEqual(1);
    expect(chooseVariation('9', exp)).toEqual(0);
  });
  it('unevenWeights', () => {
    const exp = {
      key: 'my-test',
      variations: 2,
      variationInfo: [{ weight: 0.1 }, { weight: 0.9 }],
    };

    expect(chooseVariation('1', exp)).toEqual(1);
    expect(chooseVariation('2', exp)).toEqual(1);
    expect(chooseVariation('3', exp)).toEqual(0);
    expect(chooseVariation('4', exp)).toEqual(1);
    expect(chooseVariation('5', exp)).toEqual(1);
    expect(chooseVariation('6', exp)).toEqual(1);
    expect(chooseVariation('7', exp)).toEqual(0);
    expect(chooseVariation('8', exp)).toEqual(1);
    expect(chooseVariation('9', exp)).toEqual(1);
  });
  it('coverage', () => {
    const exp = {
      key: 'my-test',
      variations: 2,
      coverage: 0.4,
    };

    expect(chooseVariation('1', exp)).toEqual(-1);
    expect(chooseVariation('2', exp)).toEqual(0);
    expect(chooseVariation('3', exp)).toEqual(0);
    expect(chooseVariation('4', exp)).toEqual(-1);
    expect(chooseVariation('5', exp)).toEqual(-1);
    expect(chooseVariation('6', exp)).toEqual(-1);
    expect(chooseVariation('7', exp)).toEqual(0);
    expect(chooseVariation('8', exp)).toEqual(-1);
    expect(chooseVariation('9', exp)).toEqual(1);
  });
  it('threeWayTest', () => {
    const exp = {
      key: 'my-test',
      variations: 3,
    };

    expect(chooseVariation('1', exp)).toEqual(2);
    expect(chooseVariation('2', exp)).toEqual(0);
    expect(chooseVariation('3', exp)).toEqual(0);
    expect(chooseVariation('4', exp)).toEqual(2);
    expect(chooseVariation('5', exp)).toEqual(1);
    expect(chooseVariation('6', exp)).toEqual(2);
    expect(chooseVariation('7', exp)).toEqual(0);
    expect(chooseVariation('8', exp)).toEqual(1);
    expect(chooseVariation('9', exp)).toEqual(0);
  });
  it('testName', () => {
    expect(chooseVariation('1', { key: 'my-test', variations: 2 })).toEqual(1);
    expect(chooseVariation('1', { key: 'my-test-3', variations: 2 })).toEqual(
      0
    );
  });
  it('missing userId', () => {
    expect(chooseVariation('', { key: 'my-test', variations: 2 })).toEqual(-1);
  });
  it('anonId', () => {
    const anonExp = { key: 'my-test', variations: 2, anon: true };
    const userExp = { key: 'my-test', variations: 2, anon: false };

    expect(chooseVariation('1', userExp, {}, '1')).toEqual(1);
    expect(chooseVariation('1', userExp, {}, '2')).toEqual(1);
    expect(chooseVariation('1', anonExp, {}, '1')).toEqual(1);
    expect(chooseVariation('1', anonExp, {}, '2')).toEqual(0);
    expect(chooseVariation('1', anonExp)).toEqual(-1);
    expect(chooseVariation(null, anonExp, {}, '1')).toEqual(1);
    expect(chooseVariation(null, userExp, {}, '1')).toEqual(-1);
  });
  it('tracking', () => {
    const mock = mockCallback();

    const user1 = client.user({ id: '1' });
    const user2 = client.user({ id: '2' });

    const exp1 = { key: 'my-tracked-test', variations: 2 };
    const exp2 = { key: 'my-other-tracked-test', variations: 2 };

    user1.experiment(exp1);
    user1.experiment(exp1);
    user1.experiment(exp1);
    user1.experiment(exp2);
    user2.experiment(exp2);

    expect(mock.calls.length).toEqual(3);
    expect(mock.calls[0][0]).toEqual({
      experiment: exp1,
      variation: 1,
      variationKey: '1',
      data: {},
      userId: '1',
      userAttributes: {},
    });
    expect(mock.calls[1][0]).toEqual({
      experiment: exp2,
      variation: 0,
      variationKey: '0',
      data: {},
      userId: '1',
      userAttributes: {},
    });
    expect(mock.calls[2][0]).toEqual({
      experiment: exp2,
      variation: 1,
      variationKey: '1',
      data: {},
      userId: '2',
      userAttributes: {},
    });
  });

  it('tracks variation keys', () => {
    const exp = {
      key: 'my-test',
      variations: 2,
      variationInfo: [
        {
          key: 'first',
        },
        {
          key: 'second',
        },
      ],
    };
    const mock = mockCallback();

    const user = client.user({ id: '1' });
    user.experiment(exp);

    expect(mock.calls.length).toEqual(1);
    expect(mock.calls[0][0]).toEqual({
      experiment: exp,
      variation: 1,
      variationKey: 'second',
      data: {},
      userId: '1',
      userAttributes: {},
    });
  });

  it('handles weird experiment values', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: 1,
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: 30,
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: 2,
        coverage: -0.2,
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: 2,
        coverage: 1.5,
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: 2,
        variationInfo: [{ weight: 0.4 }, { weight: 0.1 }],
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: 2,
        variationInfo: [{ weight: 0.7 }, { weight: 0.6 }],
      })
    ).toEqual([0.5, 0.5]);

    spy.mockRestore();
  });

  it('uses window.location.href by default', () => {
    window.location.href = 'http://example.com/path';
    const newClient = new GrowthBookClient();
    expect(newClient.config.url).toEqual(window.location.href);

    window.location.href = 'http://example.com/anotherPath';
    window.dispatchEvent(new PopStateEvent('popstate', {}));
    expect(newClient.config.url).toEqual(window.location.href);

    newClient.destroy();
  });

  it('override variation', () => {
    expect(chooseVariation('6', { key: 'forced-test', variations: 2 })).toEqual(
      0
    );

    const mock = mockCallback();
    client.experiments.push({
      key: 'forced-test',
      variations: 2,
      force: 1,
    });
    expect(chooseVariation('6', 'forced-test')).toEqual(1);
    expect(mock.calls.length).toEqual(0);
  });

  it('handles weird targeting rules', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    expect(checkRule('9', '<', '20')).toEqual(true);
    expect(checkRule('5', '<', '4')).toEqual(false);
    expect(checkRule('a', '?', 'b')).toEqual(true);
    spy.mockRestore();
  });

  it('targeting', () => {
    client.experiments.push({
      key: 'my-test',
      variations: 2,
      targeting: [
        'member = true',
        'age > 18',
        'source ~ (google|yahoo)',
        'name != matt',
        'email !~ ^.*@exclude.com$',
      ],
    });

    // Matches all
    const user = client.user({
      id: '1',
      attributes: {
        member: true,
        age: 21,
        source: 'yahoo',
        name: 'george',
        email: 'test@example.com',
      },
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
    client.config.enabled = false;

    expect(
      chooseVariation('1', { key: 'disabled-test', variations: 2 })
    ).toEqual(-1);
    expect(mock.calls.length).toEqual(0);
  });

  it('querystring force', () => {
    client.experiments.push({
      key: 'forced-test-qs',
      variations: 2,
    });
    client.config.url = 'http://example.com?forced-test-qs=1#someanchor';

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(0);

    client.config.enableQueryStringOverride = true;
    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);
  });

  it('querystring force disabled tracking', () => {
    const mock = mockCallback();
    client.experiments.push({
      key: 'forced-test-qs',
      variations: 2,
    });
    client.config.url = 'http://example.com?forced-test-qs=1';
    client.config.enableQueryStringOverride = true;
    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);

    expect(mock.calls.length).toEqual(0);
  });

  it('querystring force invalid url', () => {
    client.config.url = '';
    expect(getQueryStringOverride('my-test', client)).toEqual(null);

    client.config.url = 'http://example.com';
    expect(getQueryStringOverride('my-test', client)).toEqual(null);

    client.config.url = 'http://example.com?';
    expect(getQueryStringOverride('my-test', client)).toEqual(null);

    client.config.url = 'http://example.com?somequery';
    expect(getQueryStringOverride('my-test', client)).toEqual(null);

    client.config.url = 'http://example.com??&&&?#';
    expect(getQueryStringOverride('my-test', client)).toEqual(null);
  });

  it('url targeting', () => {
    const exp = {
      key: 'my-test',
      variations: 2,
      url: '^/post/[0-9]+',
    };

    client.config.url = 'http://example.com';
    expect(chooseVariation('1', exp)).toEqual(-1);

    client.config.url = 'http://example.com/post/123';
    expect(chooseVariation('1', exp)).toEqual(1);

    exp.url = 'http://example.com/post/[0-9]+';
    expect(chooseVariation('1', exp)).toEqual(1);
  });

  it('invalid url regex', () => {
    const exp = {
      key: 'my-test',
      variations: 2,
      url: '???***[)',
    };
    client.config.url = 'http://example.com';
    expect(chooseVariation('1', exp)).toEqual(-1);
  });

  it('ignores draft experiments', () => {
    const exp: Experiment = {
      key: 'my-test',
      status: 'draft',
      variations: 2,
    };

    expect(chooseVariation('1', exp)).toEqual(-1);

    client.config.url = 'http://example.com/?my-test=1';
    client.config.enableQueryStringOverride = true;

    expect(chooseVariation('1', exp)).toEqual(1);
  });

  it('applies dom changes', () => {
    client.experiments.push({
      key: 'my-test',
      variations: 2,
      variationInfo: [
        {},
        {
          dom: [
            {
              selector: 'h1',
              mutation: 'addClass',
              value: 'new',
            },
            {
              selector: 'h1',
              mutation: 'removeClass',
              value: 'first',
            },
            {
              selector: 'h1',
              mutation: 'setHTML',
              value: 'hello',
            },
            {
              selector: 'h1',
              mutation: 'appendHTML',
              value: ' world',
            },
            {
              selector: 'h1',
              mutation: 'setAttribute',
              value: 'title="hello"',
            },
          ],
        },
      ],
    });
    const initial = '<h1 class="second first">my title</h1>';
    document.body.innerHTML = initial;
    const user = client.user({ id: '1' });
    const { variation, activate, deactivate } = user.experiment('my-test');

    const el = document.querySelector('h1');

    expect(variation).toEqual(1);
    expect(el?.innerHTML).toEqual('my title');
    activate();
    expect(el?.innerHTML).toEqual('hello world');
    expect(el?.getAttribute('class')).toEqual('second new');
    expect(el?.getAttribute('title')).toEqual('hello');
    deactivate();
    expect(document.body.innerHTML).toEqual(initial);
  });

  it('user destroy removes from client', () => {
    const user = client.user({ id: '123' });
    expect(client.users.length).toEqual(1);
    expect(client.users[0]).toEqual(user);

    user.destroy();
    expect(client.users.length).toEqual(0);
  });

  it('applies css changes', () => {
    client.experiments.push({
      key: 'my-test',
      variations: 2,
      variationInfo: [
        {},
        {
          css: 'body{color:red}',
        },
      ],
    });
    document.head.innerHTML = '';
    const user = client.user({ id: '1' });
    const { variation, activate, deactivate } = user.experiment('my-test');

    expect(variation).toEqual(1);
    expect(document.head.innerHTML).toEqual('');
    activate();
    expect(document.head.innerHTML).toEqual('<style>body{color:red}</style>');
    deactivate();
    expect(document.head.innerHTML).toEqual('');
  });

  it('auto runs tests', () => {
    client.experiments.push({
      key: 'my-test',
      variations: 2,
      auto: true,
      url: '.*',
      variationInfo: [
        {},
        {
          dom: [
            {
              selector: 'h1',
              mutation: 'setHTML',
              value: 'hello world',
            },
          ],
        },
      ],
    });
    client.config.url = 'http://www.example.com';
    document.body.innerHTML = '<h1>my title</h1>';
    const user = client.user({ id: '1' });
    expect(document.querySelector('h1')?.innerHTML).toEqual('hello world');
    user.destroy();
    expect(document.querySelector('h1')?.innerHTML).toEqual('my title');
  });

  it('does not reapply the same change', () => {
    const exp: Experiment = {
      key: 'my-test',
      variations: 2,
      variationInfo: [
        {},
        {
          css: 'body{color:red}',
          dom: [
            {
              selector: 'h1',
              mutation: 'appendHTML',
              value: ' world',
            },
          ],
        },
      ],
    };
    document.head.innerHTML = '';
    document.body.innerHTML = '<h1>hello</h1>';
    const user = client.user({ id: '1' });
    const { activate, deactivate } = user.experiment(exp);

    activate();
    activate();
    activate();

    expect(document.querySelector('h1')?.innerHTML).toEqual('hello world');
    expect(document.head.innerHTML).toEqual('<style>body{color:red}</style>');

    deactivate();
    expect(document.head.innerHTML).toEqual('');
    expect(document.body.innerHTML).toEqual('<h1>hello</h1>');
  });

  it('runs custom activate/deactivate function', () => {
    let value = 0;
    const exp: Experiment = {
      key: 'my-test',
      variations: 2,
      variationInfo: [
        {},
        {
          activate: () => {
            value = 1;
          },
          deactivate: () => {
            value = 0;
          },
        },
      ],
    };
    const user = client.user({ id: '1' });
    const { activate, deactivate } = user.experiment(exp);
    expect(value).toEqual(0);
    activate();
    expect(value).toEqual(1);
    deactivate();
    expect(value).toEqual(0);
  });

  it('refreshes active experiments on url change', () => {
    let value = 0;
    const exp: Experiment = {
      key: 'my-test',
      variations: 2,
      auto: true,
      url: 'about',
      variationInfo: [
        {},
        {
          activate: () => {
            value = 1;
          },
          deactivate: () => {
            value = 0;
          },
        },
      ],
    };

    window.location.href = 'http://example.com/home';
    const newClient = new GrowthBookClient();
    newClient.experiments.push(exp);

    newClient.user({ id: '1' });
    expect(value).toEqual(0);

    window.location.href = 'http://example.com/about';
    window.dispatchEvent(new PopStateEvent('popstate', {}));
    expect(value).toEqual(1);

    window.location.href = 'http://example.com/pricing';
    window.dispatchEvent(new PopStateEvent('popstate', {}));
    expect(value).toEqual(0);

    newClient.destroy();
  });

  it('configData experiment', () => {
    const user = client.user({ id: '1' });

    const exp: Experiment = {
      key: 'my-test',
      variations: 2,
      variationInfo: [
        {
          data: {
            color: 'blue',
            size: 'small',
          },
        },
        {
          data: {
            color: 'green',
            size: 'large',
          },
        },
      ],
    };

    const res1 = user.experiment(exp);
    expect(res1.variation).toEqual(1);
    expect(res1.data).toEqual({
      color: 'green',
      size: 'large',
    });

    // Fallback to control config data if not in test
    exp.coverage = 0.01;
    const res2 = user.experiment(exp);
    expect(res2.variation).toEqual(-1);
    expect(res2.data).toEqual({
      color: 'blue',
      size: 'small',
    });
  });

  it('configData lookup', () => {
    const expChrome = {
      key: 'button-color-size-chrome',
      variations: 2,
      targeting: ['browser = chrome'],
      variationInfo: [
        {
          data: {
            'button.color': 'blue',
            'button.size': 'small',
          },
        },
        {
          data: {
            'button.color': 'green',
            'button.size': 'large',
          },
        },
      ],
    };
    const expSafari = {
      key: 'button-color-safari',
      variations: 2,
      targeting: ['browser = safari'],
      variationInfo: [
        {
          data: {
            'button.color': 'blue',
          },
        },
        {
          data: {
            'button.color': 'green',
          },
        },
      ],
    };

    client.experiments.push(expChrome);
    client.experiments.push(expSafari);

    const user = client.user({ id: '1' });

    // No matches
    expect(user.lookupByDataKey('button.unknown')).toEqual({});

    // First matching experiment
    user.setAttributes({
      browser: 'chrome',
    });
    expect(user.lookupByDataKey('button.color')).toEqual({
      experiment: expChrome,
      variation: 0,
      value: 'blue',
    });
    expect(user.lookupByDataKey('button.size')).toEqual({
      experiment: expChrome,
      variation: 0,
      value: 'small',
    });

    // Fallback experiment
    user.setAttributes({
      browser: 'safari',
    });
    expect(user.lookupByDataKey('button.color')).toEqual({
      experiment: expSafari,
      variation: 0,
      value: 'blue',
    });

    // Fallback undefined
    expect(user.lookupByDataKey('button.size')).toEqual({});
  });
});
