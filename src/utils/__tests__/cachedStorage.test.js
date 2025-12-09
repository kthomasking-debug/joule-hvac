import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, setCached, removeCached, clearCache, getCachedBatch } from '../cachedStorage';

describe('cachedStorage', () => {
  beforeEach(() => {
    // Clear cache and localStorage before each test
    clearCache();
    localStorage.clear();
  });

  it('should cache values after first read', () => {
    localStorage.setItem('test-key', JSON.stringify({ value: 123 }));
    
    // First read - should hit localStorage
    const first = getCached('test-key');
    expect(first).toEqual({ value: 123 });
    
    // Remove from localStorage
    localStorage.removeItem('test-key');
    
    // Second read - should use cache
    const second = getCached('test-key');
    expect(second).toEqual({ value: 123 });
  });

  it('should return default value for missing keys', () => {
    const value = getCached('missing-key', 'default');
    expect(value).toBe('default');
  });

  it('should update cache when setting values', () => {
    setCached('test-key', { value: 456 });
    
    const value = getCached('test-key');
    expect(value).toEqual({ value: 456 });
    
    // Verify it's also in localStorage
    const stored = JSON.parse(localStorage.getItem('test-key'));
    expect(stored).toEqual({ value: 456 });
  });

  it('should remove from cache and localStorage', () => {
    setCached('test-key', { value: 789 });
    removeCached('test-key');
    
    const value = getCached('test-key', null);
    expect(value).toBeNull();
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('should batch read multiple keys', () => {
    setCached('key1', 'value1');
    setCached('key2', 'value2');
    setCached('key3', 'value3');
    
    const batch = getCachedBatch(['key1', 'key2', 'key3', 'missing']);
    
    expect(batch.key1).toBe('value1');
    expect(batch.key2).toBe('value2');
    expect(batch.key3).toBe('value3');
    // Missing keys are not included in batch result
    expect(batch.missing).toBeUndefined();
  });

  it('should handle JSON parse errors gracefully', () => {
    localStorage.setItem('invalid-json', 'not json');
    
    const value = getCached('invalid-json', 'default');
    expect(value).toBe('default');
  });
});

