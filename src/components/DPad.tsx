import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface DPadProps {
  onCommand: (command: string) => void;
}

export function DPad({ onCommand }: DPadProps) {
  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSpinPressIn = () => {
    onCommand('F');
    spinTimerRef.current = setInterval(() => {
      onCommand('F');
    }, 200);
  };

  const handleSpinPressOut = () => {
    if (spinTimerRef.current) {
      clearInterval(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    onCommand('S');
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <PadButton 
          label="▲" 
          command="R" 
          onCommand={onCommand} 
          style={styles.upButton} 
        />
      </View>
      <View style={styles.row}>
        <PadButton 
          label="◄" 
          command="B" 
          onCommand={onCommand} 
          style={styles.leftButton} 
        />
        <StopButton onCommand={onCommand} />
        <PadButton 
          label="►" 
          command="F" 
          onCommand={onCommand} 
          style={styles.rightButton} 
        />
      </View>
      <View style={styles.row}>
        <PadButton 
          label="▼" 
          command="L" 
          onCommand={onCommand} 
          style={styles.downButton} 
        />
      </View>
      
      {/* The special "Round and Round" Spin Button */}
      <View style={{ marginTop: 30 }}>
        <TouchableOpacity
          activeOpacity={0.6}
          onPressIn={handleSpinPressIn}
          onPressOut={handleSpinPressOut}
          style={styles.spinButton}
        >
          <Text style={styles.spinButtonText}>🌪️ SPIN 🌪️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PadButton({ label, command, onCommand, style }: any) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePressIn = () => {
    onCommand(command);
    timerRef.current = setInterval(() => {
      onCommand(command);
    }, 200);
  };

  const handlePressOut = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onCommand('S');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.button, style]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StopButton({ onCommand }: { onCommand: (c: string) => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPressIn={() => onCommand('S')}
      style={[styles.button, styles.stopButton]}
    >
      <Text style={styles.stopButtonText}>STOP</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 80,
    height: 80,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  upButton: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  downButton: {
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  leftButton: {
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 40,
  },
  rightButton: {
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    borderRadius: 40,
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  spinButton: {
    backgroundColor: '#8b5cf6', // Vibrant purple
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  spinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
