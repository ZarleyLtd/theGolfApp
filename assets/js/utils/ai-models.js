/**
 * AI model priority chain + automatic fallback runner.
 *
 * The admin-defined chain lives in the app_settings table (key 'ai_models') and is edited on
 * admin/settings.html. Callers use runWithFallback() so that a failed model call automatically
 * retries with the next model down the list, reporting each switch through the onAttempt callback
 * so the on-screen "working" message can be updated live.
 *
 * Load after api-client.js and before any page script that makes AI calls.
 */
(function () {
  'use strict';

  /* Used only if the settings row and the server default are both unavailable. */
  var HARDCODED_FALLBACK_CHAIN = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview'];

  var chainPromise = null;

  function getApi() {
    if (typeof ApiClient !== 'undefined') return ApiClient;
    if (typeof window !== 'undefined' && window.ApiClient) return window.ApiClient;
    return null;
  }

  function normalizeChain(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var id = String(list[i] || '').trim();
      if (id && out.indexOf(id) === -1) out.push(id);
    }
    return out;
  }

  /**
   * Ordered list of model ids to try. Resolves to the saved priority order, falling back to the
   * server default chain, then to HARDCODED_FALLBACK_CHAIN. Cached for the life of the page.
   * @returns {Promise<string[]>}
   */
  function getChain() {
    if (chainPromise) return chainPromise;
    var api = getApi();
    if (!api) return Promise.resolve(HARDCODED_FALLBACK_CHAIN.slice());

    chainPromise = api.get({ action: 'getAppSettings', key: 'ai_models' })
      .then(function (res) {
        var saved = normalizeChain(res && res.value && res.value.priority);
        if (saved.length) return saved;
        var serverDefault = normalizeChain(res && res.defaultPriority);
        if (serverDefault.length) return serverDefault;
        return HARDCODED_FALLBACK_CHAIN.slice();
      })
      .catch(function () {
        return HARDCODED_FALLBACK_CHAIN.slice();
      });

    return chainPromise;
  }

  /** Drop the cached chain so the next getChain() re-reads the saved settings. */
  function clearChainCache() {
    chainPromise = null;
  }

  function shortReason(err) {
    var msg = (err && err.message) ? String(err.message) : 'Unknown error';
    msg = msg.replace(/\s+/g, ' ').trim();
    if (msg.length > 140) msg = msg.slice(0, 137) + '…';
    if (!/[.!?…]$/.test(msg)) msg += '.';
    return msg;
  }

  /**
   * Run an AI-backed API action against the priority chain, moving to the next model on failure.
   *
   * Only a rejected request triggers a fallback: Gemini and transport failures surface as
   * rejections, whereas business-logic problems (e.g. "Outing not found") resolve with
   * success:false and stop immediately rather than burning the whole chain.
   *
   * @param {string} action - API action name (must accept a `model` field).
   * @param {Object} data - Payload for the action.
   * @param {Object} [opts]
   * @param {Function} [opts.onAttempt] - Called before each try with
   *   { model, index, total, previousModel, previousReason }.
   * @param {string} [opts.societyId] - Passed through to ApiClient.post.
   * @returns {Promise<Object>} Resolves with the API result, plus `model` and `attempts` metadata.
   */
  function runWithFallback(action, data, opts) {
    var options = opts || {};
    var onAttempt = typeof options.onAttempt === 'function' ? options.onAttempt : null;
    var api = getApi();
    if (!api) return Promise.reject(new Error('API client not available.'));

    return getChain().then(function (chain) {
      var models = chain.length ? chain : HARDCODED_FALLBACK_CHAIN.slice();
      var attempts = [];

      function attempt(index, previousModel, previousReason) {
        var model = models[index];
        if (onAttempt) {
          try {
            onAttempt({
              model: model,
              index: index,
              total: models.length,
              previousModel: previousModel || '',
              previousReason: previousReason || ''
            });
          } catch (e) {
            /* A reporting failure must not abort the AI call. */
          }
        }

        var payload = {};
        for (var key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) payload[key] = data[key];
        }
        payload.model = model;

        return api.post(action, payload, options.societyId).then(function (result) {
          attempts.push({ model: model, ok: true });
          if (result && typeof result === 'object') {
            if (!result.model) result.model = model;
            result.attempts = attempts;
          }
          return result;
        }).catch(function (err) {
          var reason = shortReason(err);
          attempts.push({ model: model, ok: false, error: reason });

          if (index + 1 < models.length) {
            return attempt(index + 1, model, reason);
          }

          var finalError = new Error(
            models.length > 1
              ? 'All ' + models.length + ' AI models failed. Last error from ' + model + ': ' + reason
              : reason
          );
          finalError.attempts = attempts;
          finalError.lastModel = model;
          if (err && err.code) finalError.code = err.code;
          throw finalError;
        });
      }

      return attempt(0, '', '');
    });
  }

  /**
   * Standard wording for the "working" message so every AI surface reads the same way.
   * @param {Object} info - The object passed to onAttempt.
   * @param {string} [activity] - e.g. 'preparing its report'.
   * @returns {string}
   */
  function describeAttempt(info, activity) {
    var attempt = info || {};
    var model = String(attempt.model || '').trim();
    var what = activity || 'working';
    if (attempt.previousReason) {
      return (attempt.previousModel || 'The previous model') + ' failed: ' +
        attempt.previousReason + ' Now trying ' + model + '.';
    }
    return 'The AI model ' + model + ' is ' + what + '.';
  }

  window.AiModels = {
    getChain: getChain,
    clearChainCache: clearChainCache,
    runWithFallback: runWithFallback,
    describeAttempt: describeAttempt
  };
})();
