;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}

  const state = {
    tab: 0,
    subtab: 0,
    fields: null,
    product: null,
    report: null,
    loading: false,
    elapsed: 0,
    error: '',
    meta: null,
    manualIdentityDraft: '',
    inflight: false,
    requestId: '',
    fieldsVersion: 0,
    health: null,
    historyList: [],
    viewingHistory: null,
    saveNotice: '',
  }

  const listeners = []

  function get() {
    return state
  }

  function update(patch, reason) {
    Object.assign(state, patch)
    for (let i = 0; i < listeners.length; i += 1) listeners[i](state, reason)
    return state
  }

  function subscribe(fn) {
    listeners.push(fn)
    return function unsubscribe() {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    }
  }

  ns.sidepanel.state = { get, update, subscribe }
})(typeof globalThis !== 'undefined' ? globalThis : self)
