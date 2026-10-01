import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNBluetoothClassic, {
  BluetoothDevice
} from 'react-native-bluetooth-classic';

import { DPad } from '@/components/DPad';
import { useGamepad } from '@/hooks/useGamepad';

export default function App() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);

  useEffect(() => {
    let disconnectSubscription: any;
    
    const init = async () => {
      await requestPermissions();
      await checkBluetoothEnabled();
    };
    init();

    // Listen for unexpected disconnects
    disconnectSubscription = RNBluetoothClassic.onDeviceDisconnected((event) => {
      console.log('Device disconnected:', event.device.address);
      setConnectedDevice(null);
      Alert.alert('Disconnected', 'The connection to the car was lost.');
    });

    return () => {
      if (disconnectSubscription) {
        disconnectSubscription.remove();
      }
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]);
          // Wait for permission resolution before proceeding
        } else {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const checkBluetoothEnabled = async () => {
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      setBluetoothEnabled(enabled);
      if (enabled) {
        getPairedDevices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getPairedDevices = async () => {
    try {
      setIsScanning(true);
      const paired = await RNBluetoothClassic.getBondedDevices();
      setDevices(paired);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      setIsConnecting(true);
      let connection = await device.isConnected();
      if (!connection) {
        connection = await device.connect({
          connectorType: 'rfcomm',
          delimiter: '\n',
          deviceCharset: Platform.OS === 'ios' ? 1536 : 'utf-8',
        });
      }
      if (connection) {
        setConnectedDevice(device);
        Alert.alert('Connected', `Successfully connected to ${device.name}`);
      }
    } catch (err: any) {
      setConnectedDevice(null);
      Alert.alert('Connection Failed', err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await connectedDevice.disconnect();
      } catch (err) {
        console.error(err);
      } finally {
        setConnectedDevice(null);
      }
    }
  };

  const isSendingRef = React.useRef(false);

  const sendCommand = async (command: string) => {
    if (!connectedDevice) {
      console.warn('Cannot send command: not connected.');
      return;
    }

    // Always allow STOP command to execute immediately; prevent overlapping repeating writes
    if (isSendingRef.current && command !== 'S') {
      return;
    }

    isSendingRef.current = true;
    try {
      await connectedDevice.write(command);
    } catch (err: any) {
      console.error('Failed to send data', err);
      // If the error indicates we are no longer connected, reset UI
      if (err.message && err.message.includes('Not connected')) {
        setConnectedDevice(null);
        Alert.alert('Disconnected', 'Connection lost. Please reconnect.');
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  const { lastKey, lastMotion, activeAction } = useGamepad({
    onCommand: sendCommand,
    enabled: true,
  });

  if (!bluetoothEnabled) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Bluetooth is not enabled.</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={checkBluetoothEnabled}>
          <Text style={styles.refreshBtnText}>Check Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>RC Car Controller</Text>
        <View style={[styles.statusIndicator, connectedDevice ? styles.statusConnected : styles.statusDisconnected]} />
      </View>

      {connectedDevice ? (
        <View style={styles.controllerContainer}>
          <Text style={styles.deviceName}>Connected to {connectedDevice.name}</Text>
          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectDevice}>
            <Text style={styles.disconnectBtnText}>Disconnect</Text>
          </TouchableOpacity>
          
          <View style={styles.dpadContainer}>
            <DPad onCommand={sendCommand} />
          </View>
        </View>
      ) : (
        <View style={styles.deviceListContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Paired Devices</Text>
            <TouchableOpacity onPress={getPairedDevices}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          
          {isScanning ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.address}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceItem}
                  onPress={() => connectToDevice(item)}
                  disabled={isConnecting}
                >
                  <View>
                    <Text style={styles.deviceNameItem}>{item.name || 'Unknown Device'}</Text>
                    <Text style={styles.deviceAddress}>{item.address}</Text>
                  </View>
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No paired devices found. Pair HC-05 in Settings first.</Text>
              }
            />
          )}
          
          {isConnecting && (
            <View style={styles.connectingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.connectingText}>Connecting...</Text>
            </View>
          )}
        </View>
      )}

      {/* Gamepad Driving Status & Live Feedback */}
      <View style={styles.gamepadMonitor}>
        <View style={styles.gamepadHeader}>
          <Text style={styles.gamepadTitle}>🎮 Controller Driving</Text>
          <Text
            style={[
              styles.gamepadStatus,
              activeAction
                ? styles.gamepadDriving
                : lastKey || lastMotion
                ? styles.gamepadActive
                : styles.gamepadIdle,
            ]}
          >
            {activeAction ? activeAction : connectedDevice ? 'READY' : 'STANDBY'}
          </Text>
        </View>

        {activeAction ? (
          <View style={styles.activeDrivingBox}>
            <Text style={styles.activeDrivingText}>
              🏎️ Active: <Text style={styles.highlightText}>{activeAction}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.gamepadWaitingText}>
            R2 to drive forward, L2 backward, Joystick to steer, A to spin.
          </Text>
        )}

        <View style={styles.controlsRow}>
          <Text style={styles.controlBadge}>R2: Forward</Text>
          <Text style={styles.controlBadge}>L2: Backward</Text>
          <Text style={styles.controlBadge}>Stick: Steer</Text>
          <Text style={styles.controlBadge}>A: Spin</Text>
        </View>

        {lastMotion && (
          <Text style={styles.gamepadMotionText} numberOfLines={1}>
            🕹️ Stick: [{lastMotion.axisX.toFixed(2)}, {lastMotion.axisY.toFixed(2)}] | L2: {lastMotion.lTrigger.toFixed(2)} | R2: {lastMotion.rTrigger.toFixed(2)}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1e293b', // Slate 800
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusConnected: {
    backgroundColor: '#22c55e', // Green
  },
  statusDisconnected: {
    backgroundColor: '#ef4444', // Red
  },
  controllerContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  deviceName: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 10,
  },
  disconnectBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 40,
  },
  disconnectBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  dpadContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceListContainer: {
    flex: 1,
    padding: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  listTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
  },
  refreshText: {
    color: '#38bdf8', // Sky 400
    fontSize: 16,
  },
  deviceItem: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceNameItem: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  deviceAddress: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  connectText: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  refreshBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  gamepadMonitor: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 14,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
  },
  gamepadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gamepadTitle: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  gamepadStatus: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  gamepadActive: {
    backgroundColor: '#065f46',
    color: '#34d399',
  },
  gamepadDriving: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  },
  gamepadIdle: {
    backgroundColor: '#334155',
    color: '#94a3b8',
  },
  activeDrivingBox: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  activeDrivingText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  controlBadge: {
    backgroundColor: '#334155',
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gamepadInfo: {
    marginTop: 4,
  },
  gamepadKeyText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  highlightText: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  gamepadActionText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  actionDown: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  actionUp: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  gamepadDeviceText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  gamepadWaitingText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  gamepadMotionText: {
    color: '#a78bfa',
    fontSize: 11,
    marginTop: 4,
    fontFamily: Platform.OS === 'android' ? 'monospace' : undefined,
  },
});
