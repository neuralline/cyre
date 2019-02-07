/** @format */

import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import {terser} from 'rollup-plugin-terser'
import pkg from './package.json'

export default [
  // browser-friendly UMD build
  {
    input: 'src/app.js',
    output: {
      name: 'Cyre',
      file: pkg.browser,
      format: 'umd',
      indent: false
    },
    plugins: [
      resolve(), // so Rollup can find `ms`
      commonjs(), // so Rollup can convert `ms` to an ES module
      babel({
        exclude: 'node_modules/**'
      }),
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
  },

  {
    input: 'src/app.js',
    external: ['ms'],
    output: [{file: pkg.main, format: 'cjs'}, {file: pkg.module, format: 'es'}]
    /*, plugins: [babel()] */
  }
]
