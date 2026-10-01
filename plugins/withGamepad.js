const { withMainActivity } = require('@expo/config-plugins');

function modifyMainActivity(contents) {
  // If already modified, avoid duplicate injection
  if (contents.includes('dispatchKeyEvent')) {
    return contents;
  }

  const importsToAdd = `
import android.util.Log
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
`;

  const codeToInject = `
  private fun getReactAppContext(): ReactContext? {
    return try {
      reactHost?.currentReactContext ?: reactInstanceManager?.currentReactContext
    } catch (e: Throwable) {
      null
    }
  }

  private fun isGamepadKey(keyCode: Int): Boolean {
    return when (keyCode) {
      KeyEvent.KEYCODE_DPAD_UP,
      KeyEvent.KEYCODE_DPAD_DOWN,
      KeyEvent.KEYCODE_DPAD_LEFT,
      KeyEvent.KEYCODE_DPAD_RIGHT,
      KeyEvent.KEYCODE_DPAD_CENTER,
      KeyEvent.KEYCODE_BUTTON_A,
      KeyEvent.KEYCODE_BUTTON_B,
      KeyEvent.KEYCODE_BUTTON_C,
      KeyEvent.KEYCODE_BUTTON_X,
      KeyEvent.KEYCODE_BUTTON_Y,
      KeyEvent.KEYCODE_BUTTON_Z,
      KeyEvent.KEYCODE_BUTTON_L1,
      KeyEvent.KEYCODE_BUTTON_R1,
      KeyEvent.KEYCODE_BUTTON_L2,
      KeyEvent.KEYCODE_BUTTON_R2,
      KeyEvent.KEYCODE_BUTTON_THUMBL,
      KeyEvent.KEYCODE_BUTTON_THUMBR,
      KeyEvent.KEYCODE_BUTTON_START,
      KeyEvent.KEYCODE_BUTTON_SELECT,
      KeyEvent.KEYCODE_BUTTON_MODE,
      KeyEvent.KEYCODE_BUTTON_1,
      KeyEvent.KEYCODE_BUTTON_2,
      KeyEvent.KEYCODE_BUTTON_3,
      KeyEvent.KEYCODE_BUTTON_4,
      KeyEvent.KEYCODE_BUTTON_5,
      KeyEvent.KEYCODE_BUTTON_6,
      KeyEvent.KEYCODE_BUTTON_7,
      KeyEvent.KEYCODE_BUTTON_8,
      KeyEvent.KEYCODE_BUTTON_9,
      KeyEvent.KEYCODE_BUTTON_10,
      KeyEvent.KEYCODE_BUTTON_11,
      KeyEvent.KEYCODE_BUTTON_12,
      KeyEvent.KEYCODE_BUTTON_13,
      KeyEvent.KEYCODE_BUTTON_14,
      KeyEvent.KEYCODE_BUTTON_15,
      KeyEvent.KEYCODE_BUTTON_16 -> true
      else -> false
    }
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val keyCode = event.keyCode

    if (keyCode == KeyEvent.KEYCODE_BACK ||
        keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
        keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
        keyCode == KeyEvent.KEYCODE_VOLUME_MUTE) {
      return super.dispatchKeyEvent(event)
    }

    val isFromGamepad = (event.source and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD) ||
                        (event.source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK) ||
                        (event.source and InputDevice.SOURCE_DPAD == InputDevice.SOURCE_DPAD) ||
                        isGamepadKey(keyCode)

    if (isFromGamepad) {
      val actionStr = if (event.action == KeyEvent.ACTION_DOWN) "DOWN" else "UP"
      val keyName = KeyEvent.keyCodeToString(keyCode)
      val devName = event.device?.name ?: "Gamepad"

      Log.d("GamepadEvent", "KEY $actionStr: $keyName ($keyCode) from $devName [repeat: \${event.repeatCount}]")

      val map = Arguments.createMap().apply {
        putString("action", actionStr)
        putInt("keyCode", keyCode)
        putString("keyName", keyName)
        putInt("repeatCount", event.repeatCount)
        putString("deviceName", devName)
      }

      getReactAppContext()?.emitDeviceEvent("onGamepadKeyEvent", map)
      return true
    }

    return super.dispatchKeyEvent(event)
  }

  private var lastAxisX = 0f
  private var lastAxisY = 0f
  private var lastHatX = 0f
  private var lastHatY = 0f
  private var lastLTrigger = 0f
  private var lastRTrigger = 0f

  override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
    val isFromGamepad = (event.source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK) ||
                        (event.source and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD)

    if (isFromGamepad && event.action == MotionEvent.ACTION_MOVE) {
      val axisX = event.getAxisValue(MotionEvent.AXIS_X)
      val axisY = event.getAxisValue(MotionEvent.AXIS_Y)
      val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
      val hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
      val lTrigger = event.getAxisValue(MotionEvent.AXIS_BRAKE).let { if (it == 0f) event.getAxisValue(MotionEvent.AXIS_LTRIGGER) else it }
      val rTrigger = event.getAxisValue(MotionEvent.AXIS_GAS).let { if (it == 0f) event.getAxisValue(MotionEvent.AXIS_RTRIGGER) else it }

      val diffX = Math.abs(axisX - lastAxisX)
      val diffY = Math.abs(axisY - lastAxisY)
      val diffHatX = Math.abs(hatX - lastHatX)
      val diffHatY = Math.abs(hatY - lastHatY)
      val diffL = Math.abs(lTrigger - lastLTrigger)
      val diffR = Math.abs(rTrigger - lastRTrigger)

      if (diffX > 0.08f || diffY > 0.08f || diffHatX > 0.1f || diffHatY > 0.1f || diffL > 0.08f || diffR > 0.08f) {
        lastAxisX = axisX
        lastAxisY = axisY
        lastHatX = hatX
        lastHatY = hatY
        lastLTrigger = lTrigger
        lastRTrigger = rTrigger

        val devName = event.device?.name ?: "Gamepad"
        Log.d("GamepadEvent", "MOTION: Stick($axisX, $axisY) Hat($hatX, $hatY) L2($lTrigger) R2($rTrigger) from $devName")

        val map = Arguments.createMap().apply {
          putDouble("axisX", axisX.toDouble())
          putDouble("axisY", axisY.toDouble())
          putDouble("hatX", hatX.toDouble())
          putDouble("hatY", hatY.toDouble())
          putDouble("lTrigger", lTrigger.toDouble())
          putDouble("rTrigger", rTrigger.toDouble())
          putString("deviceName", devName)
        }

        getReactAppContext()?.emitDeviceEvent("onGamepadMotionEvent", map)
      }
      return true
    }

    return super.dispatchGenericMotionEvent(event)
  }
`;

  let newContents = contents.replace(/(package\s+[\w\.]+)/, `$1\n${importsToAdd}`);
  const lastBraceIndex = newContents.lastIndexOf('}');
  if (lastBraceIndex !== -1) {
    newContents = newContents.substring(0, lastBraceIndex) + codeToInject + '\n}\n';
  }

  return newContents;
}

const withGamepad = (config) => {
  return withMainActivity(config, (modConfig) => {
    modConfig.modResults.contents = modifyMainActivity(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports = withGamepad;
