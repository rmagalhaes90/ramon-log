import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type Locale = 'pt' | 'en';
const messages = {
  pt: {
    today: 'Hoje',
    workouts: 'Treinos',
    progress: 'Progresso',
    nutrition: 'Nutrição',
    supplements: 'Suplementos',
    photos: 'Fotos',
    settings: 'Conta',
    logout: 'Sair',
    hello: 'Olá',
    overview: 'VISÃO DE HOJE',
    readiness: 'Pontuação registrada hoje',
    checkin: 'Check-in diário',
    saveCheckin: 'Salvar check-in',
    language: 'English',
  },
  en: {
    today: 'Today',
    workouts: 'Workouts',
    progress: 'Progress',
    nutrition: 'Nutrition',
    supplements: 'Supplements',
    photos: 'Photos',
    settings: 'Account',
    logout: 'Sign out',
    hello: 'Hello',
    overview: 'TODAY OVERVIEW',
    readiness: 'Score recorded today',
    checkin: 'Daily check-in',
    saveCheckin: 'Save check-in',
    language: 'Português',
  },
} as const;
type MessageKey = keyof (typeof messages)['pt'];
interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>('pt');
  useEffect(() => {
    void AsyncStorage.getItem('@kyro:locale')
      .then((value) => {
        if (value === 'pt' || value === 'en') setLocaleState(value);
      })
      .catch(() => undefined);
  }, []);
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        void AsyncStorage.setItem('@kyro:locale', next).catch(() => undefined);
      },
      t: (key) => messages[locale][key],
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}
