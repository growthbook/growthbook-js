import {
  clearAppliedDomChanges,
  getWeightsFromOptions,
  checkRule,
  getQueryStringOverride,
} from '../src/util';
import GrowthBookClient from '../src';
import { Experiment, UserAttributes } from '../src/types';

const client = new GrowthBookClient();

function debug(func: () => any, c: GrowthBookClient = client) {
  c.config.debug = true;
  const ret = func();
  c.config.debug = false;
  return ret;
}
// This is just to avoid typescript warnings about unused function
debug(() => 1);

const chooseVariation = <T = number>(
  userId: string | null,
  experiment: string | Experiment<T>,
  attributes?: UserAttributes,
  anonId?: string
) => {
  const user = client.user({
    id: userId || '',
    anonId: anonId || '',
    attributes: attributes || {},
  });

  if (typeof experiment === 'string') {
    const res = user.experiment({
      key: experiment,
      variations: [0, 1],
    });
    return res.inExperiment ? res.variationId : -1;
  }

  const res = user.experiment(experiment);
  return res.inExperiment ? res.variationId : -1;
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
    client.enable();
    client.config.onExperimentViewed = undefined;
    client.config.url = '';
    client.config.qa = false;
    client.overrides.clear();
    client.users.forEach(user => {
      user.destroy();
    });
    client.users = [];
    client.forcedVariations.clear();
    clearAppliedDomChanges();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });
  afterAll(() => {
    client.destroy();
  });

  it('client has default options', () => {
    const newClient = new GrowthBookClient();
    expect(newClient.isEnabled()).toEqual(true);
    expect(!!newClient.config.enableQueryStringOverride).toEqual(true);
    expect(!!newClient.config.onExperimentViewed).toEqual(false);
    newClient.destroy();
  });

  it('defaultWeights', () => {
    const exp = {
      key: 'my-test',
      variations: [0, 1],
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
      variations: [0, 1],
      weights: [0.1, 0.9],
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
      variations: [0, 1],
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
      variations: [0, 1, 2],
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
    expect(
      chooseVariation('1', { key: 'my-test', variations: [0, 1] })
    ).toEqual(1);
    expect(
      chooseVariation('1', { key: 'my-test-3', variations: [0, 1] })
    ).toEqual(0);
  });
  it('missing userId', () => {
    expect(chooseVariation('', { key: 'my-test', variations: [0, 1] })).toEqual(
      -1
    );
  });
  it('anonId', () => {
    const anonExp = { key: 'my-test', variations: [0, 1], anon: true };
    const userExp = { key: 'my-test', variations: [0, 1], anon: false };

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

    const exp1 = { key: 'my-tracked-test', variations: [0, 1] };
    const exp2 = { key: 'my-other-tracked-test', variations: [0, 1] };

    user1.experiment(exp1);
    user1.experiment(exp1);
    user1.experiment(exp1);
    user1.experiment(exp2);
    user2.experiment(exp2);

    expect(mock.calls.length).toEqual(3);
    expect(mock.calls[0][0]).toEqual({
      experimentId: exp1.key,
      experiment: exp1,
      value: 1,
      index: 1,
      variationId: 1,
      userId: '1',
      userAttributes: {},
    });
    expect(mock.calls[1][0]).toEqual({
      experimentId: exp2.key,
      experiment: exp2,
      value: 0,
      index: 0,
      variationId: 0,
      userId: '1',
      userAttributes: {},
    });
    expect(mock.calls[2][0]).toEqual({
      experimentId: exp2.key,
      experiment: exp2,
      value: 1,
      index: 1,
      variationId: 1,
      userId: '2',
      userAttributes: {},
    });
  });

  it('tracks variation keys', () => {
    const exp = {
      key: 'my-test',
      variations: ['first', 'second'],
    };
    const mock = mockCallback();

    const user = client.user({ id: '1' });
    user.experiment(exp);

    expect(mock.calls.length).toEqual(1);
    expect(mock.calls[0][0]).toEqual({
      experimentId: exp.key,
      experiment: exp,
      value: 'second',
      index: 1,
      variationId: 1,
      userId: '1',
      userAttributes: {},
    });
  });

  it('client.subscribe fires when new users are created', () => {
    let count = 0;
    const client = new GrowthBookClient();
    client.user({ id: '1' });
    client.subscribe(() => {
      count++;
    });

    client.user({ id: '2' });
    client.user({ id: '3' });
    client.user({ id: '4' });

    expect(count).toEqual(3);

    client.destroy();
  });

  it('imports experiment overrides', () => {
    const client = new GrowthBookClient();
    client.importOverrides({
      'my-test': {
        coverage: 0.5,
        status: 'draft',
      },
      'my-test2': {
        coverage: 1,
        status: 'running',
      },
    });
    expect(client.overrides.size).toEqual(2);
    expect(client.overrides.get('my-test')).toEqual({
      coverage: 0.5,
      status: 'draft',
    });
    client.destroy();
  });

  it('handles weird experiment values', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();

    expect(
      chooseVariation('1', {
        key: 'my-test',
        variations: [0],
      })
    ).toEqual(-1);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: [0, 1],
        coverage: -0.2,
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: [0, 1],
        coverage: 1.5,
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: [0, 1],
        weights: [0.4, 0.1],
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: [0, 1],
        weights: [0.7, 0.6],
      })
    ).toEqual([0.5, 0.5]);

    expect(
      getWeightsFromOptions({
        key: 'my-test',
        variations: [0, 1, 2, 3],
        weights: [0.4, 0.4, 0.2],
      })
    ).toEqual([0.25, 0.25, 0.25, 0.25]);

    spy.mockRestore();
  });

  it('logs debug message', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();

    const client = new GrowthBookClient();
    const user = client.user({ id: '1' });
    user.experiment({
      key: 'my-test',
      variations: [0, 1],
    });

    // Does not log normally
    expect(spy.mock.calls.length).toEqual(0);

    // Logs when in debug mode
    client.config.debug = true;
    user.experiment({
      key: 'my-test2',
      variations: [0, 1],
    });
    // Should be
    // 1. Trying to put user in experiment
    // 2. User put in experiment
    expect(spy.mock.calls.length).toEqual(2);
    spy.mockRestore();

    client.destroy();
  });

  it('uses window.location.href by default', () => {
    window.location.href = 'http://example.com/path';
    const newClient = new GrowthBookClient();
    expect(newClient.config.url).toEqual(window.location.href);

    newClient.destroy();
  });

  it('force variation', () => {
    expect(
      chooseVariation('6', { key: 'forced-test', variations: [0, 1] })
    ).toEqual(0);

    const mock = mockCallback();
    client.overrides.set('forced-test', {
      force: 1,
    });
    expect(chooseVariation('6', 'forced-test')).toEqual(1);
    expect(mock.calls.length).toEqual(0);
  });

  it('handles weird targeting rules', () => {
    expect(checkRule('9', '<', '20')).toEqual(true);
    expect(checkRule('5', '<', '4')).toEqual(false);

    const spy = jest.spyOn(console, 'error').mockImplementation();
    expect(checkRule('a', '?', 'b')).toEqual(true);
    expect(spy.mock.calls.length).toEqual(1);
    spy.mockRestore();
  });

  it('uses overrides', () => {
    client.overrides.set('my-test', {
      coverage: 0.01,
    });

    expect(
      chooseVariation('1', {
        key: 'my-test',
        variations: [0, 1],
      })
    ).toEqual(-1);
  });

  it('merges user attributes', () => {
    const user = client.user({
      id: '1',
      attributes: {
        foo: 1,
        bar: 2,
      },
    });
    expect(user.getAttributes()).toEqual({
      foo: 1,
      bar: 2,
    });

    user.setAttributes(
      {
        bar: 3,
        baz: 4,
      },
      true
    );
    expect(user.getAttributes()).toEqual({
      foo: 1,
      bar: 3,
      baz: 4,
    });
  });

  it('targeting', () => {
    const exp = {
      key: 'my-test',
      variations: [0, 1],
      targeting: [
        'member = true',
        'age > 18',
        'source ~ (google|yahoo)',
        'name != matt',
        'email !~ ^.*@exclude.com$',
      ],
    };

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
    expect(user.experiment(exp).value).toEqual(1);

    // Missing negative checks
    user.setAttributes(
      {
        member: true,
        age: 21,
        source: 'yahoo',
      },
      false
    );
    expect(user.experiment(exp).value).toEqual(1);

    // Missing all attributes
    user.setAttributes({}, false);
    expect(user.experiment(exp).inExperiment).toEqual(false);

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
    expect(user.experiment(exp).inExperiment).toEqual(false);

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
    expect(user.experiment(exp).inExperiment).toEqual(false);

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
    expect(user.experiment(exp).inExperiment).toEqual(false);

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
    expect(user.experiment(exp).inExperiment).toEqual(false);

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
    expect(user.experiment(exp).inExperiment).toEqual(false);
  });

  it('experiments disabled', () => {
    const mock = mockCallback();
    client.disable();

    // Experiment
    expect(
      chooseVariation('1', { key: 'disabled-test', variations: [9, 1] })
    ).toEqual(-1);

    expect(mock.calls.length).toEqual(0);
  });

  it('querystring force', () => {
    client.config.url = 'http://example.com?forced-test-qs=1#someanchor';

    expect(chooseVariation('1', 'forced-test-qs')).toEqual(0);

    client.config.enableQueryStringOverride = true;
    expect(chooseVariation('1', 'forced-test-qs')).toEqual(1);
  });

  it('querystring force disabled tracking', () => {
    const mock = mockCallback();
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
      variations: [0, 1],
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
      variations: [0, 1],
      url: '???***[)',
    };
    client.config.url = 'http://example.com';
    expect(chooseVariation('1', exp)).toEqual(-1);
  });

  it('ignores draft experiments', () => {
    const exp: Experiment<number> = {
      key: 'my-test',
      status: 'draft',
      variations: [0, 1],
    };

    expect(chooseVariation('1', exp)).toEqual(-1);

    client.config.url = 'http://example.com/?my-test=1';
    client.config.enableQueryStringOverride = true;

    expect(chooseVariation('1', exp)).toEqual(1);
  });

  it('ignores stopped experiments unless forced', () => {
    const expLose: Experiment<number> = {
      key: 'my-test',
      status: 'stopped',
      variations: [0, 1, 2],
    };
    const expWin: Experiment<number> = {
      key: 'my-test',
      status: 'stopped',
      variations: [0, 1, 2],
      force: 2,
    };
    expect(chooseVariation('1', expLose)).toEqual(-1);
    expect(chooseVariation('1', expWin)).toEqual(2);
  });

  it('user destroy removes from client', () => {
    const user = client.user({ id: '123' });
    expect(client.users.length).toEqual(1);
    expect(client.users[0]).toEqual(user);

    user.destroy();
    expect(client.users.length).toEqual(0);
  });

  it('configData experiment', () => {
    const user = client.user({ id: '1' });

    const exp: Experiment<{ color: string; size: string }> = {
      key: 'my-test',
      variations: [
        {
          color: 'blue',
          size: 'small',
        },
        {
          color: 'green',
          size: 'large',
        },
      ],
    };

    const res1 = user.experiment(exp);
    expect(res1.variationId).toEqual(1);
    expect(res1.value).toEqual({
      color: 'green',
      size: 'large',
    });

    // Fallback to control config data if not in test
    exp.coverage = 0.01;
    const res2 = user.experiment(exp);
    expect(res2.inExperiment).toEqual(false);
    expect(res2.variationId).toEqual(0);
    expect(res2.value).toEqual({
      color: 'blue',
      size: 'small',
    });
  });

  it('responds to window.growthbook calls', () => {
    window.growthbook.push('disable');
    expect(client.isEnabled()).toEqual(false);
    window.growthbook.push('enable');
    expect(client.isEnabled()).toEqual(true);
  });

  it('does even weighting', () => {
    // Full coverage
    const exp: Experiment<number> = { key: 'my-test', variations: [0, 1] };
    let variations: Record<string, number> = {
      '0': 0,
      '1': 0,
      '-1': 0,
    };
    for (let i = 0; i < 1000; i++) {
      variations[chooseVariation('' + i, exp) + '']++;
    }
    expect(variations['0']).toEqual(503);

    // Reduced coverage
    exp.coverage = 0.4;
    variations = {
      '0': 0,
      '1': 0,
      '-1': 0,
    };
    for (let i = 0; i < 1000; i++) {
      variations[chooseVariation('' + i, exp) + '']++;
    }
    expect(variations['0']).toEqual(200);
    expect(variations['1']).toEqual(204);
    expect(variations['-1']).toEqual(596);
  });

  it('forces variations from the client', () => {
    expect(chooseVariation('1', 'my-test')).toEqual(1);
    client.forcedVariations.set('my-test', 0);
    expect(chooseVariation('1', 'my-test')).toEqual(0);
  });

  it('forces all variations to -1 in qa mode', () => {
    client.config.qa = true;
    expect(chooseVariation('1', 'my-test')).toEqual(-1);

    // Still works if explicitly forced
    client.forcedVariations.set('my-test', 0);
    expect(chooseVariation('1', 'my-test')).toEqual(0);

    // Works if the experiment itself is forced
    expect(
      chooseVariation('1', {
        key: 'my-test-2',
        variations: [0, 1],
        force: 1,
      })
    ).toEqual(1);
  });

  it('fires user subscriptions correctly', () => {
    const user = client.user({ id: '1' });
    let fired = false;
    const unsubscriber = user.subscribe(() => {
      fired = true;
    });
    expect(fired).toEqual(false);

    const exp = { key: 'my-test', variations: [0, 1] };

    // Should fire when user is put in an experiment
    user.experiment(exp);
    expect(fired).toEqual(true);

    // Does not fire if nothing has changed
    fired = false;
    user.experiment(exp);
    expect(fired).toEqual(false);

    // Does not fire after unsubscribed
    unsubscriber();
    user.experiment({
      key: 'other-test',
      variations: [0, 1],
    });
    expect(fired).toEqual(false);

    user.destroy();
  });

  it('stores assigned variations in the user', () => {
    const user = client.user({ id: '1' });
    user.experiment({ key: 'my-test', variations: [0, 1] });
    user.experiment({ key: 'my-test-3', variations: [0, 1] });

    const assigned = user.getAssignedVariations();
    const assignedArr: { e: string; v: number }[] = [];
    assigned.forEach((v, e) => {
      assignedArr.push({ e, v: v.assigned });
    });

    expect(assignedArr.length).toEqual(2);
    expect(assignedArr[0].e).toEqual('my-test');
    expect(assignedArr[0].v).toEqual(1);
    expect(assignedArr[1].e).toEqual('my-test-3');
    expect(assignedArr[1].v).toEqual(0);
  });
});
