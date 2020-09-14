# Growth Book Javascript Library

![Build Status](https://github.com/growthbook/growthbook-js/workflows/Build/badge.svg)

Small utility library to run controlled experiments (i.e. AB tests). Comaptible with the Growth Book experimentation platform.

## Installation

`yarn add @growthbook/growthbook` 

or 

`npm install --save @growthbook/growthbook`

## Quick Usage

```js
import GrowthBookClient from '@growthbook/growthbook';

const client = new GrowthBookClient();

// User id of the visitor being experimented on
const user = client.user("12345");

// Simple 50/50 split test by default
const {variation} = user.experiment("my-experiment-key");

if(variation === 0) {
    console.log('Control');
}
else if(variation === 1) {
    console.log('Variation');
}
else if(variation === -1) {
    console.log("Not in experiment");
}
```

## Client Configuration

When creating the GrowthBookClient instance, you can pass in configuration options.

```js
import GrowthBookClient from '@growthbook/growthbook';

const client = new GrowthBookClient({
    // Default false. Set to true to enable forcing variations via url. Very useful for QA.
    // For example: https://example.com/?my-experiment=1
    enableQueryStringOverride: false,

    // Default true. Set to false to disable all experiments.
    // The variation returned will always be -1. This takes precedence over every other option.
    enabled: true,

    // Default false. When true, calls `analytics.track` when an experiment is viewed
    // Example call: analytics.track("Experiment Viewed", {experiment_id, variation_id, ...configData})
    segment: true,

    // Default 0. When a positive integer, sets the specified custom dimension and fires an event using window.ga
    // 1st call: ga("set", "dimension"+n, `$(experiment_id}:${variation_number}`);
    // 2nd call: ga("send", "event", "experiment", experiment_id, variation_number);
    ga: 1,

    // Optional callback when the user views an experiment
    onExperimentViewed: (experiment, variation, configData) => {
        console.log(experiment, variation, configData);
    }
});
```

You can set new options at any point by calling the `client.configure` method:

```js
client.configure({
    enabled: false
});
```

## User Configuration

The `client.user` method takes an optional 2nd argument with user attributes.  These attributes are never sent across the network and are only used to locally evaluate experiment targeting rules.

```js
const user = client.user("12345", {
    // Any attributes about the user or page that you want to use for experiment targeting
    premium: true,
    accountAge: 36,
    source: "google"
});
```

You can update these at any time by calling `user.setAttributes`. By default, this completely overwrites all previous attributes. To do a 
shallow merge instead, pass `true` as the 2nd argument.

```js
user.setAttributes({
    premium: false
})
```

## Experiment Configuration

The default test is a 50/50 split with no targeting or customization.  There are a few ways to configure this on a test-by-test basis.

### Option 1: Auto-Pull from Growth Book API (Browser only)

This uses `window.fetch` to pull your latest experiment configs from the growthbook API.

```js
await client.pullExperimentConfigs("growthbook-api-key");
```

### Option 2: Manually Fetch Configs (NodeJS)

NodeJS environments are much more varied than browsers, so Growth Book does not ship a built-in solution.  However, 
it's very simple to create your own custom solution.  For example:

```js
const fetch = require('node-fetch');

const API_KEY = "growthbook-api-key";
fetch(`https://api.growthbook.io/config/${API_KEY}`)
    .then(res => res.json)
    .then(json => {
        client.setExperimentConfigs(json.experiments);
    })
```

Our API is behind a global CDN, so it's very fast and reliable.  However, we do still recommend adding a persistent caching layer (redis, DynamoDB, etc.) if possible.

### Option 3: Inline Experiment Configuration

In some cases, you may prefer to set experiment parameters inline when doing variation assignment:

```js
const {variation} = user.experiment("my-experiment-id", {
    // Same experiment options as client.configure.experiments
    variations: 3,
    coverage: 0.5,
    weights: [0.34, 0.33, 0.33],
    targeting: ["source != google"]
});
```

## Variation Data

Instead of using a variation number to fork your code with if/else statements, you can use variation data.

```js
const {data} = user.experiment("my-id", {
    data: {
        color: ["blue","green"]
    }
});

// Will be either "blue" or "green"
console.log(data.color);
```

### Integrating with Configuration / Feature Flag Systems

If you already have an existing configuration or feature flag system, you can do a deeper integration that 
avoids `experiment` calls throughout your code base entirely.

All you need to do is modify your existing config system to get experiment overrides before falling back to your normal config lookup:

```js
// Your existing function
export function getConfig(key) {
    // value will either be undefined or come from a chosen variation
    const {value} = user.lookupByDataKey(key);
    if(value) {
        return value;
    }

    // Continue with your regular configuration lookup
    ...
}
```

This works under the hood as follows:

1.  Loop through all experiments using stable ordering
2.  If an experiment includes the data key, choose a variation for the user
3.  If the chosen variation is `>=0` (passed targeting and coverage rules), break out of the loop and return the data value for the key
4.  If we reach the end of the loop with no matches, return `undefined`