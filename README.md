# Growthbook Javascript Library

Small utility library to interact with the Growthbook API.

## Installation

`yarn add growthbook` or `npm install --save growthbook`

## Usage

When you initialize/bootstrap your application:

```js
import {init} from 'growthbook';

init("my-public-key");
```

When the user is authenticated:

```js
import {setUserId} from 'growthbook';

// This does not fire any track events. It just configures
// future track events to contain a `user_id` property.
setUserId("12345");
```

When the context changes (e.g. page navigation):

```js
import {setDefaultTrackingProps} from 'growthbook';

// This does not fire any track events. It just configures
// future track events to contain these properties by default.
setDefaultTrackingProps({
    page: 'careers',
    section: 'about'
})
```

When you want to track an event:

```js
import {track} from 'growthbook';

// Event name and whatever event properties you want to track
track('clicked_button', {color: 'red'});
```

When you want to run an AB test:

```js
import {userExperiment} from 'growthbook'

const variation = userExperiment('my-experiment-id');

if(variation === 1) {
    console.log('Variation');
}
else {
    console.log('Baseline');
}
```