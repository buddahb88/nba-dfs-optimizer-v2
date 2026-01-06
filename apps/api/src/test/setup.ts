// Test setup file for Vitest
import { vi, beforeEach, afterEach } from 'vitest';

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Mock console to reduce noise during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});
