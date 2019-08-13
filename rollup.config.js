/** @format */

import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import {terser} from 'rollup-plugin-terser'
import typescript from 'rollup-plugin-typescript2'
import tscompile from 'typescript'
import pkg from './package.json'

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

export default [
  // browser-friendly UMD build
  {
    input: pkg.input,
    output: {name: 'Cyre', file: pkg.browser, format: 'umd', indent: false},
    plugins: [
      typescript({typescript: tscompile, target: 'ESNext'}),
      ,
      resolve(), // so Rollup can find `ms`
      commonjs() // so Rollup can convert `ms` to an ES module

      /*  terser({
        compress: {
          ecma: 6,
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false,
        }
      })  */
    ]
  },

  {
    input: pkg.input,
    external: ['ms'],
    output: [{file: pkg.main, format: 'cjs'}, {file: pkg.module, format: 'es'}],
    plugins: [
      typescript({typescript: tscompile, target: 'ESNext'}),
      terser({
        compress: {
          ecma: 6,
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false
        }
      })
    ]
  }
]
