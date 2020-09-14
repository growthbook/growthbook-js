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

## Configuration

When creating the GrowthBookClient instance, you can pass in configuration options.

```js
import GrowthBookClient from '@growthbook/growthbook';

const client = new GrowthBookClient({
    // Customize experiment options beyond simple 50/50 split tests
    experiments: {
        "my-unique-experiment-key": {
            // Number of variations
            variations: 3,
            // Include 80% of visitors in the test
            coverage: 0.8,
            // 50% in control, 25% in each variation (total must add up to 1)
            weights: [0.5, 0.25, 0.25],
            // Targeting rules. Users must meet all conditions to be included
            targeting: [
                "accountAge < 40",
                "premium = true"
            ],
            // Config data for the variations. Used to tie into configuration or feature-flag systems
            data: {
                color: ["blue","green","red"]
            }
        },
        "my-other-experiment": {
            // Force a specific version of the experiment to all users and disable tracking
            force: 0
        }
    },

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

### User attributes

The `client.user` method takes an optional 2nd argument with user attributes.

```js
const user = client.user({
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

### Inline Experiment Configuration

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

## Experiments with Config Data

Instead of using a variation number to fork your code with if/else statements, you can use config data.

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

For this to work, you'll need to configure all possible experiments in the client:
```js
client.configure({
    experiments: {
        "my-id": {
            data: {
                "homepage.cta.color": ["blue","green"]
            }
        },
        ...
    }
})
```

Then, modify your existing config system to get experiment overrides before falling back to your normal config lookup:

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

Now, calling `getConfig("homepage.cta.color")` will use your experiment.

This works under the hood as follows:

1.  Loop through all experiments using stable ordering
2.  If an experiment includes the data key, choose a variation for the user
3.  If the chosen variation is `>=0` (passed targeting and coverage rules), break out of the loop and return the data value for the key
4.  If we reach the end of the loop with no matches, return `undefined`