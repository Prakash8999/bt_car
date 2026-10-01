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

    // If already actively running this source and command, don't restart interval
    if (activeSourceRef.current === source && activeCmdRef.current === cmd) {
      return;
    }

    // Clear previous timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    activeSourceRef.current = source;
    activeCmdRef.current = cmd;
    setActiveAction(actionName);

    console.log(`🎮 [GAMEPAD ACTION START] ${actionName} -> Command: '${cmd}' (Source: ${source})`);

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
      console.log(`🛑 [GAMEPAD ACTION STOP] Stopped '${activeSourceRef.current}' -> Sending 'S'`);
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
      setLastKey(data);

      const isButtonA = data.keyCode === 96 || data.keyName === 'KEYCODE_BUTTON_A';

      // 1. Button A -> SPIN (holds repeat while pressed, stops on release)
      if (isButtonA) {
        if (data.action === 'DOWN') {
          if (data.repeatCount === 0) {
            startAction('BUTTON_A', 'F', 'SPIN');
          }
        } else if (data.action === 'UP') {
          if (activeSourceRef.current === 'BUTTON_A') {
            stopAction();
          }
        }
        return;
      }

      // 2. Optional D-Pad keys (if controller sends D-pad as KeyEvents)
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
      setLastMotion(data);

      // If Button A is spinning, don't interrupt it with tiny analog stick jitter
      if (activeSourceRef.current === 'BUTTON_A') {
        return;
      }

      const { axisX, lTrigger, rTrigger, hatX, hatY } = data;

      // 1. Right Terminal (R2 Trigger) -> FORWARD (Trigger must reach 1 / >= 0.95)
      if (rTrigger >= 0.95) {
        startAction('R2', 'R', 'FORWARD');
        return;
      }

      // 2. Left Terminal (L2 Trigger) -> BACKWARD (Trigger must reach 1 / >= 0.95)
      if (lTrigger >= 0.95) {
        startAction('L2', 'L', 'BACKWARD');
        return;
      }

      // 3. Joystick Left / Right (axisX or D-pad Hat)
      if (axisX <= -0.65 || hatX === -1) {
        startAction('JOY_LEFT', 'B', 'LEFT');
        return;
      }

      if (axisX >= 0.65 || hatX === 1) {
        startAction('JOY_RIGHT', 'F', 'RIGHT');
        return;
      }

      // 4. Joystick Up / Down (hatY if D-pad hat is used)
      if (hatY === -1) {
        startAction('HAT_UP', 'R', 'FORWARD');
        return;
      }
      if (hatY === 1) {
        startAction('HAT_DOWN', 'L', 'BACKWARD');
        return;
      }

      // 5. Release / Neutral state:
      // If an analog action was driving, stop it once returned to neutral
      const isAnalogAction =
        activeSourceRef.current === 'R2' ||
        activeSourceRef.current === 'L2' ||
        activeSourceRef.current === 'JOY_LEFT' ||
        activeSourceRef.current === 'JOY_RIGHT' ||
        activeSourceRef.current === 'HAT_UP' ||
        activeSourceRef.current === 'HAT_DOWN';

      if (isAnalogAction) {
        stopAction();
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
