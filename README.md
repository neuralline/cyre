<!-- @format -->

# CYRE

```sh

  Neural Line
  ID based event manager
  C.Y.R.E ~/`SAYER`/
  action-on-call

```
> Cyre is designed to provide reactive and dynamic networking throughout the application. It's really interesting because the whole operation evolves around controlling the behavior how they communicate between each other.

>If you are familiar with javascript pub/sub method or Redux's dispatchers/reducers you are good to go with Cyre. The main difference would be Cyre has one extra step, action(action, on, call) some methodology difference

#Action
> Actions in cyre are the operators, the link between dispatchers and reducers of all  services that application provide. The application could have unlimited number of emitters and subscribers however services can only be able to communicate through if their ID is listed in the actions list. Therefore limiting unauthorized access with reducers or vice-versa.  

>Actions in Cyre stack vertically, each action can have its own middleware, conditions and pre-payload. 
>One action can have its own error log without affecting  the next action's performance
```js
cyre.action('reducer_id')
```
#On
> On in cyre are the reducers/absorbers except that they don't listen to every dispatches/emits. Cyre targets specific reducer by their action type ID so they only act up on when they are called. One action can have multiple listeners and these listeners can be named or anonymous, => arrow, functions
```js
cyre.on('uber', number => {
  return `calling taxi on ${number}`
})
```
#Call
> Calls in Cyre are interesting methods because they are not particularly emitters more like triggers. I call them Air lift technology. Think of them like an embassy sends rescue drone to return its citizens in post apocalypse situation. Cyre doesn't concern about the emitter or the situation, only their ID. If the is valid against home database, actions list, it will dispatch the package to, trigger action, with that ID with optional new payload. Calls are runtime methods so thats why they need to be lightweight.
```js
cyre.call('uber')
```


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
    cyre.action: 'predefine action with preconditions and default payload',
    cyre.on: 'link action.type with function' ,
    cyre.call: 'execute action by id'
    cyre.dispatch:'define and execute action on demand'
  }

*/
//eg simple use:

eg simple use

cyre.action({ id: 'uber', payload: 44085648634 })
cyre.on('uber', number => {
  console.log("calling taxi on ", number)
})
cyre.call('uber')



//user interface: at action creators/view model
//execute action with default payload
cyre.call('uber')

//execute action with new payload
cyre.call('uber', 220748567807)






```

## Extra features

```js
//Delay effect/debounce/or throttle action
cyre.action({
  id: 'screen_resize',
  type: 'adjustScreen',
  interval: 400
})
```

```js
//Repeat action
cyre.action({
  id: 'apiCall',
  type: 'apiServer',
  interval: 400,
  repeat: 10
})
```

```js
//Log for specific action
cyre.action({id: 'apiCall', type: 'apiServer', log: true})
```

```js
//Stop all iterating actions
cyre.clr()
```

```js
//Remove functions from listening
cyre.off(functionName)
```

## Cyre examples

[cyre-react-demo](https://cyre-react-demo.netlify.com/)<br />

[holo-carousel ES6](https://holo-carousel.firebaseapp.com/)

## Made with Cyre git projects

[Cyre React example](https://github.com/neuralline/cyre-react-counter-demo)<br />

[holo-carousel](https://github.com/neuralline/holo-carousel)

## Project pipeline

- 1.0.0 initial commit
  - adding functionality
  - expand useability
  - fix compatibility

- 1.2.0 optimization
  - increase performance
  - testability
  - reliability

## Meta

Distributed under the MIT license. See `LICENSE` for more information.

[https://github.com/NeuralLine](https://github.com/NeuralLine)

## Contributing

1. Fork it (<https://www.npmjs.com/package/cyre/fork>)

```sh

Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
Expands VERTICALLY as projects grows 2019

```

<!-- Markdown link & img -->

[npm-image]: https://img.shields.io/npm/v/cyre.svg?style=flat
[npm-url]: https://www.npmjs.com/package/cyre
[npm-download]: https://img.shields.io/npm/dt/cyre.svg?style=flat
[npm-size]: https://img.shields.io/bundlephobia/min/cyre.svg?style=flat
