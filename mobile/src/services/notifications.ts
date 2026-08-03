import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export async function enableRestNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('workout-rest', {
      name: 'Descanso do treino',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  return true;
}

export async function scheduleRestNotification(seconds: number, exercise: string): Promise<void> {
  if (seconds <= 0 || !(await enableRestNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'KYRO · Descanso concluído',
      body: `Hora da próxima série de ${exercise}.`,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: 'workout-rest' } : {}),
    },
  });
}
