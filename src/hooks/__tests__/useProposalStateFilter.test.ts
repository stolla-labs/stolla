import { renderHook } from '@testing-library/react';
import { useProposalStateFilter } from '../useProposalStateFilter';
import { useRouter } from 'next/router';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('useProposalStateFilter', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      isReady: true,
      pathname: '/proposals',
      push: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return default filter when query is empty', () => {
    const { result } = renderHook(() => useProposalStateFilter());
    expect(result.current.filter).toBe('all');
  });

  it('should parse valid filter from query', () => {
    (useRouter as jest.Mock).mockReturnValue({
      query: { filter: 'active' },
      isReady: true,
      pathname: '/proposals',
      push: jest.fn(),
    });

    const { result } = renderHook(() => useProposalStateFilter());
    expect(result.current.filter).toBe('active');
  });

  it('should fallback to default for invalid filter', () => {
    (useRouter as jest.Mock).mockReturnValue({
      query: { filter: 'invalid' },
      isReady: true,
      pathname: '/proposals',
      push: jest.fn(),
    });

    const { result } = renderHook(() => useProposalStateFilter());
    expect(result.current.filter).toBe('all');
  });

  it('should handle array filter query', () => {
    (useRouter as jest.Mock).mockReturnValue({
      query: { filter: ['succeeded'] },
      isReady: true,
      pathname: '/proposals',
      push: jest.fn(),
    });

    const { result } = renderHook(() => useProposalStateFilter());
    expect(result.current.filter).toBe('succeeded');
  });

  it('should update filter and push to router', () => {
    const pushMock = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      isReady: true,
      pathname: '/proposals',
      push: pushMock,
    });

    const { result } = renderHook(() => useProposalStateFilter());
    result.current.updateFilter('failed');

    expect(pushMock).toHaveBeenCalledWith(
      {
        pathname: '/proposals',
        query: { filter: 'failed' },
      },
      undefined,
      { shallow: true }
    );
  });

  it('should clear filter when setting to all', () => {
    const pushMock = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: { filter: 'active' },
      isReady: true,
      pathname: '/proposals',
      push: pushMock,
    });

    const { result } = renderHook(() => useProposalStateFilter());
    result.current.updateFilter('all');

    expect(pushMock).toHaveBeenCalledWith(
      {
        pathname: '/proposals',
        query: {},
      },
      undefined,
      { shallow: true }
    );
  });
});
