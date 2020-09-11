# Growth Book Javascript Library

Small utility library to run controlled experiments (i.e. AB tests). Comaptible with the Growth Book experimentation platform.

## Installation

`yarn add @growthbook/growthbook` 

or 

`npm install --save @growthbook/growthbook`

## Quick Usage

First, configure growthbook during your app bootstrap phase:
```js
import {configure} from '@growthbook/growthbook'

configure({
    // User id of the visitor (can omit if the visitor is logged out)
    uuid: "12345",
    // Track an event in Segment when the user views an experiment
    segment: true,
});
```

Then, put the user in an experiment
```js
import {experiment} from '@growthbook/growthbook'

// Simple 50/50 split test by default
const variation = experiment('my-unique-experiment-key');

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

The configure method accepts a number of options.  Everything is optional.

```js
import {configure} from '@growthbook/growthbook';

configure({
    // User id of the visitor (can omit if the visitor is logged out)
    uuid: "12345",

    // Any attributes about the user or page that you want to use for experiment targeting
    attributes: {
        premium: true,
        accountAge: 36,
        source: "google"
    },

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
            ]
        },
        "my-other-experiment": {
            // Force a specific version of the experiment to all users
            force: 0
        }
    },

    // Default false. Set to true to enable forcing variations via url
    // For example: https://example.com/?my-experiment=1
    enableQueryStringOverride: false,

    // Default true. Set to false to disable all experiments.
    // The variation returned will always be -1. This takes precedence over every other option.
    enabled: true,

    // Default false. When true, calls `analytics.track` when an experiment is viewed
    // Example call: analytics.track("Experiment Viewed", {experiment_id, variation_id})
    segment: true,

    // Default 0. When a positive integer, sets the specified custom dimension and fires an event using window.ga
    // The custom dimension value is in the format "experiment_id:variation_number"
    // The event is ga("send", "event", "experiment", experiment_id, variation_number)
    ga: 1,

    // Optional callback when the user views an experiment
    onExperimentViewed: (experiment, variation) => {
        console.log(experiment, variation);
    }
});
```

You can call `configure` as many times as you want.  All fields are optional and have sane defaults.

### Inline Experiment Configuration

For most use-cases, the above configuration method works perfectly for experiments.

However, in some cases, you may prefer to set experiment parameters inline when doing variation assignment:

```js
import {experiment} from '@growthbook/growthbook';

const variation = experiment("my-experiment-id", {
    // Same experiment options as configure are available
    variations: 3,
    coverage: 0.5,
    weights: [0.34, 0.33, 0.33],
    targeting: ["source != google"]
});
```