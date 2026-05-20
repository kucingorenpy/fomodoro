import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Text, TouchableOpacity, View } from 'react-native';
// Import Constants untuk mendeteksi lingkungan lingkungan running
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';

const { width } = Dimensions.get('window');

// Cek apakah aplikasi sedang berjalan di dalam Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Hanya aktifkan handler jika dijalankan di luar Expo Go (di APK / Production Build)
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

interface PomodoroPreset {
  focus: number;  // dalam menit
  break: number;  // dalam menit
  label: string;
}

export default function PomodoroApp() {
  // --- PRESET PILIHAN WAKTU RESMI ---
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
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isBreakMode, setIsBreakMode] = useState<boolean>(false);

  // --- FUNGSI PEMICU NOTIFIKASI DI DETIK KE-0 ---
  const pemicuNotifikasiLokal = async (judul: string, pesan: string) => {
    // Jika di Expo Go, bypass fungsi agar tidak memicu error merah
    if (isExpoGo) {
      console.log(`[Simulasi Notifikasi] ${judul}: ${pesan}`);
      return;
    }

    // Bagian ini akan otomatis aktif 100% saat di-build menjadi APK / di-host ke Web
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: judul,
          body: pesan,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH, // Menampilkan banner pop-up
        },
        trigger: null, // Langsung muncul detik ini juga
      });
    }
  };

  // --- LOGIKA UTAMA TIMER (TIMESTAMP) ---
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      if (!endTime) {
        const targetTime = Date.now() + secondsLeft * 1000;
        setEndTime(targetTime);
      }

      interval = setInterval(() => {
        if (endTime) {
          const remainingMiliseconds = endTime - Date.now();
          const remainingSeconds = Math.ceil(remainingMiliseconds / 1000);

          if (remainingSeconds <= 0) {
            setIsActive(false);
            setEndTime(null);
            clearInterval(interval!);

            // LOGIKA SWITCH SIKLUS OTOMATIS TEPAT DI DETIK KE-0
            if (!isBreakMode) {
              setIsBreakMode(true);
              setSecondsLeft(activePreset.break * 60);
              
              // Tembak Notifikasi & Alert Fokus Selesai
              pemicuNotifikasiLokal('Sesi Fokus Selesai! 🎉', `Kerja bagus! Sekarang waktunya istirahat selama ${activePreset.break} menit.`);
              Alert.alert('Kerja Bagus! 🌟', `Sesi fokus selesai. Sekarang waktunya istirahat selama ${activePreset.break} menit.`);
            } else {
              setIsBreakMode(false);
              setSecondsLeft(activePreset.focus * 60);
              
              // Tembak Notifikasi & Alert Istirahat Selesai
              pemicuNotifikasiLokal('Waktu Istirahat Habis! 🚀', 'Yuk, kembali fokus ke tugas Anda!');
              Alert.alert('Waktu Istirahat Habis! 🚀', 'Yuk, kembali fokus ke tugas Anda!');
            }
          } else {
            setSecondsLeft(remainingSeconds);
          }
        }
      }, 500);
    } else {
      if (endTime) setEndTime(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, endTime, secondsLeft, activePreset, isBreakMode]);

  // --- FUNGSI GANTI PRESET ---
  const handlePilihPreset = (preset: PomodoroPreset) => {
    if (isActive) {
      Alert.alert('Peringatan ⚠️', 'Hentikan atau reset timer terlebih dahulu sebelum mengubah preset waktu.');
      return;
    }
    setActivePreset(preset);
    setIsBreakMode(false);
    setSecondsLeft(preset.focus * 60);
    setEndTime(null);
  };

  const toggleTimer = () => {
    if (!isActive) {
      const targetTime = Date.now() + secondsLeft * 1000;
      setEndTime(targetTime);
    } else {
      setEndTime(null);
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setEndTime(null);
    setIsBreakMode(false);
    setSecondsLeft(activePreset.focus * 60);
  };

  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  // --- DINAMIS WARNA TEMA ---
  const bgStyle = isDarkMode ? 'bg-[#1C1C1E]' : 'bg-[#F5F5F7]';
  const textStyle = isDarkMode ? 'text-white' : 'text-black';
  const btnStyle = isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#E5E5EA]';
  
  const tombolMulaiWarna = isBreakMode 
    ? (isActive ? '#FF9500' : '#5AC8FA') 
    : (isActive ? '#FF9500' : '#4CD964');

  return (
    <View 
      style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, backgroundColor: isDarkMode ? '#1C1C1E' : '#F5F5F7' }}
      className={`flex-1 pt-16 px-6 justify-between items-center ${bgStyle}`}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* 1. HEADER */}
      <View style={{ width: '100%', alignItems: 'flex-end' }} className="items-end w-full">
        <TouchableOpacity 
          style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }}
          className={`w-12 h-12 rounded-full justify-center items-center ${btnStyle}`}
          onPress={() => setIsDarkMode(!isDarkMode)}
        >
          <Text style={{ fontSize: 20 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. TIMER DISPLAY */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} className="flex-1 justify-center items-center">
        <Text 
          style={{ fontVariant: ['tabular-nums'], fontSize: 80, fontWeight: '900', color: isDarkMode ? '#FFF' : '#000' }}
          className={`text-8xl font-black tracking-tighter ${textStyle}`}
        >
          {formatTime(secondsLeft)}
        </Text>
        <Text style={{ fontSize: 18, marginTop: 12, opacity: 0.7, color: isDarkMode ? '#FFF' : '#000' }} className={`text-lg mt-4 font-medium opacity-75 ${textStyle}`}>
          {isActive 
            ? (isBreakMode ? 'Rehat Sejenak... ☕' : 'Fokus Terus! 🔥') 
            : (isBreakMode ? 'Waktunya Istirahat 🛋️' : 'Siap Memulai? 🚀')}
        </Text>
      </View>

      {/* 3. MENU PRESET PILIHAN WAKTU */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, width: '100%', marginBottom: 20 }}>
        {presets.map((preset, index) => {
          const isSelected = activePreset.label === preset.label;
          let activeBtnBg = isDarkMode ? '#FFF' : '#000';
          let activeTextCol = isDarkMode ? '#000' : '#FFF';
          let normalBtnBg = isDarkMode ? '#2C2C2E' : '#E5E5EA';
          let normalTextCol = isDarkMode ? '#FFF' : '#000';

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handlePilihPreset(preset)}
              style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 16, backgroundColor: isSelected ? activeBtnBg : normalBtnBg }}
              className={`py-3 px-4 rounded-2xl ${isSelected ? (isDarkMode ? 'bg-white' : 'bg-black') : btnStyle}`}
            >
              <Text style={{ color: isSelected ? activeTextCol : normalTextCol, fontWeight: '700' }} className={`font-bold ${isSelected ? (isDarkMode ? 'text-black' : 'text-white') : textStyle}`}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. CONTROLLER */}
      <View 
        style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          width: '100%', 
          maxWidth: 400, 
          paddingHorizontal: 10,
          marginBottom: 20
        }}
      >
        <TouchableOpacity 
          onPress={toggleTimer}
          style={{ 
            backgroundColor: tombolMulaiWarna, 
            paddingVertical: 16, 
            borderRadius: 24, 
            flex: 1, 
            marginRight: 8, 
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
            {isActive ? 'Jeda' : 'Mulai'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={resetTimer}
          style={{ 
            backgroundColor: '#FF3B30', 
            paddingVertical: 16, 
            borderRadius: 24, 
            flex: 1, 
            marginLeft: 8, 
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}