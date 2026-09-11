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

  const sendCommand = async (command: string) => {
    if (connectedDevice) {
      try {
        await connectedDevice.write(command);
      } catch (err: any) {
        console.error('Failed to send data', err);
        // If the error indicates we are no longer connected, reset UI
        if (err.message && err.message.includes('Not connected')) {
          setConnectedDevice(null);
          Alert.alert('Disconnected', 'Connection lost. Please reconnect.');
        }
      }
    } else {
      console.warn('Cannot send command: not connected.');
    }
  };

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
  }
});
