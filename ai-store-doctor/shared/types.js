;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  /**
   * @typedef {Object} ProductImage
   * @property {string} src
   */

  /**
   * @typedef {Object} ProductFields
   * @property {string|null} title
   * @property {string|null} category
   * @property {string[]} keywords
   * @property {string[]} specs
   * @property {string[]} formFields
   * @property {string[]} certifications
   * @property {string|null} description
   * @property {string|null} sku
   * @property {string|null} brand
   * @property {string|null} companyName
   * @property {string|null} companyProfile
   * @property {string|null} visibleText
   * @property {ProductImage[]} images
   * @property {string|null} pageTitle
   * @property {number} frameCount
   * @property {string} [readAt]
   * @property {string} url
   * @property {string|null} [userConfirmedIdentity]
   */

  /**
   * @typedef {Object} CallMeta
   * @property {string} [provider]
   * @property {string} [model]
   * @property {object} [usage]
   * @property {number} [attempts]
   * @property {boolean} [visionUsed]
   */

  /**
   * @typedef {Object} AnalysisResult
   * @property {object} [summary]
   * @property {object[]} [identityCandidates]
   * @property {object[]} [facts]
   * @property {object} [keywords]
   * @property {object} [content]
   * @property {object} [debug]
   */

  /**
   * @typedef {Object} HistoryRecord
   * @property {string} id
   * @property {string} url
   * @property {number} createdAt
   */

  ns.types = ns.types || {}
})(typeof globalThis !== 'undefined' ? globalThis : self)
