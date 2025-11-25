// lib/sse-hook.ts - SSE Connection Hook with Feature Flag and Auto-reconnect
import { useEffect, useState, useRef, useCallback } from 'react';

export interface SSEConfig {
  gameId: string;
  apiBase: string;
  enabled?: boolean;
  maxRetries?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  onEvent?: (data: any) => void;
  onConnectionChange?: (status: SSEStatus) => void;
}

export type SSEStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'disabled';

export interface SSEState {
  status: SSEStatus;
  eventCount: number;
  lastEventTime: Date | null;
  retryCount: number;
  connectionTime: Date | null;
}

export function useSSE(config: SSEConfig): SSEState {
  const [state, setState] = useState<SSEState>({
    status: 'disabled',
    eventCount: 0,
    lastEventTime: null,
    retryCount: 0,
    connectionTime: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const {
    gameId,
    apiBase,
    enabled = process.env.NEXT_PUBLIC_ENABLE_SSE === 'true',
    maxRetries = 10,
    baseRetryDelay = 1000,
    maxRetryDelay = 30000,
    onEvent,
    onConnectionChange,
  } = config;

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const calculateRetryDelay = useCallback((retryNum: number): number => {
    // Exponential backoff: 1s → 2s → 4s → 8s → ... max 30s
    const delay = Math.min(baseRetryDelay * Math.pow(2, retryNum), maxRetryDelay);
    // Add jitter (±25%) to prevent thundering herd
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.round(delay + jitter);
  }, [baseRetryDelay, maxRetryDelay]);

  const connect = useCallback(() => {
    if (!enabled) {
      setState(prev => ({ ...prev, status: 'disabled' }));
      return;
    }

    cleanup();

    setState(prev => ({ 
      ...prev, 
      status: 'connecting',
      retryCount: retryCountRef.current 
    }));

    const url = `${apiBase}/pbp/stream/${gameId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`SSE connected: ${gameId}`);
      retryCountRef.current = 0; // Reset retry count on successful connection
      
      setState(prev => ({
        ...prev,
        status: 'connected',
        retryCount: 0,
        connectionTime: new Date(),
      }));

      onConnectionChange?.('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const now = new Date();

        // Handle heartbeat events
        if (data.type === 'heartbeat') {
          console.log(`SSE heartbeat: ${gameId}, connection: ${data.connection_seconds}s`);
          return;
        }

        // Handle regular events
        setState(prev => ({
          ...prev,
          eventCount: prev.eventCount + 1,
          lastEventTime: now,
        }));

        onEvent?.(data);
        console.log(`SSE event: ${gameId}, pitch_seq: ${data.pitch_seq}, result: ${data.result}`);

      } catch (error) {
        console.error('SSE parse error:', error);
      }
    };

    eventSource.onerror = () => {
      console.log(`SSE error: ${gameId}, retry: ${retryCountRef.current}`);
      
      setState(prev => ({ ...prev, status: 'error' }));
      onConnectionChange?.('error');

      eventSource.close();

      // Exponential backoff retry
      if (retryCountRef.current < maxRetries) {
        const delay = calculateRetryDelay(retryCountRef.current);
        retryCountRef.current++;

        console.log(`SSE retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`);

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.log(`SSE max retries exceeded for ${gameId}`);
        setState(prev => ({ ...prev, status: 'disconnected' }));
        onConnectionChange?.('disconnected');
      }
    };

  }, [enabled, gameId, apiBase, maxRetries, calculateRetryDelay, cleanup, onEvent, onConnectionChange]);

  // Auto-connect on mount and config changes
  useEffect(() => {
    if (enabled && gameId) {
      connect();
    } else {
      setState(prev => ({ ...prev, status: 'disabled' }));
    }

    return cleanup;
  }, [enabled, gameId, connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return state;
}