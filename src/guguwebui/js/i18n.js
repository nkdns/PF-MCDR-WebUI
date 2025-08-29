// 轻量级前端 i18n 管理器
(function () {
  const DEFAULT_LANG = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
  const SUPPORTED = ['zh-CN', 'en-US'];
  const NORMALIZED = DEFAULT_LANG.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';

  const state = {
    lang: SUPPORTED.includes(DEFAULT_LANG) ? DEFAULT_LANG : NORMALIZED,
    dict: {},
  };

  // 本地缓存（24小时）
  const CACHE_PREFIX = 'i18n_cache_';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  function getCacheKey(lang) {
    return `${CACHE_PREFIX}${lang}`;
  }

  function readCachedDict(lang) {
    try {
      const raw = localStorage.getItem(getCacheKey(lang));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.ts !== 'number' || obj.dict == null) return null;
      if (Date.now() - obj.ts > CACHE_TTL_MS) return null; // 过期
      return obj.dict;
    } catch (_) {
      return null;
    }
  }

  function writeCachedDict(lang, dict) {
    try {
      localStorage.setItem(
        getCacheKey(lang),
        JSON.stringify({ ts: Date.now(), dict })
      );
    } catch (_) {
      // 忽略容量/隐私模式错误
    }
  }

  // 仅获取字典，不改变全局状态（供其它模块复用）
  async function fetchLangDict(lang) {
    const cached = readCachedDict(lang);
    if (cached) return cached;
    const resp = await fetch(`lang/${lang}.json`, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('lang load failed');
    const dict = await resp.json();
    writeCachedDict(lang, dict);
    return dict;
  }

  async function loadLang(lang) {
    // 先尝试读取缓存，命中直接使用，避免频繁请求
    const cached = readCachedDict(lang);
    if (cached) {
      state.dict = cached;
      state.lang = lang;
      localStorage.setItem('lang', lang);
      applyTranslations();
      document.documentElement.setAttribute('lang', lang);
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
      return;
    }

    // 缓存未命中或过期，走网络请求并写回缓存
    try {
      const resp = await fetch(`lang/${lang}.json`, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('lang load failed');
      const dict = await resp.json();
      state.dict = dict;
      state.lang = lang;
      localStorage.setItem('lang', lang);
      writeCachedDict(lang, dict);
      applyTranslations();
      document.documentElement.setAttribute('lang', lang);
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
    } catch (e) {
      console.warn('[i18n] load error:', e);
    }
  }

  function t(key, fallback) {
    const val = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), state.dict);
    return val != null ? String(val) : fallback != null ? String(fallback) : key;
  }

  function applyTranslations(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr');
      const txt = t(key, el.textContent.trim());
      if (attr) {
        el.setAttribute(attr, txt);
      } else {
        el.textContent = txt;
      }
    });

    // Support placeholder translation via data-i18n-placeholder
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const fallback = el.getAttribute('placeholder') || '';
      const txt = t(key, fallback);
      el.setAttribute('placeholder', txt);
    });
  }

  // 简单的节流器，避免频繁重复翻译
  let pendingApply = null;
  function scheduleApply(root) {
    if (pendingApply) cancelAnimationFrame(pendingApply);
    pendingApply = requestAnimationFrame(() => {
      applyTranslations(root || document);
      pendingApply = null;
    });
  }

  // 观测 DOM 变化，自动对新增节点应用翻译
  let observer = null;
  function ensureObserver() {
    if (observer) return;
    try {
      observer = new MutationObserver((mutations) => {
        const rootsToApply = new Set();
        for (const m of mutations) {
          if (m.type !== 'childList' || !m.addedNodes || m.addedNodes.length === 0) continue;
          m.addedNodes.forEach((node) => {
            if (!node || node.nodeType !== 1) return; // 仅元素节点
            const el = node;
            // 频繁变动区域（如聊天消息容器）若无 i18n 标记则忽略
            const inChatStream = !!el.closest && !!el.closest('.chat-messages-container');
            const hasI18nHere = el.matches && (el.matches('[data-i18n], [data-i18n-placeholder]'));
            const hasI18nInside = el.querySelector && el.querySelector('[data-i18n], [data-i18n-placeholder]');
            if (inChatStream && !hasI18nHere && !hasI18nInside) return;
            if (hasI18nHere || hasI18nInside) {
              // 以更接近变动处的根节点为应用范围，减少整页扫描
              rootsToApply.add(el);
            }
          });
        }
        if (rootsToApply.size > 0) {
          rootsToApply.forEach((root) => scheduleApply(root));
        }
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: false,
      });
    } catch (e) {
      // ignore
    }
  }

  function createLangSwitcherDropdown() {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';

    const btn = document.createElement('button');
    btn.className = 'inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none transition-colors';
    btn.setAttribute('title', 'Language');
    btn.setAttribute('data-i18n-attr', 'title');
    btn.setAttribute('data-i18n', 'nav.lang');
    btn.innerHTML = '<i class="fas fa-globe"></i>';

    const menu = document.createElement('div');
    menu.className = 'absolute right-0 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 hidden z-50';

    // 悬停显示
    wrapper.addEventListener('mouseenter', () => menu.classList.remove('hidden'));
    wrapper.addEventListener('mouseleave', () => menu.classList.add('hidden'));

    async function populate() {
      try {
        const resp = await fetch('api/langs', { cache: 'no-cache' });
        const list = resp.ok ? await resp.json() : [];
        menu.innerHTML = '';
        list.forEach(({ code, name }) => {
          const item = document.createElement('button');
          item.className = 'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-between';
          item.innerHTML = `<span>${name}</span>${state.lang === code ? '<i class="fas fa-check text-blue-500"></i>' : ''}`;
          item.addEventListener('click', () => loadLang(code));
          menu.appendChild(item);
        });
      } catch (e) {
        // 回退：使用内置支持
        menu.innerHTML = '';
        SUPPORTED.forEach((code) => {
          const name = code === 'zh-CN' ? '中文' : code === 'en-US' ? 'English' : code;
          const item = document.createElement('button');
          item.className = 'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-between';
          item.innerHTML = `<span>${name}</span>${state.lang === code ? '<i class="fas fa-check text-blue-500"></i>' : ''}`;
          item.addEventListener('click', () => loadLang(code));
          menu.appendChild(item);
        });
      }
    }

    // 初次与语言变化时刷新
    populate();
    document.addEventListener('i18n:changed', populate);

    wrapper.appendChild(btn);
    wrapper.appendChild(menu);
    return wrapper;
  }

  function mountSwitcher() {
    const containers = document.querySelectorAll('#header .flex.items-center.space-x-4');
    if (containers.length > 0) {
      containers.forEach((container) => {
        const themeBtn = container.querySelector('button i.fas.fa-sun, button i.fas.fa-moon');
        if (themeBtn) {
          const parentBtn = themeBtn.closest('button');
          const dropdown = createLangSwitcherDropdown();
          parentBtn && parentBtn.insertAdjacentElement('afterend', dropdown);
        } else {
          container.appendChild(createLangSwitcherDropdown());
        }
      });
      return;
    }

    // 没有顶栏时（如登录页），尝试定位任意主题按钮并插到其后
    const anyThemeIcon = document.querySelector('i.fa-sun, i.fa-moon, i.fas.fa-sun, i.fas.fa-moon');
    if (anyThemeIcon) {
      const themeBtn = anyThemeIcon.closest('button');
      if (themeBtn) {
        themeBtn.insertAdjacentElement('afterend', createLangSwitcherDropdown());
        return;
      }
    }

    // 最后回退：把语言按钮插入到 body 尾部
    document.body.appendChild(createLangSwitcherDropdown());
  }

  // 检查是否还有未翻译的元素
  function checkUntranslatedElements() {
    const untranslatedElements = document.querySelectorAll('[data-i18n]:not([data-i18n-translated]), [data-i18n-placeholder]:not([data-i18n-translated])');
    return untranslatedElements.length > 0;
  }

  // 智能翻译应用函数
  function smartApplyTranslations(maxAttempts = 5, interval = 500) {
    let attempts = 0;

    function attemptTranslation() {
      attempts++;
      applyTranslations();

      // 检查是否还有未翻译的元素
      if (checkUntranslatedElements() && attempts < maxAttempts) {
        console.log(`[i18n] 发现未翻译元素，${interval}ms后进行第${attempts + 1}次尝试`);
        setTimeout(attemptTranslation, interval);
      } else if (attempts >= maxAttempts) {
        console.warn(`[i18n] 已达到最大尝试次数(${maxAttempts})，仍存在未翻译元素`);
      } else {
        console.log(`[i18n] 翻译完成，共尝试${attempts}次`);
      }
    }

    attemptTranslation();
  }

  // 暴露到全局
  window.I18n = { loadLang, t, applyTranslations, fetchLangDict, get lang() { return state.lang; } };

  // 初始化
  document.addEventListener('DOMContentLoaded', () => {
    loadLang(state.lang).then(() => {
      mountSwitcher();
      applyTranslations();

      // 智能延迟执行，确保 Alpine.js 等框架渲染完成后再应用翻译
      setTimeout(() => {
        smartApplyTranslations();
      }, 200);

      ensureObserver();
    });
  });
})();


