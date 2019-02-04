# CYRE

```sh
  Neural Line
  ID and Time based event manager
  C.Y.R.E ~/`SAYER`/
  Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
  Expands VERTICALLY as projects grow 2019

```

> Redux influenced in app communication manager for small and interactive applications.

[![NPM Version][npm-image]][npm-url]
[![NPM Version][npm-download]][npm-url]
[![NPM Version][npm-size]][npm-url]

## Installation

```sh
npm i cyre
yarn add cyre
```

## Usage example

```js

import {cyre} from 'cyre'

/*
  {
    cyre.action: 'predefine action with preconditions and with default payload',
    cyre.on: 'link action.type with function' ,
    cyre.emit: 'execute action by id'
    cyre.dispatch:'define and execute action on demand'
  }

*/
//eg simple use:
  cyre.on('call_uber', (UBER_ID)=>{
    return uber.api(UBER_ID).request
  }
  cyre.dispatch({id: 'uber', type: 'call_uber', payload: 'UBER-ID1'})

  //Advance use:
    //function:
      const arrivalTimeFunction =(UBER_ID)=>{
           return uber.api(UBER_ID).eta
        }

    //applications:
      //link action with a function
      cyre.on('check_uber', arrivalTimeFunction)

      //create action with unique ID
      cyre.action({id: 'uber_eta', type: 'check_uber', payload: 'UBER-ID1'})

    //user interface: at action creators/view model
      //execute action with default payload
      cyre.emit{'uber_eta'}

      //execute action with new payload
      cyre.emit{'uber_eta', 'UBER-ID2'}

```

## Extra features

```js
//Delay effect/debounce/or throttle action
cyre.action({ id: "screen resize", type: "adjustScreen", interval: 400 });
```

```js
//Repeat action
cyre.action({ id: "api call", type: "apiServer", interval: 400, repeat: 10 });
```

```js
//Stop all iterating actions
cyre.clr();
```

```js
//Remove functions from listening
cyre.off(functionName);
```

## Made with Cyre

cyre with React

[cyre-react-demo](https://cyre-react-demo.netlify.com/)<br />

[holo-carousel  ES6](https://holo-carousel.firebaseapp.com/)

## Release History

- 1.0.0
  - initial commit

## Meta

Distributed under the MIT license. See `LICENSE` for more information.

[https://github.com/NeuralLine](https://github.com/NeuralLine)

## Contributing

1. Fork it (<https://www.npmjs.com/package/cyre/fork>)

<!-- Markdown link & img dfn's -->

[npm-image]: https://img.shields.io/npm/v/cyre.svg?style=flat
[npm-url]: https://www.npmjs.com/package/cyre
[npm-download]: https://img.shields.io/npm/dt/cyre.svg?style=flat
[npm-size]: https://img.shields.io/bundlephobia/min/cyre.svg?style=flat
