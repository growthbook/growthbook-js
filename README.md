<p align="center"><img src="https://www.growthbook.io/logos/growthbook-logo@2x.png" width="400px" /></p>

# Growth Book - Javascript

Powerful A/B testing for JavaScript.

![Build Status](https://github.com/growthbook/growthbook-js/workflows/Build/badge.svg)

-  **No external dependencies**
-  **Lightweight and fast** (1.9Kb gzipped)
-  **No HTTP requests** everything is defined and evaluated locally
-  Supports both **browsers and nodejs**
-  **No flickering or blocking calls**
-  Written in **Typescript** with 100% test coverage
-  Flexible experiment **targeting**
-  **Use your existing event tracking** (GA, Segment, Mixpanel, custom)
-  **Adjust variation weights and targeting** without deploying new code

**Note**: This library is just for running A/B tests. To analyze results, use the Growth Book App (https://github.com/growthbook/growthbook).

## Installation

`yarn add @growthbook/growthbook` 

or 

`npm install --save @growthbook/growthbook`

or use directly in your HTML without installing first:

```html
<script type="module">
import GrowthBookClient from 'https://unpkg.com/@growthbook/growthbook/dist/growthbook.esm.js';
//...
</script>
```

## Quick Usage

```ts
import GrowthBookClient from '@growthbook/growthbook';

// Create a client and setup tracking
const client = new GrowthBookClient({
  onExperimentViewed: ({experimentId, variationId}) => {
    // Use whatever event tracking system you have in place
    analytics.track("Experiment Viewed", {experimentId, variationId});
  }
});

// Define the user that you want to run an experiment on
const user = client.user({id: "12345"});

// Put the user in an experiment
const {value} = user.experiment({
    key: "my-experiment",
    variations: ["A", "B"]
});

console.log(value); // "A" or "B"
```

## Client Configuration

The GrowthBookClient constructor takes an optional `options` argument.

Below are all of the available options:

-  **enabled** - Default true. Set to false to completely disable all experiments.
-  **debug** - Default false. If set to true, console.log info about why experiments are run and why specific variations are chosen.
-  **onExperimentViewed** - Callback when the user views an experiment.
-  **url** - The URL for the current request (defaults to `window.location.href` when in a browser)
-  **enableQueryStringOverride** - Default true.  If true, enables forcing variations via the URL.  Very useful for QA.  https://example.com/?my-experiment=1

### SPA support

With a Single Page App (SPA), you need to update the client on navigation in order to target tests based on URL:

```ts
client.config.url = newUrl;
```

Doing this with Next.js for example, will look like this:
```tsx
export default function MyApp({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    const onChange = (newUrl) => client.config.url = newUrl;
    router.events.on('routeChangeComplete', onChange);
    return () => router.events.off('routeChangeComplete', onChange);
  }, [])

  return <Component {...pageProps} />
}
```

## Experiments

As shown above, the simplest experiment you can define has 2 fields: `key` and `variations`.

There are a lot more configuration options you can specify.  Here is the full list of options:

-  **key** (`string`) - The globally unique tracking key for the experiment
-  **variations** (`any[]`) - The different variations to choose between
-  **weights** (`number[]`) - How to weight traffic between variations. Must add to 1.
-  **status** (`string`) - "running" is the default and always active. "draft" is only active during QA and development.  "stopped" is only active when forcing a winning variation to 100% of users.
-  **coverage** (`number`) - What percent of users should be included in the experiment (between 0 and 1, inclusive)
-  **url** (`string`) - Users can only be included in this experiment if the current URL matches this regex
-  **include** (`() => boolean`) - A callback that returns true if the user should be part of the experiment and false if they should not be
-  **groups** (`string[]`) - Limits the experiment to specific user groups
-  **force** (`number`) - All users included in the experiment will be forced into the specific variation index
-  **userHashKey** - What user attribute you want to use to assign variations (defaults to `id`)

### Running Experiments

Run experiments by calling `user.experiment()` which returns an object with a few useful properties:

```ts
const {inExperiment, variationId, value} = user.experiment({
    key: "my-experiment",
    variations: ["A", "B"]
});

// If user is part of the experiment
console.log(inExperiment); // true or false

// The index of the assigned variation
console.log(variationId); // 0 or 1

// The value of the assigned variation
console.log(value); // "A" or "B"
```

The `inExperiment` flag can be false if the experiment defines any sort of targeting rules which the user does not pass.  In this case, the user is always assigned variation index `0`.

### Example Experiments

3-way experiment with uneven variation weights:
```ts
user.experiment({
  key: "3-way-uneven",
  variations: ["A","B","C"],
  weights: [0.5, 0.25, 0.25]
})
```

Slow rollout (10% of users who opted into "beta" features):
```ts
// User is in the "qa" and "beta" groups
const user = client.user({id: "123"}, {
  qa: isQATester(),
  beta: betaFeaturesEnabled()
});
user.experiment({
  key: "slow-rollout",
  variations: ["A", "B"],
  coverage: 0.1,
  groups: ["beta"]
})
```

Complex variations and custom targeting
```ts
const {value} = user.experiment({
  key: "complex-variations",
  variations: [
    {color: "blue", size: "large"},
    {color: "green", size: "small"}
  ],
  include: () => isPremium || creditsRemaining > 50
});
console.log(value.color, value.size); // blue,large OR green,small
```

Assign variations based on something other than user id
```ts
const user = client.user({
  id: "123",
  companyId: "abc"
});
user.experiment({
  key: "by-company-id",
  variations: ["A", "B"],
  userHashKey: "companyId"
})
// Users in the same company will now always get the same variation
```

### Overriding Experiment Configuration

It's common practice to adjust experiment settings after a test is live.  For example, slowly ramping up traffic, stopping a test automatically if guardrail metrics go down, or rolling out a winning variation to 100% of users.

For example, to roll out a winning variation to 100% of users:
```ts
client.overrides.set("experiment-key", {
    status: 'stopped',
    force: 1
});

// Later in code
const {value} = user.experiment({
  key: "experiment-key",
  variations: ["A", "B"]
});

console.log(value); // Always "B"
```

The full list of experiment properties you can override is:
*  status
*  force
*  weights
*  coverage
*  groups
*  url

This data structure can be easily seralized and stored in a database or returned from an API.  There is a small helper function if you have all of your overrides in a single JSON object:

```ts
const JSONFromDatabase = {
  "experiment-key-1": {
    "weights": [0.1, 0.9]
  },
  "experiment-key-2": {
    "groups": ["everyone"],
    "coverage": 1
  }
};

client.importOverrides(JSONFromDatabase)
```

If you use the Growth Book App (https://github.com/growthbook/growthbook) to manage experiments, there's a built-in API endpoint you can hit that returns overrides in this exact format.  It's a great way to make sure your experiments are always up-to-date.

## Event Tracking and Analyzing Results

This library only handles assigning variations to users.  The 2 other parts required for an A/B testing platform are Tracking and Analysis.

### Tracking

It's likely you already have some event tracking on your site with the metrics you want to optimize (Google Analytics, Segment, Mixpanel, etc.).

For A/B tests, you just need to track one additional event - when someone views a variation.  

```ts
// Specify a tracking callback when instantiating the client
const client = new GrowthBookClient({
    onExperimentViewed: ({experimentId, variationId}) => {
      // ...
    }
});
```

The object passed to your callback has the following properties:
-  experimentId (the key of the experiment)
-  variationId (the array index of the assigned variation)
-  value (the value of the assigned variation)
-  experiment (the full experiment object)
-  user (the full user object)
-  userHashKey (which user attribute was used to assign a variation)

Below are examples for a few popular event tracking tools:

#### Google Analytics
```ts
ga('send', 'event', 'experiment', experimentId, variationId, {
  // Custom dimension for easier analysis
  'dimension1': `${experimentId}::${variationId}`
});
```

#### Segment
```ts
analytics.track("Experiment Viewed", {
  experimentId,
  variationId
});
```

#### Mixpanel
```ts
mixpanel.track("$experiment_started", {
  'Experiment name': experimentId,
  'Variant name': variationId
});
```

### Analysis

For analysis, there are a few options:

*  Online A/B testing calculators
*  Built-in A/B test analysis in Mixpanel/Amplitude
*  Python or R libraries and a Jupyter Notebook
*  The Growth Book App (https://github.com/growthbook/growthbook)

### The Growth Book App

Managing experiments and analyzing results at scale can be complicated, which is why we built the [Growth Book App](https://github.com/growthbook/growthbook).

- Query multiple data sources (Snowflake, Redshift, BigQuery, Mixpanel, Postgres, Athena, and Google Analytics)
- Bayesian statistics engine with support for binomial, count, duration, and revenue metrics
- Drill down into A/B test results (e.g. by browser, country, etc.)
- Lightweight idea board and prioritization framework
- Document everything! (upload screenshots, add markdown comments, and more)
- Automated email alerts when tests become significant

Integration is super easy:

1.  Create a Growth Book API key
2.  Periodically fetch the latest experiment overrides from the API and cache in Redis, Mongo, etc.
3.  At the start of your app, run `client.importOverrides(listFromCache)`

Now you can start/stop tests, adjust coverage and variation weights, and apply a winning variation to 100% of traffic, all within the Growth Book App without deploying code changes to your site.