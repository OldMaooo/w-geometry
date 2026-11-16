/* 应用内副本（来源：Product Library/todo-tree）：UMD 外壳改成 ES 模块默认导出（生产构建里 UMD 会被当 CommonJS）。 */
/*
 * todo-tree —— 可缩进、可折叠、可拖拽的待办清单（无依赖，单文件）
 *
 * 用法（浏览器里直接 <script src>，全局变量 TodoTree；Node 里 require 得到同一份 API）：
 *   var tt = TodoTree.mount(document.getElementById('box'), {
 *     store: TodoTree.stores.httpJson({ url: '/api/state', key: 'todo:main' }),
 *     seed: [[0,'第一件事',0,0],[1,'子任务',0,0]],     // [层级, 文字, 已完成, 收起]；只在存储里还没有数据时写入一次
 *     onChange: function (info) { badge.textContent = info.left },   // info: {left, total, status}
 *   })
 * 侧边抽屉版：var d = TodoTree.mountDrawer({ title:'待办', store:…, seed:… }); button.onclick = d.toggle
 * 锚定浮层版（贴在吸顶工具条下面、可拖高度）：TodoTree.mountPanel({ anchor:工具条元素, align:内容区元素, store:…, seed:… })
 *
 * 数据只放进「store」（本地文件服务 / Firestore / 你自己写的数据库适配器）。
 * 本组件**不碰 localStorage**：浏览器存储按网址隔离、清缓存就没，已经丢过一次真实数据（见 PITFALLS）。
 */
