# CYRE

/* 
```sh
  Neural Line
  Time based event manager
  C.Y.R.E
  Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
  EVENT HANDLER with ID system 01 - 01 - 2019 

```



# CYRE ~/`SAYER`/
> Redux influenced in app communication manager with a simple solution for complicated application.

[![NPM Version][npm-image]][npm-url]

What is it? looks after how tasks behave in javascript subscribe publish system for React and single page apps



## Installation



```sh
npm i cyre
yarn add cyre
```

## Usage example
```sh
eg simple use- dispatch, on
  cyre.dispatch{id: 'uber', action: 'call', payload: 0121705695}
  cyre.on('call', callTaxi)
  const callTaxiFunction =(number)=>{
    console.log('calling taxi on ', number)  
  }


  advance use- channel, on , call

    functions:
      const arrivalTimeFunction =(UBER-ID)=>{
            eta = uber.api(UBER-ID)
        }

    applications:
      //link action with function
      cyre.on('check uber', arrivalTimeFunction)
      //predefine action and conditions with unique ID
      cyre.channel{id: 'check if my uber arrived', action: 'check uber', payload: 'UBER-ID1', interval: 60000, repeat: 5}        
    
    user interface:
     //this will run arrivalTimeFunction five times every one minute
      cyre.call{'check if my uber arrived'}
      //this will update the payload with new data and run arrivalTimeFunction five times every one minute
      cyre.call{'check if my uber arrived', 'UBER-ID2'}

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
