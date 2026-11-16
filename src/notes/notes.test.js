import { describe, it, expect } from 'vitest';
import { clampWidth, clampPos, itemsToText } from './notes.js';

describe('笔记面板几何', () => {
  it('宽度夹在 280 到窗口 70% 之间', () => {
    expect(clampWidth(100, 1180)).toBe(280);
    expect(clampWidth(360, 1180)).toBe(360);
    expect(clampWidth(2000, 1180)).toBe(826);
    expect(clampWidth(500, 300)).toBe(280); // 窗口很窄也不低于最小宽度
  });
  it('浮标不能拖出屏幕', () => {
    expect(clampPos(-50, -50, 1000, 800)).toEqual({ x: 4, y: 4 });
    expect(clampPos(5000, 5000, 1000, 800)).toEqual({ x: 956, y: 756 });
    expect(clampPos(500, 400, 1000, 800)).toEqual({ x: 500, y: 400 });
  });
});

describe('复制成文本', () => {
  it('按层级缩进，已完成的打 √', () => {
    const items = [{ lv: 0, t: 'bug', d: 0 }, { lv: 1, t: '第 3 关卡住', d: 1 }];
    expect(itemsToText(items)).toBe('- bug\n  √ 第 3 关卡住');
    expect(itemsToText([])).toBe('');
  });
});