var TodoTree = (function () {
  'use strict'

  /* ───────────────────────── 纯数据：条目模型 ─────────────────────────
   * 条目 = { id, lv, t, d, c }：层级(0 起)、文字、已完成、是否收起。
   * 存成一维数组，上级 = 它前面最近的、层级更小的那一条（所以搬动一块 = 搬一段连续数组）。 */
  var model = {
    uid: function () { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) },
    idx: function (items, id) {
      for (var i = 0; i < items.length; i++) if (items[i].id === id) return i
      return -1
    },
    kids: function (items, i) {
      var n = 0
      for (var j = i + 1; j < items.length && items[j].lv > items[i].lv; j++) n++
      return n
    },
    endOf: function (items, i) {
      var j = i + 1
      while (j < items.length && items[j].lv > items[i].lv) j++
      return j
    },
    /** 有子项的上级：子项全部完成才算完成。 */
    sync: function (items) {
      for (var i = items.length - 1; i >= 0; i--) {
        var n = model.kids(items, i)
        if (!n) continue
        var all = true
        for (var j = i + 1; j < i + 1 + n; j++) if (!items[j].d) { all = false; break }
        items[i].d = all
      }
    },
    /** 勾选/取消：连同所有子孙一起。 */
    setDone: function (items, id, v) {
      var i = model.idx(items, id)
      if (i < 0) return
      var e = model.endOf(items, i)
      for (var j = i; j < e; j++) items[j].d = !!v
      model.sync(items)
    },
    /** dir=+1 缩进成上一条的子项；dir=-1 退回上一级。返回是否真的变了。 */
    indent: function (items, id, dir) {
      var i = model.idx(items, id)
      if (i < 0) return false
      var e = model.endOf(items, i), prev = i > 0 ? items[i - 1] : null, j
      if (dir > 0) {
        if (!prev || items[i].lv > prev.lv) return false
        for (j = i; j < e; j++) items[j].lv++
      } else {
        if (items[i].lv === 0) return false
        for (j = i; j < e; j++) items[j].lv--
      }
      return true
    },
    /** 能不能把 srcId 放到 tgtId 上：不能拖进自己的子孙里。 */
    canDrop: function (items, srcId, tgtId) {
      var i = model.idx(items, srcId), t = model.idx(items, tgtId)
      if (i < 0 || t < 0) return false
      return !(t >= i && t < model.endOf(items, i))
    },
    /** zone: 'before'｜'after'｜'child'。带着整块子项一起走。返回是否移动了。 */
    move: function (items, srcId, tgtId, zone) {
      if (!model.canDrop(items, srcId, tgtId)) return false
      var i = model.idx(items, srcId), e = model.endOf(items, i)
      var block = items.splice(i, e - i)
      var t = model.idx(items, tgtId), target = items[t], pos, lv
      if (zone === 'before') { pos = t; lv = target.lv }
      else if (zone === 'after') { pos = model.endOf(items, t); lv = target.lv }
      else { pos = model.endOf(items, t); lv = target.lv + 1; target.c = false }
      var delta = lv - block[0].lv
      block.forEach(function (b) { b.lv = Math.max(0, b.lv + delta) })
      Array.prototype.splice.apply(items, [pos, 0].concat(block))
      return true
    },
    /** 在 id 这一块（含子项）后面加一条同级。id 为空 = 加在最后、顶层。 */
    addAfter: function (items, id, text) {
      var it = { id: model.uid(), lv: 0, t: text, d: false, c: false }
      if (id == null) { items.push(it); return it }
      var i = model.idx(items, id)
      it.lv = items[i].lv
      items.splice(model.endOf(items, i), 0, it)
      return it
    },
    /** 删掉这一条和它的全部子项，返回删了几条。 */
    remove: function (items, id) {
      var i = model.idx(items, id)
      if (i < 0) return 0
      var e = model.endOf(items, i)
      items.splice(i, e - i)
      return e - i
    },
    setAllCollapsed: function (items, v) {
      items.forEach(function (x, i) { x.c = v ? model.kids(items, i) > 0 : false })
    },
    /** 还没做完的「叶子」条数（有子项的上级不重复算）。 */
    leftCount: function (items) {
      var n = 0
      items.forEach(function (x, i) { if (!x.d && !model.kids(items, i)) n++ })
      return n
    },
    fromSeed: function (seed) {
      return model.normalize((seed || []).map(function (s) {
        return { id: model.uid(), lv: s[0] | 0, t: String(s[1]), d: !!s[2], c: !!s[3] }
      }))
    },
    /** 清洗外部来的数据：补字段、层级不许一次跳两级、第一条必须顶层、id 不重复。 */
    normalize: function (raw) {
      var seen = {}, out = [], prev = -1
      ;(Array.isArray(raw) ? raw : []).forEach(function (x) {
        if (!x || typeof x !== 'object') return
        var id = typeof x.id === 'string' && x.id && !seen[x.id] ? x.id : model.uid()
        seen[id] = 1
        var lv = Math.max(0, x.lv | 0)
        if (lv > prev + 1) lv = prev + 1
        prev = lv
        out.push({ id: id, lv: lv, t: String(x.t == null ? '' : x.t), d: !!x.d, c: !!x.c })
      })
      model.sync(out)
      return out
    },
  }

  /* ───────────────────────── 存储适配器 ─────────────────────────
   * 适配器 = { kind, load(): Promise<数组|null>, save(items): Promise }。
   * load 返回 null 表示「存储里还没有这份数据」（这时才会写入 seed）；读取失败必须 reject，
   * 绝不能返回 null——否则会把一次网络抖动当成「空」而拿 seed 覆盖真数据。 */
  function withTimeout(fetchImpl, url, opts, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
    var timer = ctl ? setTimeout(function () { ctl.abort() }, ms) : null
    if (ctl) opts.signal = ctl.signal
    return fetchImpl(url, opts).then(
      function (r) { if (timer) clearTimeout(timer); return r },
      function (e) { if (timer) clearTimeout(timer); throw e }
    )
  }
  function parseItems(v) {
    if (v == null) return null
    if (typeof v === 'string') v = JSON.parse(v)
    return Array.isArray(v) ? v : null
  }
  var stores = {
    /** 本地 JSON 文件服务（见 server/state_server.py）：GET url → 对象；PUT url {key: 值} → 只合并这个键。 */
    httpJson: function (o) {
      var f = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(null) : null), ms = o.timeoutMs || 8000
      return {
        kind: 'file',
        label: o.label || '本地文件',
        load: function () {
          return withTimeout(f, o.url, { cache: 'no-store' }, ms).then(function (r) {
            if (!r.ok) throw new Error('读取失败 HTTP ' + r.status)
            return r.json()
          }).then(function (obj) { return parseItems(obj && obj[o.key]) })
        },
        save: function (items) {
          var body = {}
          body[o.key] = o.asString ? JSON.stringify(items) : items
          return withTimeout(f, o.url, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          }, ms).then(function (r) { if (!r.ok) throw new Error('保存失败 HTTP ' + r.status) })
        },
      }
    },
    /**
     * Firestore REST（不用 SDK，原因见 cloud-sync/PITFALLS：SDK 长连接在 VPN 下会静默卡死）。
     * 文档路径：{collection}/{code}__{board}，字段 payload(JSON 字符串)、updatedAt。
     * ⚠ 尚未在真实 Firebase 项目上跑过，只有 fake fetch 的单测；接入时请先照 README 的「验证清单」走一遍。
     */
    firestore: function (o) {
      var f = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(null) : null), ms = o.timeoutMs || 15000
      var col = o.collection || 'todo'
      var doc = encodeURIComponent(o.code + '__' + (o.board || 'default'))
      var base = 'https://firestore.googleapis.com/v1/projects/' + o.projectId + '/databases/(default)/documents/' + col + '/' + doc
      return {
        kind: 'cloud',
        label: '云端（Firestore）',
        load: function () {
          return withTimeout(f, base + '?key=' + encodeURIComponent(o.apiKey), { cache: 'no-store' }, ms).then(function (r) {
            if (r.status === 404) return null
            if (!r.ok) throw new Error('读取失败 HTTP ' + r.status)
            return r.json().then(function (d) {
              var p = d && d.fields && d.fields.payload && d.fields.payload.stringValue
              return p ? parseItems(p) : null
            })
          })
        },
        save: function (items) {
          var url = base + '?updateMask.fieldPaths=payload&updateMask.fieldPaths=updatedAt&key=' + encodeURIComponent(o.apiKey)
          var body = { fields: { payload: { stringValue: JSON.stringify(items) }, updatedAt: { integerValue: String(Date.now()) } } }
          return withTimeout(f, url, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          }, ms).then(function (r) { if (!r.ok) throw new Error('保存失败 HTTP ' + r.status) })
        },
      }
    },
    /** 只存在内存里（演示、测试用）。刷新就没，所以 mount 会显示醒目的提示。 */
    memory: function (initial) {
      var data = initial ? JSON.parse(JSON.stringify(initial)) : null
      return {
        kind: 'memory', label: '仅内存',
        load: function () { return Promise.resolve(data ? JSON.parse(JSON.stringify(data)) : null) },
        save: function (items) { data = JSON.parse(JSON.stringify(items)); return Promise.resolve() },
      }
    },
  }

  /* ───────────────────────── 界面 ─────────────────────────
   * 遵守公共设计规则 core/rules/design-global.md：UX-2（功能图标用 lucide，内联 SVG）、UX-3（编辑不改行高）、
   * UX-5（可点处都有 hover）、UX-13（行上只留箭头/勾选/文字，拖动柄和删除悬停才出现，缩进走键盘，选中整行变灰）、
   * UX-14（侧边抽屉不加蒙层，状态栏固定在最底，× 和 Esc 关闭）。 */
  var ICON_PATHS = {
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    expandAll: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    collapseAll: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
    todo: '<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  }
  function icon(name, size) {
    var s = size || 16
    return '<svg class="tt-ic" xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>'
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] })
  }
  function hhmm() { var t = new Date(); return ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) }

  function mount(rootEl, opts) {
    if (!opts || !opts.store) throw new Error('TodoTree.mount 需要 store（数据只能放进存储适配器，不用浏览器缓存）')
    var store = opts.store, items = [], loaded = false, dirty = false, dragId = null, focusId = null
    var status = { state: 'loading' }, saveTimer = null, saving = false, destroyed = false, armedId = null, armedTimer = null
    var plain = 'plaintext-only'
    try { var pr = document.createElement('div'); pr.contentEditable = plain; if (pr.contentEditable !== plain) plain = 'true' } catch (e) { plain = 'true' }

    rootEl.classList.add('tt')
    rootEl.innerHTML =
      '<div class="tt-bar"><form class="tt-form"><input class="tt-new" type="text" placeholder="' + esc(opts.placeholder || '添加待办') + '" autocomplete="off" aria-label="新待办"></form>' +
      '<button type="button" class="tt-ibtn tt-expand" title="全部展开" aria-label="全部展开">' + icon('expandAll') + '</button>' +
      '<button type="button" class="tt-ibtn tt-collapse" title="全部收起" aria-label="全部收起">' + icon('collapseAll') + '</button></div>' +
      '<ul class="tt-list"></ul><div class="tt-status" role="status"></div>'
    var list = rootEl.querySelector('.tt-list'), input = rootEl.querySelector('.tt-new'), statusEl = rootEl.querySelector('.tt-status')

    function setStatus(state, text, detail, retry) {
      status = { state: state, text: text }
      statusEl.className = 'tt-status tt-' + state
      statusEl.innerHTML = ''
      var s = document.createElement('span'); s.textContent = text; if (detail) s.title = detail
      statusEl.appendChild(s)
      if (retry) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'tt-btn'; b.textContent = '重试'
        b.onclick = retry; statusEl.appendChild(b)
      }
      emit()
    }
    function emit() {
      if (opts.onChange) opts.onChange({ left: model.leftCount(items), total: items.length, status: status.state, items: items })
    }
    function schedule() {
      dirty = true
      clearTimeout(saveTimer)
      setStatus('dirty', '正在保存…')
      saveTimer = setTimeout(flush, opts.debounceMs == null ? 250 : opts.debounceMs)
    }
    function flush() {
      clearTimeout(saveTimer)
      if (!loaded) return Promise.resolve()
      if (saving) { saveTimer = setTimeout(flush, 200); return Promise.resolve() }
      saving = true
      var snapshot = JSON.parse(JSON.stringify(items))
      return store.save(snapshot).then(function () {
        saving = false
        if (JSON.stringify(items) === JSON.stringify(snapshot)) {
          dirty = false
          setStatus('saved', '已保存 · ' + hhmm(), store.label || '')
        } else { schedule() }
      }, function (err) {
        saving = false
        setStatus('error', '保存失败，改动还没存上', String(err && err.message || err), flush)
      })
    }
    function change() { model.sync(items); schedule(); render() }

    function render() {
      list.innerHTML = ''
      if (!loaded) return
      if (!items.length) { var e = document.createElement('li'); e.className = 'tt-empty'; e.textContent = '还没有待办'; list.appendChild(e) }
      var hideBelow = -1, first = true
      items.forEach(function (x, i) {
        if (hideBelow >= 0) { if (x.lv > hideBelow) return; hideBelow = -1 }
        var n = model.kids(items, i), li = document.createElement('li')
        li.className = 'tt-item' + (x.d ? ' tt-done' : '') + (x.lv === 0 ? ' tt-top' : '') + (first ? ' tt-first' : '')
        first = false
        li.style.paddingLeft = (18 + x.lv * 20) + 'px'
        var doneN = 0
        for (var j = i + 1; j < i + 1 + n; j++) if (items[j].d) doneN++
        li.innerHTML =
          '<span class="tt-gp" draggable="true" title="拖动调整顺序和层级（Tab 缩进，Shift+Tab 退回）" aria-hidden="true">' + icon('grip', 14) + '</span>' +
          (n ? '<button class="tt-tg" type="button" aria-label="' + (x.c ? '展开' : '收起') + '">' + icon(x.c ? 'right' : 'down', 14) + '</button>'
             : '<span class="tt-tg tt-sp" aria-hidden="true"></span>') +
          '<input type="checkbox" aria-label="完成"' + (x.d ? ' checked' : '') + '>' +
          '<span class="tt-tx" contenteditable="' + plain + '" spellcheck="false">' + esc(x.t) + '</span>' +
          (n ? '<span class="tt-cn">' + doneN + '/' + n + '</span>' : '') +
          '<button class="tt-del" type="button" aria-label="删除" title="删除' + (n ? '（含 ' + n + ' 条子项）' : '') + '">' + icon('x', 14) + '</button>'
        var tx = li.querySelector('.tt-tx')
        if (n) li.querySelector('.tt-tg').onclick = function () { x.c = !x.c; schedule(); render() }
        li.querySelector('input').onchange = function () { model.setDone(items, x.id, this.checked); change() }
        tx.onblur = function () {
          var v = tx.textContent.trim()
          if (!v) { tx.textContent = x.t; return }
          if (v !== x.t) { x.t = v; schedule(); emit() }
        }
        tx.onkeydown = function (e) {
          if (e.key === 'Enter') { e.preventDefault(); tx.blur(); focusId = model.addAfter(items, x.id, '新待办').id; change() }
          else if (e.key === 'Tab') { e.preventDefault(); tx.blur(); if (model.indent(items, x.id, e.shiftKey ? -1 : 1)) { focusId = x.id; change() } }
        }
        var del = li.querySelector('.tt-del')
        del.onclick = function () {
          var k = model.kids(items, model.idx(items, x.id))
          if (k && armedId !== x.id) {          // 带子项的，先点一次「待确认」，再点才删（不用 confirm()，内置浏览器不支持）
            armedId = x.id; clearTimeout(armedTimer); armedTimer = setTimeout(function () { armedId = null; render() }, 3000)
            render(); return
          }
          armedId = null; model.remove(items, x.id); change()
        }
        if (armedId === x.id) { li.classList.add('tt-armed'); del.textContent = '删除 ' + (n + 1) + ' 项？' }
        var gp = li.querySelector('.tt-gp')
        gp.addEventListener('dragstart', function (ev) {
          dragId = x.id; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', x.id)
          try { ev.dataTransfer.setDragImage(li, 12, 12) } catch (e) {}
          setTimeout(function () { li.classList.add('tt-dragging') }, 0)
        })
        gp.addEventListener('dragend', function () { dragId = null; clearDz() })
        li.addEventListener('dragover', function (ev) {
          if (!dragId || dragId === x.id || !model.canDrop(items, dragId, x.id)) return
          ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; clearDz(true); li.classList.add('tt-dz-' + zone(li, ev))
        })
        li.addEventListener('dragleave', function (ev) { if (!li.contains(ev.relatedTarget)) li.classList.remove('tt-dz-before', 'tt-dz-after', 'tt-dz-child') })
        li.addEventListener('drop', function (ev) {
          ev.preventDefault()
          if (!dragId || !model.canDrop(items, dragId, x.id)) return
          var z = zone(li, ev), src = dragId
          dragId = null; clearDz()
          if (model.move(items, src, x.id, z)) change()
        })
        li.dataset.id = x.id
        list.appendChild(li)
        if (x.c && n) hideBelow = x.lv
      })
      if (focusId) {
        var el = list.querySelector('[data-id="' + focusId + '"] .tt-tx'); focusId = null
        if (el) { el.focus(); var rg = document.createRange(); rg.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(rg) }
      }
      emit()
    }
    function clearDz(keepDragging) {
      ;[].slice.call(list.querySelectorAll('.tt-dz-before,.tt-dz-after,.tt-dz-child,.tt-dragging')).forEach(function (e) {
        e.classList.remove('tt-dz-before', 'tt-dz-after', 'tt-dz-child'); if (!keepDragging) e.classList.remove('tt-dragging')
      })
    }
    function zone(li, ev) {
      var r = li.getBoundingClientRect(), y = (ev.clientY - r.top) / r.height
      return y < 0.3 ? 'before' : (y > 0.7 ? 'after' : 'child')
    }

    rootEl.querySelector('.tt-form').onsubmit = function (e) {
      e.preventDefault()
      var v = input.value.trim()
      if (!v || !loaded) return
      model.addAfter(items, null, v); input.value = ''; change()
      list.scrollTop = list.scrollHeight
    }
    rootEl.querySelector('.tt-expand').onclick = function () { if (!loaded) return; model.setAllCollapsed(items, false); schedule(); render() }
    rootEl.querySelector('.tt-collapse').onclick = function () { if (!loaded) return; model.setAllCollapsed(items, true); schedule(); render() }

    function onVisible() {   // 切回这个页面时，没有未保存改动就重新读一次（多端查看）
      if (document.visibilityState === 'visible' && loaded && !dirty && !saving && !destroyed) reload(true)
    }
    function beforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('beforeunload', beforeUnload)

    function reload(quiet) {
      if (!quiet) setStatus('loading', '读取中…')
      return store.load().then(function (data) {
        if (destroyed) return
        if (data == null) {
          items = model.fromSeed(opts.seed)
          loaded = true; render()
          if (items.length) schedule(); else setStatus('saved', '还没有内容')
        } else {
          var next = model.normalize(data)
          if (!loaded || JSON.stringify(next) !== JSON.stringify(items)) { items = next; loaded = true; render() }
          loaded = true
          if (!dirty) setStatus('saved', '已读取', store.label || '')
        }
        if (store.kind === 'memory') setStatus('warn', '没有接存储，刷新就没了')
      }, function (err) {
        // 读取失败：不能当成「空」去写 seed，也不开放编辑，免得之后的保存覆盖真数据
        var detail = String(err && err.message || err)
        if (!loaded) setStatus('error', '读取失败，已暂停编辑', detail, function () { reload(false) })
        else setStatus('error', '刷新失败', detail, function () { reload(false) })
      })
    }
    reload()

    return {
      getItems: function () { return JSON.parse(JSON.stringify(items)) },
      reload: function () { return reload(false) },
      flush: flush,
      focusInput: function () { input.focus() },
      destroy: function () {
        destroyed = true
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('beforeunload', beforeUnload)
        rootEl.innerHTML = ''; rootEl.classList.remove('tt')
      },
    }
  }

  /**
   * 侧边抽屉（UX-14）：不加蒙层，背后页面照常可点；× 或 Esc 关闭（正在编辑文字时 Esc 不关）；状态栏固定在最底。
   * opts 同 mount，另有 title、onToggle(open)、unavailable（有值就只显示这段话，不挂载列表）。
   * 返回 { open, close, toggle, isOpen, tree }。
   */
  function mountDrawer(opts) {
    var el = document.createElement('aside')
    el.className = 'tt-drawer'
    el.setAttribute('aria-label', opts.title || '待办')
    el.innerHTML =
      '<header class="tt-dh"><span class="tt-dt">' + icon('todo', 18) + '<span>' + esc(opts.title || '待办') + '</span><span class="tt-dc"></span></span>' +
      '<button type="button" class="tt-ibtn tt-dx" aria-label="关闭" title="关闭（Esc）">' + icon('x', 18) + '</button></header>' +
      '<div class="tt-dbody"></div>'
    document.body.appendChild(el)
    var body = el.querySelector('.tt-dbody'), countEl = el.querySelector('.tt-dc'), tree = null, isOpen = false
    if (opts.unavailable) {
      body.innerHTML = '<p class="tt-note">' + esc(opts.unavailable) + '</p>'
    } else {
      var userOnChange = opts.onChange
      var o = {}; for (var k in opts) o[k] = opts[k]
      o.onChange = function (info) {
        countEl.textContent = info.left ? String(info.left) : ''
        if (userOnChange) userOnChange(info)
      }
      tree = mount(body, o)
    }
    function setOpen(v) {
      if (v === isOpen) return
      isOpen = v
      el.classList.toggle('tt-open', v)
      if (opts.onToggle) opts.onToggle(v)
      if (v && tree) { tree.reload(); setTimeout(function () { tree.focusInput() }, 0) }
    }
    el.querySelector('.tt-dx').onclick = function () { setOpen(false) }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen) return
      var a = document.activeElement
      var editing = a && el.contains(a) && (a.isContentEditable || a.tagName === 'INPUT') && a.type !== 'checkbox'
      if (!editing) setOpen(false)
    })
    return { open: function () { setOpen(true) }, close: function () { setOpen(false) }, toggle: function () { setOpen(!isOpen) }, isOpen: function () { return isOpen }, tree: tree, el: el }
  }


  /**
   * 锚定浮层：展开在某个元素（通常是页面顶部的吸顶工具条）正下方，盖在内容上方；不加蒙层，
   * 背后页面照常滚动、点击。再点一次触发按钮（toggle）或按 Esc（编辑文字时不关）收起；
   * 底边的横条可拖动改变高度。
   * opts 同 mount，另有：anchor（必填，浮层贴在它下面）、align（左右对齐到谁，默认 anchor）、
   * height（初始高度 px，默认 320）、onHeightChange(px)（拖完松手时回调，宿主自己存起来）、
   * onToggle(open)、unavailable。返回 { open, close, toggle, isOpen, tree }。
   */
  function mountPanel(opts) {
    var el = document.createElement('section')
    el.className = 'tt-panel'
    el.setAttribute('aria-label', opts.title || '待办')
    el.innerHTML = '<div class="tt-pbody"></div><div class="tt-rs" role="separator" aria-orientation="horizontal" aria-label="拖动调整高度" title="拖动调整高度"><span></span></div>'
    document.body.appendChild(el)
    var body = el.querySelector('.tt-pbody'), handle = el.querySelector('.tt-rs'), tree = null, isOpen = false
    var MIN = 150
    function maxH() { return Math.max(MIN, Math.round(window.innerHeight * 0.85)) }
    var h = Math.min(maxH(), Math.max(MIN, parseInt(opts.height, 10) || 320))
    el.style.height = h + 'px'
    if (opts.unavailable) body.innerHTML = '<p class="tt-note">' + esc(opts.unavailable) + '</p>'
    else {
      var userOnChange = opts.onChange, o = {}
      for (var k in opts) o[k] = opts[k]
      o.onChange = function (info) { if (userOnChange) userOnChange(info) }
      tree = mount(body, o)
      // 状态文字并进底边的拖动条那一行，不单独占一行
      var s = body.querySelector('.tt-status')
      if (s) { handle.appendChild(s); s.addEventListener('pointerdown', function (e) { e.stopPropagation() }) }
    }
    function place() {
      var a = opts.anchor.getBoundingClientRect(), r = (opts.align || opts.anchor).getBoundingClientRect()
      el.style.top = Math.round(a.bottom + 6) + 'px'
      el.style.left = Math.round(r.left) + 'px'
      el.style.width = Math.round(r.width) + 'px'
      el.style.maxHeight = Math.max(MIN, window.innerHeight - a.bottom - 14) + 'px'
    }
    var raf = 0
    function onMove() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (isOpen) place() }) }
    function setOpen(v) {
      if (v === isOpen) return
      isOpen = v
      el.classList.toggle('tt-open', v)
      if (v) {
        place()
        window.addEventListener('scroll', onMove, { passive: true })
        window.addEventListener('resize', onMove)
        if (tree) { tree.reload(); setTimeout(function () { tree.focusInput() }, 0) }
      } else {
        window.removeEventListener('scroll', onMove)
        window.removeEventListener('resize', onMove)
      }
      if (opts.onToggle) opts.onToggle(v)
    }
    // 拖底边改高度
    var startY = 0, startH = 0, dragging = false
    handle.addEventListener('pointerdown', function (e) {
      dragging = true; startY = e.clientY; startH = el.getBoundingClientRect().height
      try { handle.setPointerCapture(e.pointerId) } catch (x) {}
      el.classList.add('tt-resizing'); e.preventDefault()
    })
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return
      h = Math.min(maxH(), Math.max(MIN, Math.round(startH + e.clientY - startY)))
      el.style.height = h + 'px'
    })
    function endDrag() {
      if (!dragging) return
      dragging = false; el.classList.remove('tt-resizing')
      if (opts.onHeightChange) opts.onHeightChange(h)
    }
    handle.addEventListener('pointerup', endDrag)
    handle.addEventListener('pointercancel', endDrag)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen) return
      var a = document.activeElement
      var editing = a && el.contains(a) && (a.isContentEditable || a.tagName === 'INPUT') && a.type !== 'checkbox'
      if (!editing) setOpen(false)
    })
    return { open: function () { setOpen(true) }, close: function () { setOpen(false) }, toggle: function () { setOpen(!isOpen) },
             isOpen: function () { return isOpen }, tree: tree, el: el, getHeight: function () { return h } }
  }

  return { model: model, stores: stores, mount: mount, mountDrawer: mountDrawer, mountPanel: mountPanel, icon: icon }
})()

export default TodoTree
