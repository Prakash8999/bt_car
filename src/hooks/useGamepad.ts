import { useState, useEffect, useRef } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

export interface GamepadKeyEvent {
  action: 'DOWN' | 'UP';
  keyCode: number;
  keyName: string;
  repeatCount: number;
  deviceName: string;
  timestamp: number;
}

export interface GamepadMotionEvent {
  axisX: number;
  axisY: number;
  hatX: number;
  hatY: number;
  lTrigger: number;
  rTrigger: number;
  deviceName: string;
  timestamp: number;
}

interface UseGamepadOptions {
  onCommand?: (command: string) => void;
  enabled?: boolean;
}

// Thresholds with hysteresis
const TRIGGER_ACTIVATE = 0.85;   // Activate forward/backward when pulled firmly (~1.0)
const TRIGGER_DEACTIVATE = 0.35; // Deactivate only when finger released (< 0.35)
const STICK_ACTIVATE = 0.60;     // Activate steering past 60% tilt
const STICK_DEACTIVATE = 0.25;   // Deactivate only when stick returns near center

export function useGamepad({ onCommand, enabled = true }: UseGamepadOptions = {}) {
  const [lastKey, setLastKey] = useState<GamepadKeyEvent | null>(null);
  const [lastMotion, setLastMotion] = useState<GamepadMotionEvent | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSourceRef = useRef<string | null>(null);
  const activeCmdRef = useRef<string | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startAction = (source: string, cmd: string, actionName: string) => {
    if (!enabledRef.current) return;

    // Already running this action
    if (activeSourceRef.current === source && activeCmdRef.current === cmd) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    activeSourceRef.current = source;
    activeCmdRef.current = cmd;
    setActiveAction(actionName);

    console.log(`🚗 [DRIVE START] ${actionName} -> Command '${cmd}' (via ${source})`);

    if (onCommandRef.current) {
      onCommandRef.current(cmd);
      timerRef.current = setInterval(() => {
        onCommandRef.current?.(cmd);
      }, 200);
    }
  };

  const stopAction = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (activeSourceRef.current !== null) {
      console.log(`🛑 [DRIVE STOP] Stopped '${activeSourceRef.current}' -> Sending 'S'`);
      activeSourceRef.current = null;
      activeCmdRef.current = null;
      setActiveAction(null);

      if (onCommandRef.current) {
        onCommandRef.current('S');
      }
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const keySub = DeviceEventEmitter.addListener('onGamepadKeyEvent', (data: GamepadKeyEvent) => {
      // Print every key press/release to console (just like in initial test)
      console.log(`🎮 [GAMEPAD KEY] ${data.action} -> ${data.keyName} (Code: ${data.keyCode}) | Device: ${data.deviceName}`);
      setLastKey(data);

      const isButtonA = data.keyCode === 96 || data.keyName === 'KEYCODE_BUTTON_A';

      // 1. Button A -> SPIN
      if (isButtonA) {
        if (data.action === 'DOWN') {
          if (data.repeatCount === 0) {
            startAction('BUTTON_A', 'F', 'SPIN');
          }
        } else if (data.action === 'UP') {
          stopAction();
        }
        return;
      }

      // 2. D-Pad keys (if controller sends D-pad as KeyEvents)
      if (data.keyCode === 19 || data.keyName === 'KEYCODE_DPAD_UP') {
        if (data.action === 'DOWN' && data.repeatCount === 0) startAction('DPAD_UP', 'R', 'FORWARD');
        else if (data.action === 'UP' && activeSourceRef.current === 'DPAD_UP') stopAction();
      } else if (data.keyCode === 20 || data.keyName === 'KEYCODE_DPAD_DOWN') {
        if (data.action === 'DOWN' && data.repeatCount === 0) startAction('DPAD_DOWN', 'L', 'BACKWARD');
        else if (data.action === 'UP' && activeSourceRef.current === 'DPAD_DOWN') stopAction();
      } else if (data.keyCode === 21 || data.keyName === 'KEYCODE_DPAD_LEFT') {
        if (data.action === 'DOWN' && data.repeatCount === 0) startAction('DPAD_LEFT', 'B', 'LEFT');
        else if (data.action === 'UP' && activeSourceRef.current === 'DPAD_LEFT') stopAction();
      } else if (data.keyCode === 22 || data.keyName === 'KEYCODE_DPAD_RIGHT') {
        if (data.action === 'DOWN' && data.repeatCount === 0) startAction('DPAD_RIGHT', 'F', 'RIGHT');
        else if (data.action === 'UP' && activeSourceRef.current === 'DPAD_RIGHT') stopAction();
      }
    });

    const motionSub = DeviceEventEmitter.addListener('onGamepadMotionEvent', (data: GamepadMotionEvent) => {
      const { axisX, lTrigger, rTrigger, hatX, hatY } = data;

      // Print motion updates to console
      if (rTrigger > 0.05 || lTrigger > 0.05 || Math.abs(axisX) > 0.1 || hatX !== 0 || hatY !== 0) {
        console.log(`🕹️ [GAMEPAD MOTION] Stick: [X: ${axisX.toFixed(2)}] | L2: ${lTrigger.toFixed(2)}, R2: ${rTrigger.toFixed(2)} | Hat: [${hatX}, ${hatY}]`);
      }

      setLastMotion(data);

      // Do not allow stick jitter to interrupt Button A spin
      if (activeSourceRef.current === 'BUTTON_A') {
        return;
      }

      // 1. Right Terminal (R2 Trigger) -> FORWARD with Hysteresis
      if (activeSourceRef.current === 'R2') {
        if (rTrigger < TRIGGER_DEACTIVATE) {
          stopAction();
        }
        return;
      } else if (rTrigger >= TRIGGER_ACTIVATE) {
        startAction('R2', 'R', 'FORWARD');
        return;
      }

      // 2. Left Terminal (L2 Trigger) -> BACKWARD with Hysteresis
      if (activeSourceRef.current === 'L2') {
        if (lTrigger < TRIGGER_DEACTIVATE) {
          stopAction();
        }
        return;
      } else if (lTrigger >= TRIGGER_ACTIVATE) {
        startAction('L2', 'L', 'BACKWARD');
        return;
      }

      // 3. Joystick Left / D-pad Left -> STEER LEFT with Hysteresis
      if (activeSourceRef.current === 'JOY_LEFT') {
        if (axisX > -STICK_DEACTIVATE && hatX !== -1) {
          stopAction();
        }
        return;
      } else if (axisX <= -STICK_ACTIVATE || hatX === -1) {
        startAction('JOY_LEFT', 'B', 'LEFT');
        return;
      }

      // 4. Joystick Right / D-pad Right -> STEER RIGHT with Hysteresis
      if (activeSourceRef.current === 'JOY_RIGHT') {
        if (axisX < STICK_DEACTIVATE && hatX !== 1) {
          stopAction();
        }
        return;
      } else if (axisX >= STICK_ACTIVATE || hatX === 1) {
        startAction('JOY_RIGHT', 'F', 'RIGHT');
        return;
      }

      // 5. Hat Up / Down (if D-pad sends hat)
      if (activeSourceRef.current === 'HAT_UP') {
        if (hatY !== -1) {
          stopAction();
        }
        return;
      } else if (hatY === -1) {
        startAction('HAT_UP', 'R', 'FORWARD');
        return;
      }

      if (activeSourceRef.current === 'HAT_DOWN') {
        if (hatY !== 1) {
          stopAction();
        }
        return;
      } else if (hatY === 1) {
        startAction('HAT_DOWN', 'L', 'BACKWARD');
        return;
      }
    });

    return () => {
      keySub.remove();
      motionSub.remove();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      onCommandRef.current?.('S');
    };
  }, []);

  return { lastKey, lastMotion, activeAction };
}
