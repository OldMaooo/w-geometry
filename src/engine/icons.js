// 功能图标统一入口（lucide）。新图标加进 ICONS 映射表，不在别处直接写 emoji。
import {
  createElement, Volume2, VolumeX, Map, RotateCcw, Settings, Lightbulb, Eye, Box, Play, Star,
  ChevronRight, ChevronLeft, House, Plus, Minus, Check, X, BookOpen, Scissors, Lock, Hammer,
  Rows3, Columns3, RefreshCw, Sparkles, Rotate3d, ScanEye, Construction, ArrowRight, Pointer,
  Wheat, Sprout, Fence, Trees, Waves, Compass, Castle, Landmark, Warehouse, Triangle, Grid2x2,
  Speech, Mic, MicOff, Music, Telescope, Ruler, Hand, Repeat, Award, Puzzle, Flag, Layers, Sun,
} from 'lucide';

const ICONS = {
  sound: Volume2, mute: VolumeX, map: Map, restart: RotateCcw, settings: Settings, hint: Lightbulb,
  eye: Eye, oblique: Box, top: ScanEye, play: Play, star: Star, next: ChevronRight, prev: ChevronLeft,
  home: House, plus: Plus, minus: Minus, check: Check, close: X, book: BookOpen, cut: Scissors,
  lock: Lock, hammer: Hammer, row: Rows3, col: Columns3, refresh: RefreshCw, sparkles: Sparkles,
  rotate: Rotate3d, building: Construction, arrow: ArrowRight, pointer: Pointer, wheat: Wheat,
  sprout: Sprout, fence: Fence, trees: Trees, waves: Waves, compass: Compass, castle: Castle,
  landmark: Landmark, warehouse: Warehouse, triangle: Triangle, grid: Grid2x2, speech: Speech,
  voice: Mic, voiceOff: MicOff, music: Music, telescope: Telescope, ruler: Ruler, hand: Hand,
  repeat: Repeat, award: Award, puzzle: Puzzle, flag: Flag, layers: Layers, sun: Sun,
};

/**
 * 生成一个 lucide 图标 <svg>。
 * @param {keyof typeof ICONS | string} name @param {{ size?: number, stroke?: number, fill?: string }} [opt]
 * @returns {SVGElement}
 */
export function icon(name, opt = {}) {
  const node = ICONS[name] || ICONS.sparkles;
  const el = createElement(node, {
    width: opt.size ?? 24,
    height: opt.size ?? 24,
    'stroke-width': opt.stroke ?? 2.2,
    ...(opt.fill ? { fill: opt.fill } : {}),
    'aria-hidden': 'true',
  });
  el.classList.add('ico');
  return el;
}

/** 图标的 HTML 字符串（拼模板用）。 */
export const iconHTML = (name, opt) => icon(name, opt).outerHTML;

export const ICON_NAMES = Object.keys(ICONS);
