/**
 * Page module for admin/settings.html.
 *
 * Sections are collapsible and rendered independently, so further settings sections can be added
 * without touching existing ones. Current sections: Available AI Models, AI Model Order, Course Lookup Prompt, Commentary AI Prompt.
 */
(function () {
  'use strict';

  /* All generateContent-capable models reported for the API key. */
  var availableModels = [];
  /* Ordered model ids the admin has selected. Order is the fallback priority. */
  var priority = [];
  var savedSnapshot = { priority: [] };
  /**
   * Display order for the Available list, frozen while the section stays open so that ticking a
   * model does not make rows jump. Recomputed only when the section is (re)opened.
   */
  var availableOrder = [];
  var modelsLoaded = false;
  var dragFromIndex = -1;
  var commentaryPromptText = '';
  var commentaryDefaultText = '';
  var commentarySavedText = '';
  var courseLookupPromptText = '';
  var courseLookupDefaultText = '';
  var courseLookupSavedText = '';

  function getApi() {
    if (typeof ApiClient !== 'undefined') return ApiClient;
    if (typeof window !== 'undefined' && window.ApiClient) return window.ApiClient;
    return null;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function showAlert(message, isError) {
    var container = el('alertContainer');
    if (!container) return;
    if (!message) {
      container.innerHTML = '';
      return;
    }
    var div = document.createElement('div');
    div.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
    div.textContent = message;
    container.innerHTML = '';
    container.appendChild(div);
    if (!isError) {
      setTimeout(function () {
        if (container.contains(div)) container.removeChild(div);
      }, 4000);
    }
  }

  function setSettingsStatus(message, isError) {
    var status = el('settingsStatus');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'settings-status' + (isError ? ' error' : '');
  }

  function setAvailableStatus(message, isError) {
    var status = el('availableModelsStatus');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'settings-status' + (isError ? ' error' : '');
  }

  function findModel(id) {
    for (var i = 0; i < availableModels.length; i++) {
      if (availableModels[i].id === id) return availableModels[i];
    }
    return null;
  }

  /** Selected models first (in priority order), then the rest as the API returned them. */
  function refreshAvailableOrder() {
    var selected = [];
    var rest = [];
    availableModels.forEach(function (model) {
      if (priority.indexOf(model.id) !== -1) selected.push(model.id);
      else rest.push(model.id);
    });
    selected.sort(function (a, b) {
      return priority.indexOf(a) - priority.indexOf(b);
    });
    availableOrder = selected.concat(rest);
  }

  function orderedModels() {
    var out = [];
    availableOrder.forEach(function (id) {
      var model = findModel(id);
      if (model) out.push(model);
    });
    /* Anything the API added since the order was frozen still needs to be listed. */
    availableModels.forEach(function (model) {
      if (availableOrder.indexOf(model.id) === -1) out.push(model);
    });
    return out;
  }

  function renderAvailable() {
    var list = el('availableModelsList');
    if (!list) return;
    list.innerHTML = '';

    var models = orderedModels();
    if (!models.length) {
      var empty = document.createElement('li');
      empty.className = 'model-list__item';
      var msg = modelsLoaded ? 'No models to show.' : 'Loading models…';
      empty.innerHTML = '<span class="model-list__label"><span class="model-list__meta">' + msg + '</span></span>';
      list.appendChild(empty);
      return;
    }

    models.forEach(function (model) {
      var item = document.createElement('li');
      item.className = 'model-list__item';

      var checkboxId = 'model-' + model.id.replace(/[^a-z0-9]+/gi, '-');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.checked = priority.indexOf(model.id) !== -1;
      checkbox.addEventListener('change', function () {
        toggleModel(model.id, checkbox.checked);
      });

      var label = document.createElement('label');
      label.className = 'model-list__label';
      label.setAttribute('for', checkboxId);

      var idSpan = document.createElement('span');
      idSpan.className = 'model-list__id';
      idSpan.textContent = model.id;

      label.appendChild(idSpan);
      item.appendChild(checkbox);
      item.appendChild(label);
      list.appendChild(item);
    });
  }

  function renderPriority() {
    var list = el('priorityModelsList');
    if (!list) return;
    list.innerHTML = '';

    if (!priority.length) {
      var empty = document.createElement('li');
      empty.className = 'priority-empty';
      empty.textContent = 'No models selected yet.';
      list.appendChild(empty);
      return;
    }

    priority.forEach(function (id, index) {
      var model = findModel(id);
      var item = document.createElement('li');
      item.className = 'priority-list__item';
      item.setAttribute('draggable', 'true');
      item.dataset.index = String(index);

      var handle = document.createElement('span');
      handle.className = 'priority-list__handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.textContent = '⠿';

      var rank = document.createElement('span');
      rank.className = 'priority-list__rank';
      rank.textContent = String(index + 1);

      var name = document.createElement('span');
      name.className = 'priority-list__name';
      name.textContent = id;
      if (!model) {
        var missing = document.createElement('span');
        missing.className = 'model-badge model-badge--missing';
        missing.textContent = 'Unavailable';
        name.appendChild(missing);
      }

      item.appendChild(handle);
      item.appendChild(rank);
      item.appendChild(name);
      attachDragHandlers(item);
      list.appendChild(item);
    });
  }

  function attachDragHandlers(item) {
    item.addEventListener('dragstart', function (event) {
      var parsed = parseInt(item.dataset.index, 10);
      dragFromIndex = isFinite(parsed) ? parsed : -1;
      item.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        /* Firefox requires data to be set for the drag to start. */
        event.dataTransfer.setData('text/plain', item.dataset.index);
      }
    });

    item.addEventListener('dragend', function () {
      dragFromIndex = -1;
      item.classList.remove('is-dragging');
      clearDropTargets();
    });

    item.addEventListener('dragover', function (event) {
      if (dragFromIndex < 0) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      clearDropTargets();
      item.classList.add('is-drop-target');
    });

    item.addEventListener('dragleave', function () {
      item.classList.remove('is-drop-target');
    });

    item.addEventListener('drop', function (event) {
      event.preventDefault();
      var to = parseInt(item.dataset.index, 10);
      clearDropTargets();
      if (dragFromIndex >= 0 && dragFromIndex !== to) moveModel(dragFromIndex, to);
      dragFromIndex = -1;
    });
  }

  function clearDropTargets() {
    var targets = document.querySelectorAll('.priority-list__item.is-drop-target');
    for (var i = 0; i < targets.length; i++) targets[i].classList.remove('is-drop-target');
  }

  /** Reorders in place. Guards against NaN indexes, which would otherwise splice in `undefined`. */
  function moveModel(from, to) {
    if (!isFinite(from) || !isFinite(to)) return;
    if (from < 0 || to < 0 || from >= priority.length || to >= priority.length || from === to) return;
    var moved = priority.splice(from, 1);
    if (moved.length !== 1) return;
    priority.splice(to, 0, moved[0]);
    renderPriority();
    setSettingsStatus('Unsaved changes.');
  }

  function toggleModel(id, selected) {
    var at = priority.indexOf(id);
    if (selected && at === -1) {
      priority.push(id);
    } else if (!selected && at !== -1) {
      priority.splice(at, 1);
    } else {
      return;
    }
    renderAvailable();
    renderPriority();
    setSettingsStatus('Unsaved changes.');
  }

  function applySettings(value) {
    var saved = (value && Array.isArray(value.priority)) ? value.priority : [];
    priority = saved.map(function (m) { return String(m || '').trim(); }).filter(Boolean);
    savedSnapshot = { priority: priority.slice() };
  }

  function loadModels(refresh) {
    var api = getApi();
    if (!api) return Promise.reject(new Error('API client not available.'));
    var params = { action: 'listAiModels' };
    if (refresh) params.refresh = 'true';
    return api.get(params).then(function (res) {
      availableModels = (res && res.models) || [];
      modelsLoaded = true;
      return availableModels;
    });
  }

  function loadSettings() {
    var api = getApi();
    if (!api) return Promise.reject(new Error('API client not available.'));
    return api.get({ action: 'getAppSettings', key: 'ai_models' }).then(function (res) {
      applySettings(res && res.value);
      if (!priority.length) {
        /* Nothing saved yet: pre-populate with the server's default chain so Reset returns here. */
        priority = ((res && res.defaultPriority) || []).slice();
        savedSnapshot.priority = priority.slice();
      }
      return res;
    });
  }

  function getCourseLookupPromptFromForm() {
    var textarea = el('courseLookupPromptText');
    return String((textarea && textarea.value) || '').trim();
  }

  function getCommentaryPromptFromForm() {
    var textarea = el('commentaryPromptText');
    return String((textarea && textarea.value) || '').trim();
  }

  function save() {
    var api = getApi();
    if (!api) return;
    if (!priority.length) {
      setSettingsStatus('Select at least one model before saving.', true);
      return;
    }
    var commentaryText = getCommentaryPromptFromForm();
    if (!commentaryText) {
      setSettingsStatus('Commentary prompt text cannot be empty.', true);
      return;
    }
    var courseLookupText = getCourseLookupPromptFromForm();
    if (!courseLookupText) {
      setSettingsStatus('Course lookup prompt text cannot be empty.', true);
      return;
    }

    var saveBtn = el('saveSettingsBtn');
    var resetBtn = el('resetSettingsBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add('is-saving');
    }
    if (resetBtn) resetBtn.disabled = true;
    setSettingsStatus('Saving…');

    Promise.all([
      api.post('saveAppSettings', {
        key: 'ai_models',
        value: { priority: priority.slice() }
      }),
      api.post('saveAppSettings', {
        key: 'commentary_ai_prompt',
        value: { text: commentaryText }
      }),
      api.post('saveAppSettings', {
        key: 'course_lookup_prompt',
        value: { text: courseLookupText }
      })
    ]).then(function () {
      savedSnapshot = { priority: priority.slice() };
      commentaryPromptText = commentaryText;
      commentarySavedText = commentaryText;
      courseLookupPromptText = courseLookupText;
      courseLookupSavedText = courseLookupText;
      setSettingsStatus('Saved.');
      showAlert('Settings saved.', false);
      if (window.AiModels && typeof window.AiModels.clearChainCache === 'function') {
        window.AiModels.clearChainCache();
      }
    }).catch(function (err) {
      setSettingsStatus((err && err.message) || 'Could not save settings.', true);
      showAlert((err && err.message) || 'Could not save settings.', true);
    }).finally(function () {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('is-saving');
      }
      if (resetBtn) resetBtn.disabled = false;
    });
  }

  function reset() {
    priority = savedSnapshot.priority.slice();
    commentaryPromptText = commentarySavedText;
    var commentaryTextarea = el('commentaryPromptText');
    if (commentaryTextarea) commentaryTextarea.value = commentarySavedText;
    courseLookupPromptText = courseLookupSavedText;
    var courseLookupTextarea = el('courseLookupPromptText');
    if (courseLookupTextarea) courseLookupTextarea.value = courseLookupSavedText;
    renderAvailable();
    renderPriority();
    setSettingsStatus('Reverted to the last saved settings.');
  }

  function applyCourseLookupSettings(value, defaultText) {
    courseLookupDefaultText = String(defaultText || '').trim();
    if (!courseLookupDefaultText && window.CourseLookupPrompt) {
      courseLookupDefaultText = window.CourseLookupPrompt.DEFAULT_GUIDANCE;
    }
    var saved = String((value && value.text) || '').trim();
    courseLookupPromptText = saved || courseLookupDefaultText;
    courseLookupSavedText = courseLookupPromptText;
    var textarea = el('courseLookupPromptText');
    if (textarea) textarea.value = courseLookupPromptText;
  }

  function loadCourseLookupSettings() {
    var api = getApi();
    if (!api) return Promise.reject(new Error('API client not available.'));
    return api.get({ action: 'getAppSettings', key: 'course_lookup_prompt' }).then(function (res) {
      applyCourseLookupSettings(res && res.value, res && res.defaultText);
      return res;
    });
  }

  function applyCommentarySettings(value, defaultText) {
    commentaryDefaultText = String(defaultText || '').trim();
    var saved = String((value && value.text) || '').trim();
    commentaryPromptText = saved || commentaryDefaultText;
    commentarySavedText = commentaryPromptText;
    var textarea = el('commentaryPromptText');
    if (textarea) textarea.value = commentaryPromptText;
  }

  function loadCommentarySettings() {
    var api = getApi();
    if (!api) return Promise.reject(new Error('API client not available.'));
    return api.get({ action: 'getAppSettings', key: 'commentary_ai_prompt' }).then(function (res) {
      applyCommentarySettings(res && res.value, res && res.defaultText);
      return res;
    });
  }

  function refresh() {
    var btn = el('refreshModelsBtn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-loading');
    }
    setAvailableStatus('Refreshing model list…');
    loadModels(true).then(function () {
      refreshAvailableOrder();
      renderAvailable();
      renderPriority();
      setAvailableStatus('Model list refreshed (' + availableModels.length + ' models).');
    }).catch(function (err) {
      setAvailableStatus((err && err.message) || 'Could not load models.', true);
    }).finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  }

  function closeAllSections() {
    var toggles = document.querySelectorAll('.settings-group__toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-expanded', 'false');
      var body = el(toggles[i].getAttribute('aria-controls'));
      if (body) body.hidden = true;
    }
  }

  function openSection(toggle) {
    toggle.setAttribute('aria-expanded', 'true');
    var bodyId = toggle.getAttribute('aria-controls');
    var body = el(bodyId);
    if (body) body.hidden = false;

    /* Re-sort on open only, so ticking a model never makes rows jump while the section is in use. */
    if (bodyId === 'availableModelsBody') {
      refreshAvailableOrder();
      renderAvailable();
    } else if (bodyId === 'modelOrderBody') {
      renderPriority();
    }
  }

  /** Accordion: opening a section collapses any other. Works for future sections unchanged. */
  function bindAccordion() {
    var toggles = document.querySelectorAll('.settings-group__toggle');
    Array.prototype.forEach.call(toggles, function (toggle) {
      toggle.addEventListener('click', function () {
        var wasOpen = toggle.getAttribute('aria-expanded') === 'true';
        closeAllSections();
        if (!wasOpen) openSection(toggle);
      });
    });
  }

  function bindEvents() {
    bindAccordion();
    var saveBtn = el('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', save);
    var resetBtn = el('resetSettingsBtn');
    if (resetBtn) resetBtn.addEventListener('click', reset);
    var refreshBtn = el('refreshModelsBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);
    var commentaryTextarea = el('commentaryPromptText');
    if (commentaryTextarea) {
      commentaryTextarea.addEventListener('input', function () {
        setSettingsStatus('Unsaved changes.');
      });
    }
    var courseLookupTextarea = el('courseLookupPromptText');
    if (courseLookupTextarea) {
      courseLookupTextarea.addEventListener('input', function () {
        setSettingsStatus('Unsaved changes.');
      });
    }
  }

  function initAiModelsGroup() {
    setAvailableStatus('Loading…');
    /* Settings first so the saved priority is known before the list is ordered selected-first. */
    loadSettings()
      .catch(function (err) {
        showAlert('Could not load saved settings: ' + ((err && err.message) || 'unknown error'), true);
      })
      .then(function () {
        return loadModels(false);
      })
      .then(function () {
        refreshAvailableOrder();
        renderAvailable();
        renderPriority();
        setAvailableStatus(availableModels.length + ' models available for your API key.');
      })
      .catch(function (err) {
        renderPriority();
        var list = el('availableModelsList');
        if (list) {
          list.innerHTML = '<li class="model-list__item"><span class="model-list__label">' +
            '<span class="model-list__meta">Could not load models.</span></span></li>';
        }
        setAvailableStatus((err && err.message) || 'Could not load models.', true);
      });
  }

  function initCourseLookupPromptGroup() {
    return loadCourseLookupSettings().catch(function (err) {
      showAlert('Could not load course lookup prompt: ' + ((err && err.message) || 'unknown error'), true);
      throw err;
    });
  }

  function initCommentaryPromptGroup() {
    return loadCommentarySettings().catch(function (err) {
      showAlert('Could not load commentary prompt: ' + ((err && err.message) || 'unknown error'), true);
      throw err;
    });
  }

  function init() {
    bindEvents();
    var boot = function () {
      initAiModelsGroup();
      initCourseLookupPromptGroup();
      initCommentaryPromptGroup();
    };
    if (typeof AppConfig !== 'undefined' && AppConfig.init) {
      AppConfig.init().then(boot).catch(boot);
    } else {
      boot();
    }
  }

  window.AdminSettingsPage = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
