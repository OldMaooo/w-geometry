// 音效（WebAudio 现场合成，不放音频文件）+ 朗读（浏览器 speechSynthesis，zh-CN）。
// iPad 要在一次真实点按里先「解锁」：首屏「开始」按钮调 audio.unlock()。

const PENTA = [0, 2, 4, 7, 9]; // 五声音阶，叮叮咚咚不刺耳

/** @param {() => {sound: boolean, voice: boolean}} getSettings */
export function createAudio(getSettings) {
  /** @type {AudioContext | null} */
  let ac = null;
  /** @type {GainNode | null} */
  let master = null;
  let voice = null;
  let unlocked = false;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.55;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function pickVoice() {
    const vs = window.speechSynthesis?.getVoices() || [];
    voice =
      vs.find((v) => /zh[-_]CN/i.test(v.lang) && /Tingting|婷婷|Xiaoxiao|晓晓|Yu-shu|Meijia/i.test(v.name)) ||
      vs.find((v) => /zh[-_]CN/i.test(v.lang)) ||
      vs.find((v) => /^zh/i.test(v.lang)) ||
      null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }

  /** 单音：频率、时长、波形、音量、滑音。 */
  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, glide = 0, attack = 0.005 } = {}) {
    const a = ctx();
    if (!a || !master) return;
    const t0 = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = /** @type {OscillatorType} */ (type);
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** 噪声（嚓、哗啦、咚的底子）。 */
  function noise(dur, { vol = 0.2, at = 0, freq = 1200, q = 0.8, type = 'bandpass', sweep = 0 } = {}) {
    const a = ctx();
    if (!a || !master) return;
    const t0 = a.currentTime + at;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = /** @type {BiquadFilterType} */ (type);
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
    f.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  const note = (i, base = 523.25) => {
    const oct = Math.floor(i / PENTA.length);
    const st = PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length] + oct * 12;
    return base * Math.pow(2, st / 12);
  };

  /** 音效表。新增音效在这里加一行。 */
  const SFX = {
    tap: () => tone(880, 0.06, { type: 'triangle', vol: 0.12 }),
    pick: () => { tone(440, 0.08, { type: 'triangle', vol: 0.14, glide: 1.5 }); },
    drop: () => { noise(0.08, { vol: 0.25, freq: 300, q: 1 }); tone(180, 0.1, { vol: 0.2, glide: 0.6 }); },
    tick: () => tone(1400, 0.03, { type: 'square', vol: 0.05 }),
    snap: () => { tone(660, 0.08, { type: 'triangle', vol: 0.2 }); tone(990, 0.12, { type: 'triangle', vol: 0.16, at: 0.05 }); },
    /** 报数：第 n 下，音越来越高 */
    count: (o = {}) => tone(note(o.n ?? 0), 0.22, { type: 'triangle', vol: 0.22 }),
    place: () => { noise(0.07, { vol: 0.3, freq: 500, q: 0.7 }); tone(220, 0.08, { vol: 0.15, glide: 0.7 }); },
    grow: (o = {}) => tone(note((o.n ?? 0) % 10, 784), 0.12, { type: 'sine', vol: 0.08, glide: 1.25 }),
    whoosh: () => noise(0.35, { vol: 0.18, freq: 400, sweep: 6, q: 0.6 }),
    cut: () => { noise(0.18, { vol: 0.35, freq: 2500, sweep: 0.3, q: 2, type: 'bandpass' }); tone(1200, 0.08, { type: 'sawtooth', vol: 0.05, glide: 0.5 }); },
    rotate: () => { tone(520, 0.1, { type: 'triangle', vol: 0.12, glide: 1.3 }); },
    pop: () => tone(700, 0.09, { type: 'sine', vol: 0.2, glide: 1.8 }),
    /** 温和的「再调一调」：两个低一点的软音，不刺耳 */
    soft: () => { tone(392, 0.18, { vol: 0.14 }); tone(349.23, 0.24, { vol: 0.12, at: 0.14 }); },
    /** 做对一步 */
    good: () => { tone(659.25, 0.12, { type: 'triangle', vol: 0.18 }); tone(987.77, 0.2, { type: 'triangle', vol: 0.16, at: 0.09 }); },
    /** 过关大和弦 */
    success: () => {
      [0, 2, 4, 5, 7].forEach((n, i) => tone(note(n), 0.35, { type: 'triangle', vol: 0.18, at: i * 0.09 }));
      tone(note(10), 0.8, { type: 'sine', vol: 0.2, at: 0.5 });
      noise(0.6, { vol: 0.06, freq: 6000, at: 0.45, type: 'highpass' });
    },
    star: (o = {}) => { tone(note(5 + (o.n ?? 0) * 2), 0.3, { type: 'triangle', vol: 0.2 }); tone(note(7 + (o.n ?? 0) * 2), 0.4, { type: 'sine', vol: 0.1, at: 0.05 }); },
    open: () => tone(600, 0.1, { type: 'sine', vol: 0.12, glide: 1.4 }),
  };

  return {
    /** 在一次真实点按里调用：解锁 WebAudio 和朗读。 */
    unlock() {
      if (unlocked) return;
      unlocked = true;
      const a = ctx();
      if (a) {
        const b = a.createBuffer(1, 1, 22050);
        const s = a.createBufferSource();
        s.buffer = b;
        s.connect(a.destination);
        s.start(0);
      }
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        u.lang = 'zh-CN';
        window.speechSynthesis.speak(u);
      }
    },
    /** 播音效。 @param {keyof typeof SFX | string} name @param {any} [opt] */
    play(name, opt) {
      if (!getSettings().sound) return;
      try { SFX[name]?.(opt); } catch { /* 音频不可用时静默 */ }
    },
    /** 朗读一句话（会打断上一句）。 @param {string} text */
    say(text) {
      if (!getSettings().voice || !window.speechSynthesis || !text) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[「」]/g, ''));
        u.lang = 'zh-CN';
        if (voice) u.voice = voice;
        u.rate = 1.0;
        u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      } catch { /* 静默 */ }
    },
    /** 停止朗读。 */
    hush() { try { window.speechSynthesis?.cancel(); } catch { /* 静默 */ } },
    /** 有哪些音效名（写文档 / 调试用）。 */
    names: () => Object.keys(SFX),
  };
}
