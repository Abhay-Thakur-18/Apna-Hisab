import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  StyleSheet,
} from 'react-native';
import tw from 'twrnc';
import { Check } from 'lucide-react-native';
import { useIsDark } from '../store/themeStore';

interface SuccessModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

export default function SuccessModal({ visible, message, onClose }: SuccessModalProps) {
  const isDark = useIsDark();
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconPopAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Trigger haptic vibration on open
      try {
        Vibration.vibrate(40);
      } catch (e) {}

      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
      iconPopAnim.setValue(0);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(iconPopAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    // Trigger haptic vibration on close
    try {
      Vibration.vibrate(40);
    } catch (e) {}

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const dialogBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const titleColor = isDark ? '#F7F7FA' : '#0B0B0F';
  const messageColor = isDark ? '#9494A8' : '#6E6E82';

  const iconScale = iconPopAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: dialogBg,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Green circular icon with bounce */}
          <Animated.View
            style={[
              styles.iconWrapper,
              { transform: [{ scale: iconScale }] },
            ]}
          >
            <View style={styles.iconInner}>
              <Check color="#FFFFFF" size={28} strokeWidth={3} />
            </View>
          </Animated.View>

          {/* Success Title */}
          <Text style={[tw`text-[22px] font-bold text-center mb-1.5`, { color: titleColor }]}>
            Success
          </Text>

          {/* Message */}
          <Text style={[tw`text-[15px] font-medium text-center mb-6 px-2`, { color: messageColor }]}>
            {message}
          </Text>

          {/* Continue Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.button}
            onPress={handleClose}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // 45% dim background
    paddingHorizontal: 24,
  },
  dialogContainer: {
    borderRadius: 24, // 24dp rounded corners
    padding: 24, // 24dp padding
    width: '85%', // ~85% screen width
    maxWidth: 360,
    alignItems: 'center',
    elevation: 8, // soft shadow/elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(34, 197, 94, 0.15)', // 15% green opacity
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  iconInner: {
    width: 48,
    height: 48,
    backgroundColor: '#22C55E', // #22C55E green
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  button: {
    width: '100%',
    height: 48, // 48dp height
    backgroundColor: '#22C55E', // #22C55E green
    borderRadius: 12, // 12dp radius
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
