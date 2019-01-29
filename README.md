# CYRE

```sh
  Neural Line
  ID and Time based event manager
  C.Y.R.E ~/`SAYER`/
  Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
  EVENT HANDLER with ID system 01 - 01 - 2019 

```


> Redux influenced in app communication manager for small and interactive applications. 

[![NPM Version][npm-image]][npm-url]


## Installation


```sh
npm i cyre
yarn add cyre
```

## Usage example
```sh
eg simple use- dispatch, on
  cyre.dispatch{id: 'uber', type: 'call', payload: 'UBER-ID1'}
  cyre.type('call', callUberFunction)

  const callUberFunction =(number)=>{
    console.log('calling taxi on ', number)  
  }


  advance use- action, type , call

    function:
      const arrivalTimeFunction =(UBER-ID)=>{
            eta = uber.api(UBER-ID)
        }

    //applications:
      //link action with a function
      cyre.type('check uber', arrivalTimeFunction)

      //predefine action and conditions with unique ID
      cyre.action{id: 'check if my uber arrived', action: 'check uber', payload: 'UBER-ID1', interval: 60000, repeat: 5}        
    
    //user interface: action creators/view model can use the ID to call that action with a new payload:
     //this will run arrivalTimeFunction five times every one minute
      cyre.call{'check if my uber arrived'}

      //this will update the payload with new data and run arrivalTimeFunction five times every one minute
      cyre.call{'check if my uber arrived', 'UBER-ID2'}

```


## Extra features


```sh

//Delay effect
cyre.dispatch({ID : 'screen resize', type:'adjustScreen', interval: 400})
```

```sh

//Repeat action
cyre.dispatch({ID : 'api call', type:'apiServer', interval: 400, repeat: 10})
```

```sh

//Stop all iterating actions
cyre.clr()
```
```sh

//Remove functions from listening
cyre.kick(functionName)
```



## Release History


* 1.0.0
    * initial commit

## Meta

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/NeuralLine](https://github.com/NeuralLine)

## Contributing

1. Fork it (<https://www.npmjs.com/package/cyre/fork>)

<!-- Markdown link & img dfn's -->
[npm-image]: https://img.shields.io/npm/v/datadog-metrics.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/cyre
