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

    // Callback when the user is put in a test (use to fire tracking events)
    onAssignment: (experiment, variation) => {
        // Example: Segment integration
        analytics.track("Experiment Viewed", {
            experimentId: experiment,
            variationId: variation
        });
    }
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

In addition to `uuid` and `onAssignment`, the configure method accepts a number of other options.

```js
import {configure} from '@growthbook/growthbook';

configure({
    // Any attributes about the user or page that you want to use for experiment targeting
    attributes: {
        premium: true,
        accountAge: 36,
        source: "google"
    },

    // Define experiment parameters
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
    // Example; https://example.com/?my-experiment=1
    enableQueryStringOverride: true,

    // Default true. Set to false to disable experiments entirely.
    // Every test will return -1 immediately and all other options will be ignored.
    enabled: true,
});
```