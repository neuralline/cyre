// src/elements/data-definitions.ts
// Minimal data definitions - most validation moved to schema

/*
  Since we're using schema validation as primary validation method,
  this file is kept minimal for backward compatibility
*/

const dataDefinitions = {
  // Keep minimal legacy definitions for any remaining edge cases
  id: (attribute: string = '') => ({
    ok: true,
    payload: attribute
  }),

  type: (attribute: string = '') => ({
    ok: true,
    payload: attribute
  }),

  payload: (attribute: any = undefined) => ({
    ok: true,
    payload: attribute
  }),

  // Internal properties that may not be covered by schema
  _protectionPipeline: (attribute: any = []) => ({
    ok: true,
    payload: Array.isArray(attribute) ? attribute : []
  }),

  _debounceTimer: (attribute: string = '') => ({
    ok: true,
    payload: typeof attribute === 'string' ? attribute : ''
  })
}

export default dataDefinitions
