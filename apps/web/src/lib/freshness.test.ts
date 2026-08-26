import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchVoteTotals } from './voteAggregation';

vi.mock('@stellar/stellar-sdk', () => {
  const mockGetEvents = vi.fn();
  return {
    rpc: {
      Server: vi.fn().mockImplementation(() => ({
        getEvents: mockGetEvents,
      })),
      Api: {},
    },
    xdr: {
      ScVal: {},
    },
    scValToNative: vi.fn(),
  };
});

describe('Freshness State & Metadata Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates Unavailable state when governor contract ID is missing', async () => {
    const result = await fetchVoteTotals('00112233', '');
    expect(result.freshness).toBe('Unavailable');
    expect(result.incomplete).toBe(true);
    expect(result.error).toContain('Governor contract ID not configured');
  });

  it('evaluates Unavailable state when RPC query fails with no prior data', async () => {
    const { rpc } = await import('@stellar/stellar-sdk');
    const mockServer = new rpc.Server('http://localhost:8000');
    (mockServer.getEvents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('RPC connection timeout')
    );

    const result = await fetchVoteTotals('00112233', 'CC_TEST_GOVERNOR');
    expect(result.freshness).toBe('Unavailable');
    expect(result.incomplete).toBe(true);
    expect(result.error).toBe('RPC connection timeout');
  });

  it('evaluates Delayed state when latestLedger is undefined or malformed', async () => {
    const { rpc } = await import('@stellar/stellar-sdk');
    const mockServer = new rpc.Server('http://localhost:8000');
    (mockServer.getEvents as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      events: [],
      latestLedger: undefined,
      cursor: 'cursor_1',
    });

    const result = await fetchVoteTotals('00112233', 'CC_TEST_GOVERNOR');
    expect(result.freshness).toBe('Delayed');
    expect(result.incomplete).toBe(false);
  });

  it('evaluates Current state when valid events and complete metadata are returned', async () => {
    const { rpc } = await import('@stellar/stellar-sdk');
    const mockServer = new rpc.Server('http://localhost:8000');
    (mockServer.getEvents as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      events: [],
      latestLedger: 123456,
      cursor: 'cursor_1',
    });

    const result = await fetchVoteTotals('00112233', 'CC_TEST_GOVERNOR');
    expect(result.freshness).toBe('Current');
    expect(result.incomplete).toBe(false);
  });
});
