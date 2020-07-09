# Growthbook Javascript Library

Small utility library to interact with the Growthbook API.

## Installation

`yarn add @growthbook/growthbook` 

or 

`npm install --save @growthbook/growthbook`

## Configuration

```js
import {configure} from '@growthbook/growthbook';

configure({
    trackingHost: "https://track.example.com",
    userId: "12345",
    defaultTrackingProps: {
        company: "Acme, inc."
        page: "careers",
        theme: "darkmode"
    }
});
```

You can call `configure` multiple times and only pass in the settings you want to modify.  This is really useful for 2 scenarios:

1.  If you have an async authentication flow and don't know the userId initially
2.  If your default tracking props include context that may change (e.g. switching a theme, client-side routing)

## Event Tracking

```js
import {track} from '@growthbook/growthbook';

// Event name and whatever event properties you want to track
track('clicked_button', {color: 'red'});
```

## AB Testing

There are 2 methods depending on how you want to bucket visitors:

-  experimentByUser
-  experimentByDevice

**experimentByUser** guarantees that the same userId will always see the same variation. If the user logs out or switches accounts, they may see a different variation.

**experimentByDevice** uses a unique *anonymousId* stored in localStorage to determine variation. As long as a visitor does not clear cookies and does not switch browsers or devices, they will continue seeing the same variation.

```js
import {experimentByUser} from '@growthbook/growthbook'

// Default: 2-way test, 50/50 traffic split
const variation = experimentByUser('my-experiment-id');

if(variation === 1) {
    console.log('Variation');
}
else if(variation === 0) {
    console.log('Baseline');
}
```

### AB Testing Options

Both experiment methods take a 2nd options parameter to control weights, coverage, and number of variations.

#### Number of Variations

```js
import {experimentByUser} from '@growthbook/growthbook'

// 3-way test
const variation = experimentByUser('my-3-way-test', {variations: 3});

if(variation === 2) {
    console.log('Variation 2');
}
else if(variation === 1) {
    console.log('Variation 1');
}
else {
    console.log('Baseline (Variation 0)');
}
```

#### Traffic Coverage

The default config includes 100% of visitors in the test.  If you lower this, some users will be put in variation `-1` and won't be part of the test.  Usually, you want to treat these users the same as the baseline.

```js
// Only 30% of users will be in the test
const variation = experimentByUser('low-coverage', {coverage: 0.3});

if(variation === 1) {
    console.log('Variation');
}
else if(variation === 0) {
    console.log('Baseline');
}
else if(variation === -1) {
    console.log('Not in Test');
}
```

#### Weighting

The default behavior is to evenly split traffic between all variations.

```js
// 80% in the baseline, 20% in variation
const variation = experimentByUser('80-20-weighting', {weights: [0.8, 0.2]});
```

### Forcing Variations

During development or testing, you often want to force a specific variation.  There are 3 ways to do this.

**Note:** When a variation is forced, it will not fire a tracking event.

1.  Explicit mapping:
    ```js
    import {configure} from '@growthbook/growthbook';

    configure({
        experimentConfig: {
            // Force variation 1
            'my-experiment-id': {variation: 1}
        }
    })
    ```
2.  Querystring parameters:
    ```js
    import {configure} from '@growthbook/growthbook';

    configure({
        // Default is false
        experimentQueryStringOverride: true
    });

    // Now you can add `?my-experiment-id=1` to the url to force variation 1
    ```
3.  Disable all experiments globally (useful for automated testing)
    ```js
    import {configure} from '@growthbook/growthbook';

    configure({
        // Default is true
        // When false, all experiments will return `-1` for the variation
        enableExperiments: false
    })
    ```

### Custom Track Method

By default, choosing a variation triggers a track event `viewed_experiment` with properties `experiment` and `variation`.

You can customize this behavior by providing your own callback instead.  This can even be used to integrate with 3rd party libraries like Segment.

**Note:** Tracking is not called when the variation is `-1` or when the variation was forced via any of the above methods.

```js
import {configure} from '@growthbook/growthbook';

// Segment example
configure({
    trackExperimentOverride: (experiment, variation) => {
        analytics.track('Experiment Viewed', {
            experiment_id: experiment,
            experiment_name: experiment,
            variation_id: variation,
            variation_name: variation
        });
    }
});
```