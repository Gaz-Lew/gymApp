import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export interface TimerRef {
  start: () => void;
  stop: () => void;
  reset: () => void;
}

interface TimerProps {
  initialSeconds?: number;
  autoStart?: boolean;
  onTick?: (seconds: number) => void;
  className?: string;
  mode?: 'countup' | 'countdown';
  countdownSeconds?: number;
  onCountdownComplete?: () => void;
  compact?: boolean;
}

const Timer = forwardRef<TimerRef, TimerProps>(
  (
    {
      initialSeconds = 0,
      autoStart = false,
      onTick,
      className = '',
      mode = 'countup',
      countdownSeconds = 60,
      onCountdownComplete,
      compact = false,
    },
    ref
  ) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [running, setRunning] = useState(autoStart);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const notifiedRef = useRef(false);

    const formatTime = (totalSeconds: number) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const tick = useCallback(() => {
      setSeconds((prev) => {
        if (mode === 'countdown') {
          const next = prev - 1;
          if (next <= 0) {
            if (!notifiedRef.current) {
              notifiedRef.current = true;
              onCountdownComplete?.();
            }
            return 0;
          }
          onTick?.(next);
          return next;
        }
        const next = prev + 1;
        onTick?.(next);
        return next;
      });
    }, [mode, onTick, onCountdownComplete]);

    useEffect(() => {
      if (running) {
        intervalRef.current = setInterval(tick, 1000);
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [running, tick]);

    useImperativeHandle(ref, () => ({
      start: () => {
        notifiedRef.current = false;
        setRunning(true);
      },
      stop: () => setRunning(false),
      reset: () => {
        setRunning(false);
        setSeconds(mode === 'countdown' ? countdownSeconds : 0);
        notifiedRef.current = false;
        onTick?.(mode === 'countdown' ? countdownSeconds : 0);
      },
    }));

    const toggle = () => {
      notifiedRef.current = false;
      setRunning((r) => !r);
    };

    const handleReset = () => {
      setRunning(false);
      setSeconds(mode === 'countdown' ? countdownSeconds : 0);
      notifiedRef.current = false;
      onTick?.(mode === 'countdown' ? countdownSeconds : 0);
    };

    const progressPercent =
      mode === 'countdown' && countdownSeconds > 0
        ? Math.max(0, (seconds / countdownSeconds) * 100)
        : 0;

    if (compact && mode === 'countdown') {
      return (
        <div className={`relative overflow-hidden rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800 ${className}`}>
          <div
            className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-lg font-bold tabular-nums ${
                seconds <= 5 && seconds > 0 ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {formatTime(seconds)}
            </span>
            <button
              onClick={toggle}
              className="rounded-md bg-emerald-600 p-1 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <button
              onClick={handleReset}
              className="rounded-md bg-slate-300 p-1 text-slate-700 hover:bg-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-2 dark:bg-slate-800 ${className}`}>
        <span className="font-mono text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {formatTime(seconds)}
        </span>
        <button
          onClick={toggle}
          className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg bg-slate-300 p-2 text-slate-700 hover:bg-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    );
  }
);

Timer.displayName = 'Timer';
export default Timer;
