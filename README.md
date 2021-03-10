# Growth Book Javascript Library

Small utility library to run controlled experiments (i.e. A/B/n tests) in javascript.

![Build Status](https://github.com/growthbook/growthbook-js/workflows/Build/badge.svg)

-  No external dependencies
-  Lightweight and fast (4Kb gzipped)
-  No HTTP requests, everything is defined and evaluated locally
-  Supports both browser and NodeJS environments
-  Works with static pages, SPAs, React, and more
-  Written in Typescript with an extensive test suite
-  Advanced user and page targeting
-  Multiple implementation options

## Installation

`yarn add @growthbook/growthbook` 

or 

`npm install --save @growthbook/growthbook`

or use directly in your HTML without installing first:

```html
<script type="module">
import GrowthBookClient from 'https://unpkg.com/@growthbook/growthbook/dist/growthbook.esm.min.js';
//...
</script>
```

## Quick Usage

```ts
import GrowthBookClient from '@growthbook/growthbook';

const client = new GrowthBookClient();

// Define the user that you want to run an experiment on
const user = client.user({id: "12345"});

// Put the user in an experiment
const {variation} = user.experiment({
    key: "my-experiment",
    variations: 2
});

if(variation === 1) {
    console.log("B!");
}
else {
    console.log("A!");
}
```

## Experiments

As shown above, the simplest experiment you can define has 2 fields: `key` and `variations`.

There are a lot more configuration options you can specify.  Here is the full typescript definition:

```ts
interface Experiment {
    // The globally unique tracking key for the experiment
    key: string;
    // Number of variations, or an array with more detailed info for each variation
    variations: number | DetailedVariationInfo[];
    // "running" is always active, "draft" is only active during QA. "stopped" is only active when forcing a winning variation
    status: "draft" | "running" | "stopped";
    // What percent of users should be included in the experiment. Float from 0 to 1.
    coverage?: number;
    // Users can only be included in this experiment if the current URL matches this regex
    url?: string;
    // Array of strings if the format "{key} {operator} {value}"
    // Users must pass all of these targeting rules to be included in this experiment
    targeting?: string[];
    // If specified, all users included in the experiment should be forced into the 
    // specified variation (0 is control, 1 is first variation, etc.)
    force?: number;
    // If true, use anonymous id for assigning, otherwise use logged-in user id
    anon: boolean;
    // If true, users who match all targeting rules should automatically be put into the test
    auto: boolean;
}

interface DetailedVariationInfo {
    // The tracking key for the variation (not globally unique)
    // Defaults to "0" for control, "1" for first variation, etc.
    key?: string;
    // Determines traffic split. Float from 0 to 1, weights for all variations must sum to 1.
    // Defaults to an even split between all variations
    weight?: number;
    // Arbitrary data attached to the variation. Used to parameterize experiments.
    data?: {
        [key: string]: any;
    };
    // CSS rules that should be injected to the page if this variation is chosen
    css?: string;
    // DOM modifications that should be applied if this variation is chosen
    dom?: {
        selector: string;
        mutation: "addClass" | "removeClass" | "appendHTML" | "setHTML" | "setAttribute";
        value: string;
    }[];
    // Callback function that is called when a user is assigned this variation
    activate?: () => void;
    // Cleanup function to undo any changes made in `activate`
    deactivate?: () => void;
};
```

## Running Experiments

There are 4 different ways to run experiments. You can use more than one of these at a time; choose what makes sense on a case-by-case basis.

### 1. Automatic (Browser Only)

With the Automatic approach, users who match the targeting rules will automatically be assigned and shown a variation.

Requirements:
-  Browser environment (NodeJS support is coming soon)
-  Experiment must have `auto` set to true
-  Experiment must set the `url` regex field (setting to `.*` is fine, it just can't be empty)
-  Experiment must define `variations` as an array with dom, css, and/or activate properties for at least 1 variation

Here is an example experiment that meets these requirements:

```ts
// Add the experiments on the client
client.experiments.push({
    key: "my-automatic-experiment",
    auto: true,
    url: "^/post/[0-9]+",
    variations: [
        // Control (doesn't change the page at all)
        {},
        // Variation 1
        {
            dom: [
                {
                    selector: "h1",
                    mutation: "setHTML",
                    value: "My New Title"
                }
            ],
            css: "h1 { color: red; }",
            activate: () => {
                // Arbitrary javascript
                window.inTheVariation = true;
            },
            deactivate: () => {
                // Undo whatever changes were made in `activate`
                window.inTheVariation = false;
            }
        }
    ]
});
```

If the user lands on the url `/post/123`, they will be assigned a variation, dom/css changes will be applied, and your `activate` function will be called.

### 2. Code Branching (Browser and NodeJS)

With this approach, you put the user in the experiment and fork your code dependeing on the assigned variation.

```ts
const {variation} = user.experiment({
    key: "my-branching-experiment",
    variations: 2
});

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

### 3. Parameterization (Browser and NodeJS)

You can use Parameterization as a cleaner alternative to code branching for simple experiments.

Requirements:
-  Experiment must define `variations` as an array with the `data` property for each variation

Instead of branching, you would extract the data from the chosen variation:
```ts
// Get data from the assigned variation
const {data} = user.experiment({
    key: "my-parameterized-experiment",
    variations: [
        // Control
        {
            data: {
                color: "blue"
            }
        },
        // Variation
        {
            data: {
                color: "green"
            }
        }
    ]
});

// Use data tied to the chosen variation, no branching required
const buttonColor = data.color || "blue";
```

### 4. Feature Flags (Browser and NodeJS)

Parameterization still requires referencing experiments directly in code.  Using feature flags, you can get some of the same benefits while also keeping your code more maintainable.

Requirements:
-  Experiment must define `variations` as an array with the `data` property for each variation
-  Use more descriptive data keys (e.g. `homepage.signup.color` instead of just `color`)

First, add your experiment definitions to the client:

```ts
client.experiments.push({
    key: "my-feature-flag-experiment",
    variations: [
        // Control
        {
            data: {
                "homepage.signup.color": "blue"
            }
        },
        // Variation
        {
            data: {
                "homepage.signup.color": "green"
            }
        }
    ]
})
```

Now you can do a lookup based on the data key without knowing about which (if any) experiments are running:

```ts
const buttonColor = user.getFeatureFlag("homepage.signup.color") || "blue";
```

## Client Configuration

The GrowthBookClient constructor takes an optional `options` argument.

Below are all of the available options:

-  **enabled** - Default true. Set to false to completely disable all experiments.
-  **debug** - Default false. If set to true, console.log info about why experiments are run and why specific variations are chosen.
-  **onExperimentViewed** - Callback when the user views an experiment. Passed an object with `experiment` and `variation` properties.
-  **url** - The URL for the current request (defaults to `window.location.href` when in a browser)
-  **enableQueryStringOverride** - Default true.  If true, enables forcing variations via the URL.  Very useful for QA.  https://example.com/?my-experiment=1

### SPA support

With a Single Page App (SPA), you need to update the client when the URL changes:

```ts
client.setUrl(newUrl);
```

Doing this with Next.js for example, will look like this:
```tsx
export default function MyApp({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    const onChange = (newUrl) => client.setUrl(newUrl);
    router.events.on('routeChangeComplete', onChange);
    return () => router.events.off('routeChangeComplete', onChange);
  }, [])

  return <Component {...pageProps} />
}
```

## User Configuration

The `client.user` method supports both logged-in and anonymous users. To create an anonymous user, specify `anonId` instead of `id`:
```js
const user = client.user({anonId: "abcdef"});
```

If you have both an anonymous id and a logged-in user id, you can pass both:
```js
const user = client.user({
    anonId: "abcdef",
    userId: "12345"
});
```

You can also include attributes about the user.  These attributes are never sent across the network and are only used to locally evaluate experiment targeting rules:

```js
const user = client.user({
    id: "12345",
    attributes: {
        // Any attributes about the user or page that you want to use for experiment targeting
        premium: true,
        accountAge: 36,
        source: "google"
    }
});
```

You can update these at any time by calling `user.setAttributes`. By default, this completely overwrites all previous attributes. To do a 
shallow merge instead, pass `true` as the 2nd argument.

```js
user.setAttributes({
    premium: false
})
```

### Targeting

Experiments can target on these user attributes with the `targeting` field.  Here's an example:

```ts
user.experiment({
    key: "my-targeted-experiment",
    variations: 2,
    targeting: [
        "premium = true",
        "accountAge > 30"
    ]
})
```

Users will only be included in the experiment if they match the targeting rules.

## Event Tracking

Typically, you'll want to track who sees which experiment so you can analyze the data later.  Here's an example of tracking with Segment:

```ts
// Specify a tracking callback when instantiating the client
const client = new GrowthBookClient({
    onExperimentViewed: (data) => {
        analytics.track("Experiment Viewed", {
            experimentId: data.experiment.key,
            variationId: data.variationKey
        });
    }
});
```

## Using with the Growth Book App

Managing experiments and analyzing results at scale can be complicated, which is why we built the [Growth Book App](https://www.growthbook.io).  It's completely optional, but definitely worth checking out.

-  Document your experiments with screenshots, markdown, and comment threads
-  Connect to your existing data warehouse or analytics tool to automatically fetch results
   -  Currently supports Snowflake, BigQuery, Redshift, Postgres, Mixpanel, GA, and Athena
-  Advanced bayesian statistics and automated data-quality checks (SRM, etc.)
-  Simple and affordable pricing

Integration is super easy:

1.  Create a Growth Book API key - https://docs.growthbook.io/api
2.  Periodically fetch the latest experiment list from the API and cache in Redis, Mongo, etc.
3.  At the start of your app, run `client.experiments.push(...listFromDB)`

Now you can start/stop tests, adjust coverage and variation weights, and apply a winning variation to 100% of traffic, all within the Growth Book App without deploying code changes to your site.