import React from 'react';
import { View, Text, Modal, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import tw from 'twrnc';
import { useIsDark } from '../store/themeStore';

interface DateTimePickerModalProps {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  title?: string;
}

export default function DateTimePickerModal({
  visible,
  mode,
  value,
  onChange,
  onConfirm,
  onCancel,
  title,
}: DateTimePickerModalProps) {
  const isDark = useIsDark();

  if (!visible) return null;

  // On Android, @react-native-community/datetimepicker opens its own native dialog directly
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value || new Date()}
        mode={mode}
        display="default"
        onChange={(event, date) => {
          if (event.type === 'set' && date) {
            onConfirm(date);
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  // On iOS or fallback, render inside modal sheet
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={tw`flex-1 justify-end bg-black/50`}>
        <View style={[tw`rounded-t-3xl p-6`, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={tw`flex-row justify-between items-center mb-4`}>
            <Text style={[tw`text-lg font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
              {title || (mode === 'date' ? 'Select Date' : 'Select Time')}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={tw`text-indigo-500 font-bold text-sm`}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={tw`items-center py-2`}>
            <DateTimePicker
              value={value || new Date()}
              mode={mode}
              display="spinner"
              onChange={onChange}
              textColor={isDark ? '#ffffff' : '#1f2937'}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          </View>

          <TouchableOpacity
            style={tw`bg-indigo-600 rounded-xl py-3.5 items-center mt-4 shadow-md`}
            onPress={() => onConfirm(value)}
          >
            <Text style={tw`text-white text-base font-bold`}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
