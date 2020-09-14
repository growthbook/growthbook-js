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

// Simple 50/50 split test
const {variation} = user.experiment("experiment-id", {variations: 2});

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

The GrowthBookClient constructor takes an optional `options` argument.

Below are all of the available options:

-  **enabled** - Default true. Set to false to completely disable all experiments.
-  **onExperimentViewed** - Callback when the user views an experiment. Passed an object with `experiment` and `variation` properties.

Some additional options are only available when running in a browser:

-  **enableQueryStringOverride** - Default false.  If true, enables forcing variations via the URL.  Very useful for QA.  https://example.com/?my-experiment=1
-  **segment** - Default false. If true, calls `analytics.track("Experiment Viewed")` automatically.
-  **ga** - Track experiments in Google Analytics. Set to the custom dimension (1 to 20) you want to use for tracking.

You can set new options at any point by calling the `client.configure` method. These are shallowly merged with existing options.

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
    // Number of variations (including the control)
    variations: 3,
    // Percent of traffic to include in the test (from 0 to 1)
    coverage: 0.5,
    // How to split traffic between variations (must add to 1)
    weights: [0.34, 0.33, 0.33],
    // Targeting rules
    // Evaluated against user attributes to determine who is included in the test
    targeting: ["source != google"],
    // Add arbitrary data to the variations (see below for more info)
    data: {
        color: ["blue","green","red"]
    }
});
```

## Running Experiments

Growth Book supports 3 different implementation approaches:

1.  Branching
2.  Parameterization
3.  Config System

### Approach 1: Branching

This is the simplest to understand and implement. You add branching via if/else or switch statements:

```js
const {variation} = user.experiment("experiment-id");

if(variation === 1) {
    // Variation
    button.color = "green";
}
else {
    // Control
    button.color = "blue";
}
```

## Approach 2: Parameterization

With this approach, you parameterize the variations by associating them with data.

With the following experiment definition:
```json
{
    "variations": 2,
    "data": {
        "color": ["blue", "green"]
    }
}
```

You can now implement the test like this instead:
```js
const {data} = user.experiment("experiment-id");

// Will be either "blue" or "green"
button.color = data.color;
```

### Approach 3: Configuration System

If you already have an existing configuration or feature flag system, you can do a deeper integration that 
avoids `experiment` calls throughout your code base entirely.

All you need to do is modify your existing config system to get experiment overrides before falling back to your normal lookup process:

```js
// Your existing function
export function getConfig(key) {
    // Look for a valid matching experiment. 
    // If found, choose a variation and return the value for the requested key
    const {value} = user.lookupByDataKey(key);
    if(value) {
        return value;
    }

    // Continue with your normal lookup process
    ...
}
```

Instead of generic keys like `color`, you probably want to be more descriptive with this approach (e.g. `homepage.cta.color`).

With the following experiment definitions:
```json
{
    "variations": 2,
    "data": {
        "homepage.cta.color": ["blue", "green"]
    }
}
```

You can now do:

```js
button.color = getConfig("homepage.cta.color");
```

Your code now no longer cares where the value comes from. It could be a hard-coded config value or part of an experiment.  This is the cleanest approach of the 3, but it can be difficult to debug if things go wrong.