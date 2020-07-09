# Growthbook Javascript Library

Small utility library to interact with the Growthbook API.

## Installation

`yarn add growthbook` or `npm install --save growthbook`

## Configuration

```js
import {configure} from 'growthbook';

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
import {track} from 'growthbook';

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
import {experimentByUser} from 'growthbook'

// Will be 0 or 1 (or -1 if the user is not put in the test for whatever reason)
const variation = experimentByUser('my-experiment-id');

if(variation === 1) {
    console.log('Variation');
}
else {
    console.log('Baseline');
}
```

### AB Testing Options

Both experiment methods take a 2nd parameter *weights* that let you customize the behavior.

```js
import {experimentByUser} from 'growthbook'

// Uneven weighting - 20% baseline, 80% variation
const variation = experimentByUser('my-experiment-id', [0.2, 0.8]);

// Reduced test coverage - 10% baseline, 10% variation, 80% not in test
const variation2 = experimentByUser('my-experiment-id', [0.1, 0.1]);

// More than 2 variations - will return 0, 1, or 2 (or -1 if user is not put in test)
const variation3 = experimentByUser('my-experiment-id', [0.34, 0.33, 0.33]);
```

### Forcing Variations

During development or testing, you often want to force a specific variation.  There are 3 ways to do this:

1.  Explicit:
    ```js
    import {configure} from 'growthbook';

    configure({
        experimentConfig: {
            // Force variation 1 (also disables event tracking for this test)
            'my-experiment-id': 1
        }
    })
    ```
2.  Via querystring parameters
    ```js
    import {configure} from 'growthbook';

    configure({
        // Default is false
        experimentQueryStringOverride: true
    });

    // Now you can add `?my-experiment-id=1` to the url to force variation 1
    ```
3.  Disable all experiments globally (useful for automated testing)
    ```js
    import {configure} from 'growthbook';

    configure({
        // Default is true
        // When false, all experiments will return `-1` for the variation
        enableExperiments: false
    })
    ```

## Custom Track Method

If you only want to use Growth Book for AB testing, you can override the built-in event tracking code:

```js
import {configure} from 'growthbook';

// Segment example
configure({
    trackOverride: (eventName, properties) => {
        analytics.track(eventName, properties);
    }
});
```