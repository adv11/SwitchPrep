import { describe, it, expect } from 'vitest';
import { StorageAdapter } from '../../../src/services/storage/StorageAdapter.js';

describe('StorageAdapter base contract', () => {
  it('throws not implemented for required methods', () => {
    const adapter = new StorageAdapter();
    expect(() => adapter.listenRoadmap()).toThrow('not implemented');
    expect(() => adapter.saveRoadmap()).toThrow('not implemented');
    expect(() => adapter.getRoadmap()).toThrow('not implemented');
    expect(() => adapter.deleteRoadmap()).toThrow('not implemented');
    expect(() => adapter.getMeta()).toThrow('not implemented');
    expect(() => adapter.saveMeta()).toThrow('not implemented');
  });

  it('provides safe defaults for optional methods', async () => {
    const adapter = new StorageAdapter();
    await expect(adapter.getLegacyRoadmap('uid')).resolves.toBeNull();
    expect(typeof adapter.now()).toBe('number');
    expect(adapter.destroy()).toBeUndefined();
  });

  it('updateRoadmapItemFields default falls back to a read-modify-write over the whole roadmap (issue #184)', async () => {
    const adapter = new StorageAdapter();
    adapter.getRoadmap = async () => ({ items: { a: { id: 'a', title: 'A', done: false } } });
    let savedPayload = null;
    adapter.saveRoadmap = async (_uid, _templateId, payload) => { savedPayload = payload; };

    const result = await adapter.updateRoadmapItemFields('uid', 'tpl', 'a', { done: true });

    expect(result).toEqual({ id: 'a', title: 'A', done: true });
    expect(savedPayload.items.a).toEqual({ id: 'a', title: 'A', done: true });
  });

  it('updateRoadmapItemFields default resolves null when the item does not exist', async () => {
    const adapter = new StorageAdapter();
    adapter.getRoadmap = async () => ({ items: {} });
    await expect(adapter.updateRoadmapItemFields('uid', 'tpl', 'missing', { done: true })).resolves.toBeNull();
  });

  it('provides a safe no-op default for daily todos (issue #56)', async () => {
    const adapter = new StorageAdapter();
    let received = 'unset';
    const unsubscribe = adapter.listenDailyTodos('uid', data => { received = data; });
    expect(received).toBeNull();
    expect(typeof unsubscribe).toBe('function');
    expect(unsubscribe()).toBeUndefined();
    await expect(adapter.saveDailyTodos('uid', {})).resolves.toBeUndefined();
  });
});
