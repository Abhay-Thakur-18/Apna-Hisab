import React, { useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import tw from 'twrnc';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onHide?: () => void;
  duration?: number;
}

export default function Toast({
  visible,
  message,
  type = 'success',
  onHide,
  duration = 3000,
}: ToastProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) onHide();
    });
  };

  if (!visible) return null;

  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    info: 'bg-indigo-600',
  };

  const IconComponent =
    type === 'success' ? CheckCircle2 : type === 'error' ? AlertCircle : Info;

  return (
    <Animated.View
      style={[
        tw`absolute top-12 left-6 right-6 z-50 rounded-2xl p-4 flex-row items-center shadow-lg ${bgColors[type]}`,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <IconComponent color="#ffffff" size={22} style={tw`mr-3`} />
      <Text style={tw`text-white font-bold text-sm flex-1`}>{message}</Text>
    </Animated.View>
  );
}
