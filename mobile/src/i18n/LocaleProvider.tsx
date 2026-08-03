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
    dailySummary: 'RESUMO DIÁRIO',
    meals: 'Refeições',
    noToday: 'Nenhum registro para hoje.',
    loadingNutrition: 'Carregando nutrição…',
    nutritionError: 'Não foi possível carregar a nutrição.',
    routine: 'ROTINA',
    loadingSupplements: 'Carregando suplementos…',
    supplementsError: 'Parte da rotina não pôde ser carregada.',
    noSupplements: 'Nenhum suplemento configurado.',
    evolution: 'EVOLUÇÃO',
    loadingProgress: 'Carregando progresso…',
    progressError: 'Parte dos dados não pôde ser carregada.',
    registerToday: 'Registrar hoje',
    saveProgress: 'Salvar progresso',
    recentWeight: 'Peso recente',
    recentMeasures: 'Medidas recentes',
    noRecords: 'Sem registros.',
    visualProgress: 'PROGRESSO VISUAL',
    newPhoto: 'Nova foto de progresso',
    camera: 'Câmera',
    gallery: 'Galeria',
    loadingPhotos: 'Carregando fotos…',
    photosError: 'Não foi possível carregar o índice de fotos.',
    noPhotos: 'Nenhuma foto de progresso.',
    share: 'Compartilhar',
    clear: 'Limpar',
    remove: 'Excluir',
    weeklyPlan: 'PLANO SEMANAL',
    loadingWorkouts: 'Carregando treinos…',
    workoutsError: 'Não foi possível carregar os treinos.',
    noWorkout: 'Nenhum treino configurado neste dia.',
    startWorkout: 'Iniciar treino',
    workoutSummary: 'Resumo do treino',
    finishWorkout: 'Finalizar treino',
    account: 'CONTA',
    accountSettings: 'Configurações',
    session: 'Sessão',
    deleteAccount: 'Excluir conta e dados',
    deleteForever: 'Excluir permanentemente',
    users: 'Usuários',
    loadingUsers: 'Carregando usuários…',
    recentAudit: 'Auditoria recente',
    active: 'Ativa',
    blocked: 'Bloqueada',
    user: 'Usuário',
    currentWeight: 'Peso atual',
    workouts7d: 'Treinos em 7 dias',
    weeklyVolume: 'Volume semanal',
    caloriesToday: 'Calorias hoje',
    proteinToday: 'Proteína hoje',
    waterToday: 'Água hoje',
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
    dailySummary: 'DAILY SUMMARY',
    meals: 'Meals',
    noToday: 'No entry for today.',
    loadingNutrition: 'Loading nutrition…',
    nutritionError: 'Unable to load nutrition.',
    routine: 'ROUTINE',
    loadingSupplements: 'Loading supplements…',
    supplementsError: 'Part of the routine could not be loaded.',
    noSupplements: 'No supplements configured.',
    evolution: 'PROGRESS',
    loadingProgress: 'Loading progress…',
    progressError: 'Some progress data could not be loaded.',
    registerToday: 'Log today',
    saveProgress: 'Save progress',
    recentWeight: 'Recent weight',
    recentMeasures: 'Recent measurements',
    noRecords: 'No records.',
    visualProgress: 'VISUAL PROGRESS',
    newPhoto: 'New progress photo',
    camera: 'Camera',
    gallery: 'Gallery',
    loadingPhotos: 'Loading photos…',
    photosError: 'Unable to load the photo index.',
    noPhotos: 'No progress photos.',
    share: 'Share',
    clear: 'Clear',
    remove: 'Delete',
    weeklyPlan: 'WEEKLY PLAN',
    loadingWorkouts: 'Loading workouts…',
    workoutsError: 'Unable to load workouts.',
    noWorkout: 'No workout configured for this day.',
    startWorkout: 'Start workout',
    workoutSummary: 'Workout summary',
    finishWorkout: 'Finish workout',
    account: 'ACCOUNT',
    accountSettings: 'Settings',
    session: 'Session',
    deleteAccount: 'Delete account and data',
    deleteForever: 'Delete permanently',
    users: 'Users',
    loadingUsers: 'Loading users…',
    recentAudit: 'Recent audit',
    active: 'Active',
    blocked: 'Blocked',
    user: 'User',
    currentWeight: 'Current weight',
    workouts7d: 'Workouts in 7 days',
    weeklyVolume: 'Weekly volume',
    caloriesToday: 'Calories today',
    proteinToday: 'Protein today',
    waterToday: 'Water today',
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
