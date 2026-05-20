import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Text, TouchableOpacity, View } from 'react-native';
// IMPORT NOTIFEE UNTUK FOREGROUND SERVICE
import notifee, { AndroidColor, AndroidImportance } from '@notifee/react-native';

const { width } = Dimensions.get('window');
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface PomodoroPreset {
  focus: number;  // dalam menit
  break: number;  // dalam menit
  label: string;
}

export default function PomodoroApp() {
  const presets: PomodoroPreset[] = [
    { focus: 25, break: 5, label: '25 : 5' },
    { focus: 50, break: 10, label: '50 : 10' },
    { focus: 75, break: 15, label: '75 : 15' },
  ];

  // --- STATE MANAGEMENT ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<PomodoroPreset>(presets[0]);
  const [secondsLeft, setSecondsLeft] = useState<number>(presets[0].focus * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isBreakMode, setIsBreakMode] = useState<boolean>(false);

  // Menggunakan useRef untuk menyimpan nilai terbaru agar bisa dibaca di dalam service
  const secondsLeftRef = useRef(secondsLeft);
  const isBreakModeRef = useRef(isBreakMode);
  const activePresetRef = useRef(activePreset);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
    isBreakModeRef.current = isBreakMode;
    activePresetRef.current = activePreset;
  }, [secondsLeft, isBreakMode, activePreset]);

  // --- FORMAT MENIT & DETIK ---
  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  // --- LOGIKA UTAMA TIMER (FOREGROUND SERVICE INTEGRATION) ---
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      // Membuat Foreground Service Berdetak Setiap Detik
      interval = setInterval(async () => {
        const currentSeconds = secondsLeftRef.current - 1;

        if (currentSeconds <= 0) {
          setIsActive(false);
          clearInterval(interval!);

          // SIKLUS OTOMATIS SAAT WAKTU HABIS
          if (!isBreakModeRef.current) {
            setIsBreakMode(true);
            setSecondsLeft(activePresetRef.current.break * 60);
            
            // Tembak Notifikasi Ledakan Selesai
            if (!isExpoGo) {
              await notifee.displayNotification({
                title: 'Sesi Fokus Selesai! 🎉',
                body: `Kerja bagus! Sesi fokus selesai. Yuk istirahat ${activePresetRef.current.break} menit.`,
                android: { channelId: 'fomodoro-timer' },
              });
            }
            Alert.alert('Kerja Bagus! 🌟', 'Sesi fokus selesai. Sekarang waktunya istirahat.');
          } else {
            setIsBreakMode(false);
            setSecondsLeft(activePresetRef.current.focus * 60);
            
            if (!isExpoGo) {
              await notifee.displayNotification({
                title: 'Waktu Istirahat Habis! 🚀',
                body: 'Yuk, kembali fokus ke tugas Anda!',
                android: { channelId: 'fomodoro-timer' },
              });
            }
            Alert.alert('Waktu Istirahat Habis! 🚀', 'Yuk, kembali fokus!');
          }
          
          // Matikan status bunderan notifikasi berjalan jika waktu habis
          if (!isExpoGo) await notifee.stopForegroundService();
        } else {
          setSecondsLeft(currentSeconds);

          // UPDATE BAR NOTIFIKASI SECARA REAL-TIME DI LATAR BELAKANG
          if (!isExpoGo) {
            const statusTeks = isBreakModeRef.current ? '☕ Rehat Sejenak...' : '🔥 Fokus Terus!';
            await notifee.displayNotification({
              id: 'fomodoro-running-status',
              title: statusTeks,
              body: `Sisa Waktu: ${formatTime(currentSeconds)}`,
              android: {
                channelId: 'fomodoro-timer',
                asForegroundService: true, // MENYALAKAN KARYAWAN BAYANGAN OS
                color: isBreakModeRef.current ? AndroidColor.BLUE : AndroidColor.GREEN,
                ongoing: true, // Notifikasi mengunci (tidak bisa di-swipe hapus oleh user)
                pressAction: { id: 'default', launchActivity: 'default' },
              },
            });
          }
        }
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  // --- HUBUNGKAN TOMBOL MULAI & JEDA ---
  const toggleTimer = async () => {
    if (!isExpoGo) {
      // Daftarkan saluran pipa (Channel ID) resmi ke sistem Android
      await notifee.createChannel({
        id: 'fomodoro-timer',
        name: 'Status Saluran Fomodoro',
        importance: AndroidImportance.HIGH,
      });
    }

    if (isActive) {
      // Jika dijeda, matikan paksa karyawan bayangan di bar notifikasi
      if (!isExpoGo) await notifee.stopForegroundService();
    }
    setIsActive(!isActive);
  };

  // --- HUBUNGKAN TOMBOL RESET ---
  const resetTimer = async () => {
    setIsActive(false);
    setIsBreakMode(false);
    setSecondsLeft(activePreset.focus * 60);
    if (!isExpoGo) await notifee.stopForegroundService();
  };

  // --- FUNGSI GANTI PRESET ---
  const handlePilihPreset = (preset: PomodoroPreset) => {
    if (isActive) {
      Alert.alert('Peringatan ⚠️', 'Hentikan atau reset timer terlebih dahulu.');
      return;
    }
    setActivePreset(preset);
    setIsBreakMode(false);
    setSecondsLeft(preset.focus * 60);
  };

  // --- TOMBOL RAHASIA TESTING 5 DETIK ---
  const setKeLimaDetik = () => {
    if (isActive) {
      Alert.alert('Peringatan ⚠️', 'Jeda timer terlebih dahulu.');
      return;
    }
    setSecondsLeft(5);
  };

  // --- STYLE WARNA DINAMIS ---
  const bgStyle = isDarkMode ? 'bg-[#1C1C1E]' : 'bg-[#F5F5F7]';
  const textStyle = isDarkMode ? 'text-white' : 'text-black';
  const btnStyle = isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#E5E5EA]';
  const tombolMulaiWarna = isBreakMode 
    ? (isActive ? '#FF9500' : '#5AC8FA') 
    : (isActive ? '#FF9500' : '#4CD964');

  return (
    <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, backgroundColor: isDarkMode ? '#1C1C1E' : '#F5F5F7' }} className={`flex-1 pt-16 px-6 justify-between items-center ${bgStyle}`}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* 1. HEADER */}
      <View style={{ width: '100%', alignItems: 'flex-end' }} className="items-end w-full">
        <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }} className={`w-12 h-12 rounded-full justify-center items-center ${btnStyle}`} onPress={() => setIsDarkMode(!isDarkMode)}>
          <Text style={{ fontSize: 20 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. DISPLAY */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} className="flex-1 justify-center items-center">
        <Text style={{ fontVariant: ['tabular-nums'], fontSize: 80, fontWeight: '900', color: isDarkMode ? '#FFF' : '#000' }} className={`text-8xl font-black tracking-tighter ${textStyle}`}>
          {formatTime(secondsLeft)}
        </Text>
        <Text style={{ fontSize: 18, marginTop: 12, opacity: 0.7, color: isDarkMode ? '#FFF' : '#000' }} className={`text-lg mt-4 font-medium opacity-75 ${textStyle}`}>
          {isActive ? (isBreakMode ? 'Rehat Sejenak... ☕' : 'Fokus Terus! 🔥') : (isBreakMode ? 'Waktunya Istirahat 🛋️' : 'Siap Memulai? 🚀')}
        </Text>
        <TouchableOpacity onPress={setKeLimaDetik} style={{ marginTop: 16, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FF3B30', opacity: 0.8 }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>🛠️ Set 5 Detik (Mode Tes)</Text>
        </TouchableOpacity>
      </View>

      {/* 3. MENU PRESET */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, width: '100%', marginBottom: 20 }}>
        {presets.map((preset, index) => {
          const isSelected = activePreset.label === preset.label;
          return (
            <TouchableOpacity key={index} onPress={() => handlePilihPreset(preset)} style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 16, backgroundColor: isSelected ? (isDarkMode ? '#FFF' : '#000') : (isDarkMode ? '#2C2C2E' : '#E5E5EA') }} className={`py-3 px-4 rounded-2xl ${isSelected ? (isDarkMode ? 'bg-white' : 'bg-black') : btnStyle}`}>
              <Text style={{ color: isSelected ? (isDarkMode ? '#000' : '#FFF') : (isDarkMode ? '#FFF' : '#000'), fontWeight: '700' }} className={`font-bold ${isSelected ? (isDarkMode ? 'text-black' : 'text-white') : textStyle}`}>{preset.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. CONTROLLER */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', maxWidth: 400, paddingHorizontal: 10, marginBottom: 20 }}>
        <TouchableOpacity onPress={toggleTimer} style={{ backgroundColor: tombolMulaiWarna, paddingVertical: 16, borderRadius: 24, flex: 1, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{isActive ? 'Jeda' : 'Mulai'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={resetTimer} style={{ backgroundColor: '#FF3B30', paddingVertical: 16, borderRadius: 24, flex: 1, marginLeft: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}