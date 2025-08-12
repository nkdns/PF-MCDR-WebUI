// 轻量级前端 i18n 管理器
(function () {
  const DEFAULT_LANG = localStorage.getItem('lang') || (navigator.language || 'zh-CN');
  const SUPPORTED = ['zh-CN', 'en-US'];
  const NORMALIZED = DEFAULT_LANG.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';

  const state = {
    lang: SUPPORTED.includes(DEFAULT_LANG) ? DEFAULT_LANG : NORMALIZED,
    dict: {},
  };

  async function loadLang(lang) {
    try {
      const resp = await fetch(`lang/${lang}.json`, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('lang load failed');
      state.dict = await resp.json();
      state.lang = lang;
      localStorage.setItem('lang', lang);
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
        let needApply = false;
        for (const m of mutations) {
          if (m.type === 'childList' && (m.addedNodes && m.addedNodes.length > 0)) {
            needApply = true;
            break;
          }
        }
        if (needApply) scheduleApply(document);
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
        const resp = await fetch('/api/langs', { cache: 'no-cache' });
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

  // 暴露到全局
  window.I18n = { loadLang, t, applyTranslations, get lang() { return state.lang; } };

  // 初始化
  document.addEventListener('DOMContentLoaded', () => {
    loadLang(state.lang).then(() => {
      mountSwitcher();
      applyTranslations();
      ensureObserver();
    });
  });
})();


