/* ============================================================
   @szyyw/design · chrome.js
   一站式工具位（v0.13.0，新项目首选）：一个调用挂齐右上角整条——
     应用切换器(5) · 账户菜单(6) · 🌗(10) · 语言(15) · 外观(20) + 点阵背景 / 光斑 + 外观持久化。
   等价于 mountAppearance +（SSO 站点）mountAppSwitcher + mountAccountMenu +（给了语言列表）mountLocaleToggle，
   全部同一个 locale；setLocale 一次同步所有子件，背景画布不重建。

   非 SSO 应用传 portal: null（或 false），只挂外观与语言。
   ============================================================ */

import { mountAppearance } from "./appearance.js";
import { mountAppSwitcher } from "./switcher.js";
import { mountAccountMenu } from "./account.js";
import { mountLocaleToggle } from "./locale-toggle.js";
import { mountTechText } from "./techtext.js";

const DEFAULT_PORTAL = "https://szyyw.xyz";
const DEFAULT_TECH_TEXT = ".app-title, .wordmark";

/**
 * 增强当前与之后出现的匹配元素（v0.18.0）：React 等框架在 mountChrome 之后才渲染 / 重渲染标题时也生效；
 * 元素脱离文档就销毁它的 handle，不泄漏。onChange 收到当前 handle 数组。返回停止函数（断开观察并销毁全部）。
 */
function watchTechText(selector, opts, onChange) {
  const live = new Map(); // element → handle
  const publish = () => onChange(Array.from(live.values()));
  const scan = () => {
    let changed = false;
    for (const [el, h] of live) {
      if (!el.isConnected) {
        h.destroy();
        live.delete(el);
        changed = true;
      }
    }
    for (const el of document.querySelectorAll(selector)) {
      if (live.has(el)) continue;
      live.set(el, mountTechText(el, opts));
      changed = true;
    }
    if (changed) publish();
  };
  scan();
  publish();
  // 只看节点增删（不看属性 / 文字：TechText 自己会改元素样式与插画布，看了会自激）；同一帧内的多次变动合并成一次扫描
  let queued = false;
  const observer = typeof MutationObserver === "function" && document.body
    ? new MutationObserver((records) => {
        if (queued) return;
        // 只有 TechText 自己插拔的画布不必重扫
        const relevant = records.some((r) =>
          [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeType === 1 && !n.classList?.contains("tech-text-canvas"))
        );
        if (!relevant) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          scan();
        });
      })
    : null;
  observer?.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    for (const h of live.values()) h.destroy();
    live.clear();
    publish();
  };
}

/**
 * @param {object}  options
 * @param {HTMLElement|null} options.background  点阵背景容器（通常 .bg-layer）；不给就没有背景
 * @param {string}  options.cookiePrefix  外观三项存储键前缀（同 mountAppearance）
 * @param {"cookie"|"localStorage"|"none"} options.persist  外观持久化，缺省 cookie
 * @param {string}  options.locale        "zh" | "ja" | "en"，缺省 "zh"
 * @param {string|null|false} options.portal  门户地址；缺省 https://szyyw.xyz；null / false = 非 SSO，不挂切换器与账户菜单
 * @param {object}  options.appearance    透传给 mountAppearance 的其余选项（labels / onChange / dotField / spot）
 * @param {object|false} options.switcher 透传给 mountAppSwitcher（labels / order / current / …）；false = 不挂
 * @param {object|false} options.account  透传给 mountAccountMenu（labels / order / onChange）；false = 不挂
 * @param {object}  options.localeToggle  { locales, onChange?, order?, labels? }；给了 locales 才挂语言切换
 * @param {boolean|string|object} options.techText  标题的 TechText 字标。v0.18.0 起缺省开启（选择器 ".app-title, .wordmark"），
 *        并跟进之后才插入 / 移除的匹配元素；false = 不开；字符串 = 选择器；对象 = { selector?, ...TechText 选项 }
 */
export function mountChrome({
  background = null,
  cookiePrefix = "",
  persist = "cookie",
  locale = "zh",
  portal = DEFAULT_PORTAL,
  appearance: appearanceOpts = {},
  switcher: switcherOpts = {},
  account: accountOpts = {},
  localeToggle: localeOpts = null,
  techText: techTextOpts = true
} = {}) {
  let current = locale;

  const appearance = mountAppearance({
    ...(appearanceOpts || {}),
    background,
    persist,
    cookiePrefix,
    locale
  });

  const sso = !!portal;
  const switcher = sso && switcherOpts !== false ? mountAppSwitcher({ ...(switcherOpts || {}), portal, locale }) : null;
  const account = sso && accountOpts !== false ? mountAccountMenu({ ...(accountOpts || {}), portal, locale }) : null;

  let localeToggle = null;
  let stopTechText = null;
  const handle = {
    appearance,
    switcher,
    account,
    localeToggle: null,
    techText: [],
    get locale() {
      return current;
    },
    /** 同步所有子件的文案；画布不重建。工具位语言按钮选中时会自动调它，再调 localeToggle.onChange */
    setLocale(next) {
      if (!next) return;
      current = next;
      appearance.setLocale(next);
      switcher?.setLocale(next);
      account?.setLocale(next);
      localeToggle?.set(next);
    },
    destroy() {
      stopTechText?.();
      stopTechText = null;
      localeToggle?.destroy();
      account?.destroy();
      switcher?.destroy();
      appearance.destroy();
    }
  };

  if (localeOpts && Array.isArray(localeOpts.locales) && localeOpts.locales.length) {
    const { onChange, ...rest } = localeOpts;
    localeToggle = mountLocaleToggle({
      ...rest,
      current: locale,
      onChange: (next) => {
        handle.setLocale(next);
        onChange?.(next);
      }
    });
    handle.localeToggle = localeToggle;
  }

  if (techTextOpts) {
    let selector = DEFAULT_TECH_TEXT;
    let opts = {};
    if (typeof techTextOpts === "string") selector = techTextOpts;
    else if (typeof techTextOpts === "object") ({ selector = DEFAULT_TECH_TEXT, ...opts } = techTextOpts);
    stopTechText = watchTechText(selector, opts, (list) => {
      handle.techText = list;
    });
  }

  return handle;
}
